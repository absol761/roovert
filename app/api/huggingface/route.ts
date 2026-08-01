import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit, getRateLimitStatus } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, MAX_LENGTHS } from '../../lib/security/validation';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

// Hugging Face model mapping - id/apiId must match HUGGINGFACE_MODELS in
// app/lib/models.ts. Served via HF's unified, OpenAI-compatible "Inference
// Providers" router, which auto-routes each model to whichever backend
// (Together, Novita, HF's own serverless infra, etc.) currently hosts it -
// closely mirroring app/api/openrouter/route.ts's structure since the wire
// format (SSE chunks shaped like OpenAI's chat completion stream) is the same.
const HUGGINGFACE_MODEL_MAP: Record<string, string> = {
  'hf-qwen-2.5-72b': 'Qwen/Qwen2.5-72B-Instruct',
  'hf-qwen-2.5-7b': 'Qwen/Qwen2.5-7B-Instruct',
  'hf-deepseek-v3': 'deepseek-ai/DeepSeek-V3',
  'hf-phi-4': 'microsoft/phi-4',
  'hf-kimi-k3': 'moonshotai/Kimi-K3',
  'hf-deepseek-r1': 'deepseek-ai/DeepSeek-R1',
  'hf-gpt-oss-120b': 'openai/gpt-oss-120b',
  'hf-qwen-3-235b': 'Qwen/Qwen3-235B-A22B-Instruct-2507',
};

// User-friendly error messages - NEVER expose internal API details
function getUserFriendlyErrorMessage(errorType: 'unavailable' | 'rate_limit' | 'gated' | 'permissions' | 'timeout' | 'generic'): string {
  const messages: Record<string, string> = {
    unavailable: "I'm temporarily unable to process your request. This model may be experiencing high demand. Please try a different model or try again in a moment.",
    rate_limit: "You've reached the request limit for this session. Please wait before trying again.",
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
    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image } = validation.sanitized!;

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
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('HUGGINGFACE_API_KEY is missing from environment variables');
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
        if (msg && typeof msg === 'object' && msg.role && msg.content &&
          (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
          typeof msg.content === 'string' && msg.content.length <= MAX_LENGTHS.MESSAGE_CONTENT) {
          messages.push({
            role: msg.role,
            content: msg.content,
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
        }),
      });

      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        console.error('Hugging Face API error:', hfResponse.status, errorText);
        const errorType = getErrorType(hfResponse.status, errorText);
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
      await incrementRateLimit(request, 'huggingface');
      await incrementRateLimit(request, 'ai-query');

      // Stream the response - HF's router follows the same OpenAI-style SSE
      // shape as OpenRouter, so this parsing loop mirrors that route's.
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let fullResponse = '';

          try {
            const reader = hfResponse.body?.getReader();
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
      console.error('Hugging Face API error:', error);
      // Security: Still increment rate limit on error (to prevent retry abuse)
      await incrementRateLimit(request, 'huggingface');
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
  // Security: Apply rate limiting to status check endpoint
  const rateLimitResponse = await applyRateLimit(request, 'stats');
  if (rateLimitResponse) {
    try {
      const errorData = await rateLimitResponse.json();
      return NextResponse.json(errorData, {
        status: 429,
        headers: Object.fromEntries(rateLimitResponse.headers.entries())
      });
    } catch {
      return rateLimitResponse;
    }
  }

  const status = await getRateLimitStatus(request, 'huggingface');
  await incrementRateLimit(request, 'stats');

  return NextResponse.json({
    shouldHide: status.isBlocked,
    count: status.count,
    limit: status.limit,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
}
