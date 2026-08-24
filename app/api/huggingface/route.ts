import { NextRequest } from 'next/server';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, historyContentToText, MAX_LENGTHS } from '../../lib/security/validation';
import { HUGGINGFACE_MODEL_MAP, extractThinkChunks, type ThinkState } from '../../lib/huggingface';
import { sseError } from '../../lib/security/sse';
import { resolveMaxTokens } from '../../lib/ai/tokens';
import { parseOpenAISSEStream } from '../../lib/ai/parseOpenAISSEStream';
import { rateLimitStatusHandler } from '../../lib/security/rateLimitHelpers';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

// User-friendly error messages - NEVER expose internal API details
function getUserFriendlyErrorMessage(errorType: 'unavailable' | 'rate_limit' | 'gated' | 'permissions' | 'timeout' | 'generic'): string {
  const messages: Record<string, string> = {
    unavailable: "I'm temporarily unable to process your request. This model may be experiencing high demand. Please try a different model or try again in a moment.",
    rate_limit: "You've reached the request limit for this session. Please wait a few minutes before trying again.",
    gated: 'This model requires accepting its license on huggingface.co before it can be used. Please try a different model.',
    // Distinct from 'gated': this means the *token itself* lacks the
    // "Inference Providers" permission scope, not a specific model's
    // license - happens with a default read-only token, and no amount of
    // switching models fixes it. See huggingface.co/settings/tokens.
    permissions: "This Hugging Face token doesn't have permission to call Inference Providers. Edit the token at huggingface.co/settings/tokens and enable that permission (or create a new fine-grained token with it checked), then update HUGGINGFACE_API_KEY.",
    timeout: 'The request took too long to process. Please try again with a shorter message or a faster model.',
    generic: 'Something went wrong while processing your request. Please try again or select a different model.',
  };
  return messages[errorType] || messages.generic;
}

