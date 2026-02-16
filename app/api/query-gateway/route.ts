import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, MAX_LENGTHS } from '../../lib/security/validation';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

// Groq API configuration
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// User-friendly error messages - NEVER expose internal API details
function getUserFriendlyErrorMessage(): string {
  return "I'm temporarily unable to process your request. Please try again in a moment, or select a different model.";
}

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting - apply before processing
    const rateLimitResponse = applyRateLimit(request, 'ai-query');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Security: Validate request body size before parsing
    const contentLength = request.headers.get('content-length');
    const bodySizeErrors = validateBodySize(contentLength, 10 * 1024 * 1024); // 10MB max
    if (bodySizeErrors.length > 0) {
      return createValidationErrorResponse(bodySizeErrors);
    }

    // Security: Parse and validate payload
    let payload;
    try {
      payload = await request.json();
    } catch (jsonError: any) {
      if (jsonError.message && jsonError.message.includes('body')) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw jsonError;
    }

    // Security: Model allowlist - prevent model injection attacks
    const MODEL_MAP: Record<string, string> = {
      'multi-perspective': 'multi-perspective', // Special parallel mode
      'ooverta': 'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b': 'llama-3.3-70b-versatile',
      'llama-3.1-8b': 'llama-3.1-8b-instant',
    };
    const ALLOWED_MODEL_IDS = new Set(Object.keys(MODEL_MAP));

    // Security: Strict input validation with schema
    const validation = validateAIQueryRequest(payload, ALLOWED_MODEL_IDS);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    // Use sanitized payload
    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image, runParallel, outputLength, parallelModel1, parallelModel2 } = validation.sanitized!;

    // Determine max_tokens based on outputLength
    const maxTokensMap = {
      small: 800,
      medium: 2000,
      large: 4000
    };
    const maxTokens = maxTokensMap[outputLength as 'small' | 'medium' | 'large'] || maxTokensMap.medium;

    // Security: Content moderation - check for offensive content
    const queryCheck = containsOffensiveContent(query);
    if (queryCheck.isOffensive) {
      return new Response(
        `data: ${JSON.stringify({ content: "I apologize, but I cannot assist with that type of request. Please ask me something else, and I'll be happy to help.", done: true })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Security: Increment rate limit after successful validation
    incrementRateLimit(request, 'ai-query');

    // Security: API key validation - ensure key exists in environment (never exposed to client)
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is missing from environment variables');
      return new Response(
        `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage(), done: true })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Security: Model selection - use validated model from allowlist only
    let targetModelId = 'llama-3.3-70b-versatile';
    if (model && MODEL_MAP[model]) {
      targetModelId = MODEL_MAP[model];
    }

    // Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // Add system prompt with Roovert context and content moderation
    const systemPrompt = getSystemPrompt(customSystemPrompt);
    messages.push({ role: 'system', content: systemPrompt });

    // Security: Validate and limit conversation history (already validated, but enforce limits)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const limitedHistory = conversationHistory.slice(-MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES);
      for (const msg of limitedHistory) {
        // Additional validation - ensure message structure is correct
        if (msg && typeof msg === 'object' && msg.role && msg.content &&
          (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
          typeof msg.content === 'string' && msg.content.length <= MAX_LENGTHS.MESSAGE_CONTENT) {
          messages.push({
            role: msg.role,
            content: msg.content as any
          });
        }
      }
    }

    // Add current message
    if (image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: query },
          { type: 'image_url', image_url: { url: image } }
        ] as any
      });
    } else {
      messages.push({ role: 'user', content: query });
    }

    try {
      // If parallel mode is enabled and no image, use user-selected models
      if (runParallel && !image && parallelModel1 && parallelModel2) {
        // Use the two models selected by the user
        const selectedModels = [parallelModel1, parallelModel2];

        // If we have multiple models, run them in parallel
        if (selectedModels.length > 1) {
          // Import orchestration utilities
          const { synthesizeResponses } = await import('../../lib/orchestration');

          const modelPromises = selectedModels.map(async (selectedModel) => {
            const modelId = MODEL_MAP[selectedModel] || targetModelId;
            const result = await streamText({
              model: groq(modelId),
              messages: messages as any,
            });

            let fullText = '';
            for await (const chunk of result.textStream) {
              fullText += chunk;
            }
            return { model: selectedModel, content: fullText };
          });

          const responses = await Promise.all(modelPromises);

          // Synthesize responses
          const synthesized = synthesizeResponses(responses, query);

          // Stream the synthesized response
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              const words = synthesized.split(' ');
              let index = 0;

              const sendChunk = () => {
                if (index < words.length) {
                  const chunk = (index > 0 ? ' ' : '') + words[index];
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`)
                  );
                  index++;
                  setTimeout(sendChunk, 10); // Small delay for streaming effect
                } else {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
                  );
                  controller.close();
                }
              };

              sendChunk();
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
            },
          });
        }
      }

      // Single model mode (default or when image is present)
      // Use Vercel AI SDK to stream the response via Groq Provider
      const result = await streamText({
        model: groq(targetModelId),
        messages: messages as any,
      });

      // Convert to Server-Sent Events format with content filtering and token limiting
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullResponse = '';
          let tokenCount = 0;

          try {
            for await (const chunk of result.textStream) {
              // Approximate token count (rough estimate: ~4 chars per token)
              tokenCount += Math.ceil(chunk.length / 4);

              // Stop if we exceed maxTokens
              if (tokenCount > maxTokens) {
                // Send final chunk and stop
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
                );
                controller.close();
                return;
              }

              fullResponse += chunk;
              // Stream chunks normally, but we'll check at the end
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`)
              );
            }

            // Final content moderation check
            const { filtered, wasFiltered } = filterResponse(fullResponse);
            if (wasFiltered) {
              // If content was filtered, send replacement message
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: '\n\n' + filtered, done: false })}\n\n`)
              );
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
            );
            controller.close();
          } catch (error: any) {
            console.error('Streaming error:', error);
            // Only try to send error if controller is still writable
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: getUserFriendlyErrorMessage(), done: true })}\n\n`)
              );
            } catch (ignore) { }
            try { controller.close(); } catch (ignore) { }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (error: any) {
      console.error('Groq API error:', error);
      return new Response(
        `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage(), done: true })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Query processing error:', error);
    return new Response(
      `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage(), done: true })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }
}
