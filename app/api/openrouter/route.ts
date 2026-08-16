import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, MAX_LENGTHS } from '../../lib/security/validation';
import { sseError } from '../../lib/security/sse';
import { resolveMaxTokens } from '../../lib/ai/tokens';
import { parseOpenAISSEStream } from '../../lib/ai/parseOpenAISSEStream';
import { rateLimitStatusHandler } from '../../lib/security/rateLimitHelpers';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

// OpenRouter model mapping
const OPENROUTER_MODEL_MAP: Record<string, string> = {
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-3-opus': 'anthropic/claude-3-opus',
  'claude-3-sonnet': 'anthropic/claude-3-sonnet',
  'claude-3-haiku': 'anthropic/claude-3-haiku',
  'gemini-pro': 'google/gemini-pro',
  'llama-3.1-405b': 'meta-llama/llama-3.1-405b-instruct',
  'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
  'mistral-large': 'mistralai/mistral-large',
  'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct',
  'qwen-2.5-72b': 'qwen/qwen-2.5-72b-instruct',
  'deepseek-chat': 'deepseek/deepseek-chat',
};

// User-friendly error messages - NEVER expose internal API details
function getUserFriendlyErrorMessage(errorType: 'unavailable' | 'rate_limit' | 'credits' | 'timeout' | 'generic'): string {
  const messages: Record<string, string> = {
    unavailable: "I'm temporarily unable to process your request. This model may be experiencing high demand. Please try a different model or try again in a moment.",
    rate_limit: "You've reached the request limit for this session. Please wait a few minutes before trying again.",
    credits: "This model is temporarily unavailable. Please try one of the free models like Llama or DeepSeek, or try again later.",
    timeout: "The request took too long to process. Please try again with a shorter message or a faster model.",
    generic: "Something went wrong while processing your request. Please try again or select a different model."
  };
  return messages[errorType] || messages.generic;
}

// Parse API errors and return appropriate user-friendly type
function getErrorType(statusCode: number, errorBody: string): 'unavailable' | 'rate_limit' | 'credits' | 'timeout' | 'generic' {
  // Payment/credits issues
  if (statusCode === 402 || errorBody.includes('credits') || errorBody.includes('afford')) {
    return 'credits';
  }
  // Rate limiting
  if (statusCode === 429 || errorBody.includes('rate limit')) {
    return 'rate_limit';
  }
  // Service unavailable
  if (statusCode === 503 || statusCode === 502 || statusCode === 500) {
    return 'unavailable';
  }
  // Timeout
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

    // Security: OpenRouter-specific rate limit (45/24hrs). Must use
    // applyRateLimit (atomically checks-and-consumes) rather than the old
    // shouldHideOpenRouterModels + incrementRateLimit pattern - that pattern
    // only ever peeked at the bucket and "incremented" it via the now
    // no-op incrementRateLimit, so the 'openrouter' bucket was never
    // actually consumed and this limit never triggered.
    const openRouterRateLimitResponse = await applyRateLimit(request, 'openrouter');
    if (openRouterRateLimitResponse) {
      return sseError(getUserFriendlyErrorMessage('rate_limit'), 429);
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

    // Security: Model allowlist - prevent model injection attacks (using top-level OPENROUTER_MODEL_MAP)
    const ALLOWED_MODEL_IDS = new Set(Object.keys(OPENROUTER_MODEL_MAP));

    // Security: Strict input validation with schema
    const validation = validateAIQueryRequest(payload, ALLOWED_MODEL_IDS);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    // Use sanitized payload
    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image, outputLength } = validation.sanitized!;

    // Response length control - mirrors query-gateway's maxTokensMap so the
    // setting has the same effect regardless of which provider handles the
    // model.
    const maxTokensMap = { small: 800, medium: 2000, large: 4000 };
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

    // Security: API key validation - ensure key exists in environment (never exposed to client)
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is missing from environment variables');
      return new Response(
        `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage('unavailable'), done: true })}\n\n`,
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
    let targetModelId = 'openai/gpt-4o'; // Default
    if (model && OPENROUTER_MODEL_MAP[model]) {
      targetModelId = OPENROUTER_MODEL_MAP[model];
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
        // Additional validation - ensure message structure is correct
        if (msg && typeof msg === 'object' && msg.role && msg.content && 
            (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
            typeof msg.content === 'string' && msg.content.length <= MAX_LENGTHS.MESSAGE_CONTENT) {
          messages.push({
            role: msg.role,
            content: msg.content
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
        ]
      });
    } else {
      messages.push({ role: 'user', content: query });
    }

    try {
      // Direct fetch to OpenRouter API with streaming
      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://roovert.com',
          'X-Title': 'Roovert AI Platform',
        },
        body: JSON.stringify({
          model: targetModelId,
          messages: messages,
          stream: true,
          max_tokens: maxTokens,
        }),
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        console.error('OpenRouter API error:', openRouterResponse.status, errorText);
        const errorType = getErrorType(openRouterResponse.status, errorText);
        return new Response(
          `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage(errorType), done: true })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        );
      }

      // Security: Increment rate limit after successful request
      await incrementRateLimit(request, 'openrouter');
      await incrementRateLimit(request, 'ai-query');

      // Stream the response
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let fullResponse = '';

          try {
            const reader = openRouterResponse.body?.getReader();
            if (!reader) throw new Error('No response body');

            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`)
                    );
                  }
                } catch (parseError) {
                  // Skip malformed JSON
                }
              }
            }

            // Final content moderation check
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
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Security: Still increment rate limit on error (to prevent retry abuse)
      await incrementRateLimit(request, 'openrouter');
      await incrementRateLimit(request, 'ai-query');
      return new Response(
        `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage('generic'), done: true })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }
  } catch (error) {
    console.error('Query processing error:', error);
    return new Response(
      `data: ${JSON.stringify({ content: getUserFriendlyErrorMessage('generic'), done: true })}\n\n`,
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

// GET endpoint to check rate limit status
export async function GET(request: NextRequest) {
  return rateLimitStatusHandler(request, 'openrouter');
}