function getErrorType(statusCode: number, errorBody: string): 'unavailable' | 'rate_limit' | 'gated' | 'permissions' | 'timeout' | 'generic' {
  if (statusCode === 403) {
    return errorBody.includes('sufficient permissions') ? 'permissions' : 'gated';
  }
  if (statusCode === 429 || errorBody.includes('rate limit')) {
    return 'rate_limit';
  }
  if (statusCode === 503 || statusCode === 502 || statusCode === 500) {
    return 'unavailable';
  }
  if (errorBody.includes('timeout') || errorBody.includes('timed out')) {
    return 'timeout';
  }
  return 'generic';
}

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting - apply before processing
    const rateLimitResponse = await applyRateLimit(request, 'ai-query');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Security: Hugging Face-specific rate limit (separate, stricter bucket
    // from the shared 'ai-query' limit). Must use applyRateLimit, which
    // atomically checks-and-consumes - the previous code only ever called
    // the now no-op incrementRateLimit('huggingface') after a successful
    // request, so this bucket was never actually consumed and the limit
    // never triggered.
    const hfRateLimitResponse = await applyRateLimit(request, 'huggingface');
    if (hfRateLimitResponse) {
      return hfRateLimitResponse;
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
    } catch (jsonError) {
      const jsonErrorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      if (jsonErrorMessage.includes('body')) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw jsonError;
    }

    // Security: Model allowlist - prevent model injection attacks
    const ALLOWED_MODEL_IDS = new Set(Object.keys(HUGGINGFACE_MODEL_MAP));

    // Security: Strict input validation with schema
    const validation = validateAIQueryRequest(payload, ALLOWED_MODEL_IDS);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    // Use sanitized payload
    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image, outputLength } = validation.sanitized!;

    // Response length control - mirrors query-gateway's max_tokens handling so
    // the setting has the same effect regardless of which provider handles
    // the model.
    const maxTokens = resolveMaxTokens(outputLength);

    // Security: Content moderation - check for offensive content
    const queryCheck = containsOffensiveContent(query);
    if (queryCheck.isOffensive) {
      return sseError("I apologize, but I cannot assist with that type of request. Please ask me something else, and I'll be happy to help.");
    }

    // Security: API key validation - ensure key exists in environment (never exposed to client)
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('HUGGINGFACE_API_KEY is missing from environment variables');
      return sseError(getUserFriendlyErrorMessage('unavailable'));
    }

    // Security: Model selection - use validated model from allowlist only
    let targetModelId = HUGGINGFACE_MODEL_MAP['hf-qwen-2.5-7b']; // Default
    if (model && HUGGINGFACE_MODEL_MAP[model]) {
      targetModelId = HUGGINGFACE_MODEL_MAP[model];
    }

    // Security: Increment rate limit after successful validation
    await incrementRateLimit(request, 'ai-query');

    // Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // Add system prompt with Roovert context
    const systemPrompt = getSystemPrompt(customSystemPrompt);
    messages.push({ role: 'system', content: systemPrompt });

    // Security: Validate and limit conversation history (already validated, but enforce limits)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const limitedHistory = conversationHistory.slice(-MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES);
      for (const msg of limitedHistory) {
        // Security: only 'user'/'assistant' are accepted here - a client-
        // supplied 'system' role would otherwise let conversationHistory
        // smuggle in a fake system-level instruction (prompt injection).
        if (!msg || typeof msg !== 'object' || !msg.role || !msg.content ||
          (msg.role !== 'user' && msg.role !== 'assistant')) {
          continue;
        }
        const textContent = historyContentToText(msg.content);
        if (textContent !== null && textContent.length <= MAX_LENGTHS.MESSAGE_CONTENT) {
          messages.push({
            role: msg.role,
            content: textContent,
          });
        }
      }
    }

    // Add current message. Most HF-hosted instruct models used here aren't
    // vision-capable, so an attached image is dropped with a note rather
    // than sent as an image_url part the model can't use.
    if (image) {
      messages.push({ role: 'user', content: `${query}\n\n[An image was attached, but this model doesn't support image input - please describe it in words if it's relevant.]` });
    } else {
      messages.push({ role: 'user', content: query });
    }

    try {
      const hfResponse = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
        body: JSON.stringify({
          model: targetModelId,
          messages,
          stream: true,
          max_tokens: maxTokens,
        }),
      });

      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        console.error('Hugging Face API error:', hfResponse.status, errorText);
        const errorType = getErrorType(hfResponse.status, errorText);
        return sseError(getUserFriendlyErrorMessage(errorType));
      }

      // Security: Increment rate limit after successful request
      await incrementRateLimit(request, 'huggingface');
      await incrementRateLimit(request, 'ai-query');

      // Stream the response - HF's router follows the same OpenAI-style SSE
      // shape as OpenRouter, so this parsing loop mirrors that route's.
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullResponse = '';
          let fullReasoning = '';
          let thinkState: ThinkState = { insideThink: false, pending: '' };

          try {
            if (!hfResponse.body) throw new Error('No response body');

            for await (const delta of parseOpenAISSEStream(hfResponse.body)) {
              // Kimi K3 shape: reasoning arrives pre-split in its own field.
              const reasoningContent = delta?.reasoning_content;
              if (typeof reasoningContent === 'string' && reasoningContent) {
                fullReasoning += reasoningContent;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ reasoning: reasoningContent, done: false })}\n\n`)
                );
              }

              // DeepSeek R1 shape (and default passthrough for every other
              // model): plain content, possibly inlining <think> tags.
              const content = delta?.content;
              if (content) {
                const result = extractThinkChunks(content as string, thinkState);
                thinkState = result.state;
                for (const chunk of result.chunks) {
                  if (chunk.type === 'reasoning') {
                    fullReasoning += chunk.text;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ reasoning: chunk.text, done: false })}\n\n`)
                    );
                  } else {
                    fullResponse += chunk.text;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content: chunk.text, done: false })}\n\n`)
                    );
                  }
                }
              }
            }

            // Flush any trailing partial-tag text that never resolved (e.g.
            // stream ended without a closing </think>) so nothing is lost.
            if (thinkState.pending) {
              if (thinkState.insideThink) {
                fullReasoning += thinkState.pending;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ reasoning: thinkState.pending, done: false })}\n\n`)
                );
              } else {
                fullResponse += thinkState.pending;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: thinkState.pending, done: false })}\n\n`)
                );
              }
            }

            // Final content moderation check - reasoning is now rendered to
            // the user too, so it goes through the same filter as the answer.
            const { filtered: filteredReasoning, wasFiltered: reasoningWasFiltered } = filterResponse(fullReasoning);
            if (reasoningWasFiltered) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ reasoning: '\n\n' + filteredReasoning, done: false })}\n\n`)
              );
            }

            const { filtered, wasFiltered } = filterResponse(fullResponse);
            if (wasFiltered) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: '\n\n' + filtered, done: false })}\n\n`)
              );
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
            );
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: getUserFriendlyErrorMessage('generic'), done: true })}\n\n`)
              );
            } catch { }
            try { controller.close(); } catch { }
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
    } catch (error) {
      console.error('Hugging Face API error:', error);
      // Security: Still increment rate limit on error (to prevent retry abuse)
      await incrementRateLimit(request, 'huggingface');
      await incrementRateLimit(request, 'ai-query');
      return sseError(getUserFriendlyErrorMessage('generic'));
    }
  } catch (error) {
    console.error('Query processing error:', error);
    return sseError(getUserFriendlyErrorMessage('generic'));
  }
}

// GET endpoint to check rate limit status
export async function GET(request: NextRequest) {
  return rateLimitStatusHandler(request, 'huggingface');
}
