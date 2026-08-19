/**
 * Generic OpenAI-compatible provider route.
 *
 * Serves every provider registered in app/lib/providers.ts (Cerebras,
 * Gemini, Mistral, plus anything a deployer adds via the CUSTOM_PROVIDERS
 * env var) through a single route, instead of one hand-written route file
 * per backend the way app/api/openrouter and app/api/huggingface are.
 *
 * REQUEST CONTRACT: same JSON body shape as the openrouter/huggingface
 * routes (query, model, systemPrompt?, conversationHistory?, image?,
 * outputLength?), validated with the exact same
 * validateAIQueryRequest/validateModelId allowlist pattern - see
 * app/lib/security/validation.ts. The one difference: `model` is REQUIRED
 * here (checked just below validation) rather than defaulting to a
 * specific model, because this route has no single sensible default
 * across an open-ended set of providers.
 *
 * `model` must be one of the flattened ids produced by
 * getAvailableProviderModels() in app/lib/providers.ts (i.e.
 * `${providerId}-${modelId}`, e.g. "cerebras-llama-3.3-70b") - see that
 * file for why ids are namespaced this way. It is NEVER used for anything
 * other than a registry lookup; see the security note in providers.ts.
 *
 * RESPONSE CONTRACT: identical SSE shape to app/api/openrouter/route.ts -
 * a stream of `data: {"content": string, "done": boolean}\n\n` lines,
 * terminated by `data: {"content": "", "done": true}\n\n`. This matches
 * what the existing frontend already parses, so no frontend change is
 * needed to consume this route once something wires a model picker entry
 * to it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit, getRateLimitStatus } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, historyContentToText, MAX_LENGTHS } from '../../lib/security/validation';
import { getAvailableProviderModels, findAvailableProviderModel } from '../../lib/providers';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const;

function sseMessage(content: string, done: boolean): string {
  return `data: ${JSON.stringify({ content, done })}\n\n`;
}

// User-friendly error messages - NEVER expose internal API details (which
// provider, what the upstream error body said, etc).
function getUserFriendlyErrorMessage(errorType: 'unavailable' | 'rate_limit' | 'credits' | 'timeout' | 'generic'): string {
  const messages: Record<string, string> = {
    unavailable: "I'm temporarily unable to process your request. This model may be experiencing high demand. Please try a different model or try again in a moment.",
    rate_limit: "You've reached the request limit for this session. Please wait a few minutes before trying again.",
    credits: 'This model is temporarily unavailable. Please try a different model or try again later.',
    timeout: 'The request took too long to process. Please try again with a shorter message or a faster model.',
    generic: 'Something went wrong while processing your request. Please try again or select a different model.',
  };
  return messages[errorType] || messages.generic;
}

// Parse upstream API errors into one of a small set of user-facing types -
// mirrors app/api/openrouter/route.ts's getErrorType, generalized since
// the upstream here can be any OpenAI-compatible provider rather than
// specifically OpenRouter.
function getErrorType(statusCode: number, errorBody: string): 'unavailable' | 'rate_limit' | 'credits' | 'timeout' | 'generic' {
  if (statusCode === 402 || errorBody.includes('credits') || errorBody.includes('afford')) {
    return 'credits';
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
    // Security: Rate limiting - apply before processing, same as every
    // other AI query route.
    const rateLimitResponse = await applyRateLimit(request, 'ai-query');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Security: separate bucket for this route specifically - see the
    // 'provider' entry in app/lib/security/rateLimit.ts for why this gets
    // its own bucket rather than sharing 'ai-query'.
    const providerRateLimitResponse = await applyRateLimit(request, 'provider');
    if (providerRateLimitResponse) {
      return new Response(sseMessage(getUserFriendlyErrorMessage('rate_limit'), true), {
        status: 429,
        headers: SSE_HEADERS,
      });
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

    // Security: Model allowlist - built fresh per request from only the
    // providers whose API key env var is currently set. A model belonging
    // to a configured-but-keyless provider (or to no provider at all)
    // simply isn't in this set, so validateModelId rejects it the same
    // way it rejects a made-up id - this is what makes the route hide
    // unavailable providers automatically, mirroring the openrouter/
    // huggingface routes' own key-presence gating.
    const ALLOWED_MODEL_IDS = new Set(getAvailableProviderModels().map((m) => m.id));

    // Security: Strict input validation with schema (shared with every
    // other AI query route - see app/lib/security/validation.ts)
    const validation = validateAIQueryRequest(payload, ALLOWED_MODEL_IDS);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image, outputLength } = validation.sanitized!;

    // Unlike openrouter/huggingface, this route has no single sensible
    // default model to fall back to across an open-ended set of
    // providers, so `model` is required here even though
    // validateAIQueryRequest treats it as optional in general.
    if (!model) {
      return createValidationErrorResponse(['model is required']);
    }

    // Security: resolve the validated model id back to its provider entry.
    // Always expected to succeed here since `model` already passed the
    // allowlist above, but this is re-checked defensively (e.g. a key
    // theoretically disappearing between building the allowlist and this
    // lookup) rather than assumed, so a race never falls through to using
    // an undefined provider.
    const resolved = findAvailableProviderModel(model);
    if (!resolved) {
      console.error(`Provider route: model "${model}" passed allowlist validation but could not be resolved to a provider.`);
      return new Response(sseMessage(getUserFriendlyErrorMessage('unavailable'), true), { headers: SSE_HEADERS });
    }
    const { provider, model: providerModel } = resolved;

    const apiKey = process.env[provider.apiKeyEnvVar];
    if (!apiKey) {
      // Should be unreachable (getAvailableProviderModels already filters
      // on this), but never send an unauthenticated request upstream.
      console.error(`Provider route: ${provider.apiKeyEnvVar} is missing from environment variables`);
      return new Response(sseMessage(getUserFriendlyErrorMessage('unavailable'), true), { headers: SSE_HEADERS });
    }

    // Response length control - mirrors query-gateway/openrouter/
    // huggingface's maxTokensMap so the setting has the same effect
    // regardless of which provider handles the model.
    const maxTokensMap = { small: 800, medium: 2000, large: 4000 };
    const maxTokens = maxTokensMap[outputLength as 'small' | 'medium' | 'large'] || maxTokensMap.medium;

    // Security: Content moderation - check for offensive content
    const queryCheck = containsOffensiveContent(query);
    if (queryCheck.isOffensive) {
      return new Response(
        sseMessage("I apologize, but I cannot assist with that type of request. Please ask me something else, and I'll be happy to help.", true),
        { headers: SSE_HEADERS }
      );
    }

    // Security: Increment rate limit after successful validation
    await incrementRateLimit(request, 'ai-query');

    // Build messages - same shape/order as app/api/openrouter/route.ts:
    // system prompt, then validated history collapsed to text (dropping
    // any history image data, never the accompanying caption text - see
    // historyContentToText's doc comment), then the current turn
    // (multimodal if an image was attached).
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    const systemPrompt = getSystemPrompt(customSystemPrompt);
    messages.push({ role: 'system', content: systemPrompt });

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
          messages.push({ role: msg.role, content: textContent });
        }
      }
    }

    if (image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: query },
          { type: 'image_url', image_url: { url: image } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: query });
    }

    try {
      const providerResponse = await fetch(provider.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Bearer auth is the OpenAI SDK's own convention and is what
          // every OpenAI-compatible provider/self-hosted server here
          // expects - see the apiKeyEnvVar doc comment in providers.ts.
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: providerModel.apiId,
          messages,
          stream: true,
          max_tokens: maxTokens,
        }),
      });

      if (!providerResponse.ok) {
        const errorText = await providerResponse.text();
        console.error(`Provider API error (${provider.id}):`, providerResponse.status, errorText);
        const errorType = getErrorType(providerResponse.status, errorText);
        return new Response(sseMessage(getUserFriendlyErrorMessage(errorType), true), { headers: SSE_HEADERS });
      }

      // Security: Increment rate limit after successful request
      await incrementRateLimit(request, 'provider');
      await incrementRateLimit(request, 'ai-query');

      // Stream the response - identical SSE parsing loop to
      // app/api/openrouter/route.ts, since every provider here speaks the
      // same OpenAI-style `data: {...}` chunked format.
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let fullResponse = '';

          try {
            const reader = providerResponse.body?.getReader();
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
                    controller.enqueue(encoder.encode(sseMessage(content, false)));
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }

            // Final content moderation check
            const { filtered, wasFiltered } = filterResponse(fullResponse);
            if (wasFiltered) {
              controller.enqueue(encoder.encode(sseMessage('\n\n' + filtered, false)));
            }

            controller.enqueue(encoder.encode(sseMessage('', true)));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            try {
              controller.enqueue(encoder.encode(sseMessage(getUserFriendlyErrorMessage('generic'), true)));
            } catch { }
            try { controller.close(); } catch { }
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...SSE_HEADERS,
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (error) {
      console.error(`Provider API error (${provider.id}):`, error);
      // Security: Still increment rate limit on error (to prevent retry abuse)
      await incrementRateLimit(request, 'provider');
      await incrementRateLimit(request, 'ai-query');
      return new Response(sseMessage(getUserFriendlyErrorMessage('generic'), true), { headers: SSE_HEADERS });
    }
  } catch (error) {
    console.error('Query processing error:', error);
    return new Response(sseMessage(getUserFriendlyErrorMessage('generic'), true), { headers: SSE_HEADERS });
  }
}

// GET endpoint to check rate limit status - mirrors the openrouter/
// huggingface routes' GET handlers for consistency, reporting the
// 'provider' bucket's status.
export async function GET(request: NextRequest) {
  // Security: Apply rate limiting to status check endpoint
  const rateLimitResponse = await applyRateLimit(request, 'stats');
  if (rateLimitResponse) {
    try {
      const errorData = await rateLimitResponse.json();
      return NextResponse.json(errorData, {
        status: 429,
        headers: Object.fromEntries(rateLimitResponse.headers.entries()),
      });
    } catch {
      return rateLimitResponse;
    }
  }

  const status = await getRateLimitStatus(request, 'provider');
  await incrementRateLimit(request, 'stats');

  return NextResponse.json({
    shouldHide: status.isBlocked,
    count: status.count,
    limit: status.limit,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
}
