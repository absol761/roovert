import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, historyContentToText, MAX_LENGTHS } from '../../lib/security/validation';
import { HUGGINGFACE_MODEL_MAP, extractThinkChunks, type ThinkState } from '../../lib/huggingface';
import { sseError } from '../../lib/security/sse';
import { resolveMaxTokens } from '../../lib/ai/tokens';
import { parseOpenAISSEStream } from '../../lib/ai/parseOpenAISSEStream';

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

// One Multi-Perspective combine leg backed by an HF model instead of Groq -
// mirrors app/api/huggingface/route.ts's request/parsing (same router, same
// SSE shape) but enqueues onto this route's shared parallel-mode stream
// instead of returning its own Response, and tags each chunk with
// `selectedModel` so the client knows which combine slot it belongs to.
// Reasoning-capable HF models (Kimi K3, DeepSeek R1) still get their
// <think>/reasoning_content stripped via extractThinkChunks, but that
// reasoning is simply dropped here rather than forwarded - Multi-Perspective
// shows final answers side by side, not per-model chain-of-thought.
async function streamHuggingFaceLeg(
  selectedModel: string,
  hfModelId: string,
  hfMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  enqueue: (obj: Record<string, unknown>) => void,
  finishModel: () => void
) {
  try {
    if (!process.env.HUGGINGFACE_API_KEY) {
      enqueue({ model: selectedModel, content: getUserFriendlyErrorMessage(), done: true });
      return;
    }

    const hfResponse = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({ model: hfModelId, messages: hfMessages, stream: true }),
    });

    if (!hfResponse.ok || !hfResponse.body) {
      const errorText = hfResponse.body ? await hfResponse.text() : 'No response body';
      console.error(`Multi-perspective HF error (${selectedModel}):`, hfResponse.status, errorText);
      enqueue({ model: selectedModel, content: getUserFriendlyErrorMessage(), done: true });
      return;
    }

    let thinkState: ThinkState = { insideThink: false, pending: '' };

    for await (const delta of parseOpenAISSEStream(hfResponse.body)) {
      const content = delta?.content;
      if (typeof content === 'string' && content) {
        const result = extractThinkChunks(content, thinkState);
        thinkState = result.state;
        for (const chunk of result.chunks) {
          if (chunk.type === 'content') {
            enqueue({ model: selectedModel, content: chunk.text, done: false });
          }
        }
      }
    }

    enqueue({ model: selectedModel, content: '', done: true });
  } catch (error) {
    console.error(`Multi-perspective HF streaming error (${selectedModel}):`, error);
    enqueue({ model: selectedModel, content: getUserFriendlyErrorMessage(), done: true });
  } finally {
    finishModel();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting - apply before processing
    const rateLimitResponse = await applyRateLimit(request, 'ai-query');
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
    } catch (jsonError) {
      const jsonErrorMessage = jsonError instanceof Error ? jsonError.message : '';
      if (jsonErrorMessage && jsonErrorMessage.includes('body')) {
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
      // 'llama-4-scout' kept as a legacy alias so any client still holding
      // that old id in localStorage falls onto a working model instead of
      // erroring. Production's Groq org allows only a restricted model set
      // (no Llama chat models) - see Settings > Limits at console.groq.com.
      'ooverta': 'qwen/qwen3.6-27b',
      'llama-4-scout': 'qwen/qwen3.6-27b',
      'llama-3.3-70b': 'openai/gpt-oss-120b', // legacy alias
      'llama-3.1-8b': 'openai/gpt-oss-20b', // legacy alias
      'gpt-oss-120b': 'openai/gpt-oss-120b',
      'gpt-oss-20b': 'openai/gpt-oss-20b',
    };
    // Multi-Perspective's two combine slots (parallelModel1/2) can each be
    // either a Groq model or an HF model - both allowlists are validated
    // against here since validateAIQueryRequest checks `model`,
    // `parallelModel1`, and `parallelModel2` against the same set. Single
    // (non-parallel) `model` selection still only ever resolves against
    // MODEL_MAP below - an HF `model` id gracefully falls through to this
    // route's Groq default since single-mode HF requests go through
    // app/api/huggingface/route.ts instead, never through here.
    const ALLOWED_MODEL_IDS = new Set([...Object.keys(MODEL_MAP), ...Object.keys(HUGGINGFACE_MODEL_MAP)]);

    // Security: Strict input validation with schema
    const validation = validateAIQueryRequest(payload, ALLOWED_MODEL_IDS);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    // Use sanitized payload
    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image, runParallel, outputLength, parallelModel1, parallelModel2 } = validation.sanitized!;

    // Determine max_tokens based on outputLength
    const maxTokens = resolveMaxTokens(outputLength);

    // Security: Content moderation - check for offensive content
    const queryCheck = containsOffensiveContent(query);
    if (queryCheck.isOffensive) {
      return sseError("I apologize, but I cannot assist with that type of request. Please ask me something else, and I'll be happy to help.");
    }

    // Security: Increment rate limit after successful validation
    await incrementRateLimit(request, 'ai-query');

    // Security: API key validation - ensure key exists in environment (never exposed to client)
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is missing from environment variables');
      return sseError(getUserFriendlyErrorMessage());
    }

    // Security: Model selection - use validated model from allowlist only.
    // 'multi-perspective' is a routing sentinel, not a real Groq model id -
    // it's only meaningful via the parallel-mode branch below. If that
    // branch isn't taken (e.g. an image is attached, which forces the
    // single-model path), fall through to the default rather than calling
    // groq('multi-perspective'), which isn't a valid model.
    let targetModelId = 'llama-3.3-70b-versatile';
    if (model && model !== 'multi-perspective' && MODEL_MAP[model]) {
      targetModelId = MODEL_MAP[model];
    }

    // Build messages. System prompt is passed separately via streamText's
    // `instructions` param - the ai SDK (v7+) rejects role: 'system' entries
    // inside `messages` by default (prompt-injection hardening).
    const messages: Array<{
      role: 'user' | 'assistant';
      content: string | Array<
        | { type: 'text'; text: string }
        | { type: 'file'; data: URL; mediaType: string }
      >;
    }> = [];

    const systemPrompt = getSystemPrompt(customSystemPrompt);

    // Security: Validate and limit conversation history (already validated, but enforce limits)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const limitedHistory = conversationHistory.slice(-MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES);
      for (const msg of limitedHistory) {
        // Additional validation - ensure message structure is correct.
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
            content: textContent
          });
        }
      }
    }

    // Add current message
    if (image) {
      // `image` is a data: URL (e.g. "data:image/jpeg;base64,...") from the
      // client's FileReader.readAsDataURL - a valid URL, so pass it as the
      // ai SDK's `file` part rather than the removed `image`/`image_url` shape.
      const mediaTypeMatch = /^data:([^;,]+)/.exec(image);
      const mediaType = mediaTypeMatch?.[1] || 'image/jpeg';
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: query },
          { type: 'file', data: new URL(image), mediaType }
        ]
      });
    } else {
      messages.push({ role: 'user', content: query });
    }

    // Same conversation, reshaped for HF's OpenAI-compatible chat format
    // (system role inline, no `instructions` param, no file parts - a
    // Multi-Perspective leg on an HF model never carries the image branch
    // above since parallel mode is only entered when `!image`). Built
    // unconditionally but only ever sent over the wire if a combine slot
    // actually resolves to an HF model - see the dispatch below.
    const hfMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((m): m is { role: 'user' | 'assistant'; content: string } => typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      // If parallel mode is enabled and no image, use user-selected models
      if (runParallel && !image && parallelModel1 && parallelModel2) {
        // Use the two models selected by the user - genuinely stream BOTH
        // models concurrently, tagging each chunk with which model it came
        // from, so the client can render both answers side by side as they
        // arrive instead of silently discarding one.
        const selectedModels = [parallelModel1, parallelModel2];

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            let remaining = selectedModels.length;
            let closed = false;

            const enqueue = (obj: Record<string, unknown>) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
              } catch { /* controller already closed */ }
            };

            const finishModel = () => {
              remaining -= 1;
              if (remaining <= 0 && !closed) {
                enqueue({ content: '', done: true });
                closed = true;
                try { controller.close(); } catch { }
              }
            };

            selectedModels.forEach((selectedModel) => {
              // Each combine slot independently resolves to whichever
              // provider actually serves that model id - HF ids never
              // appear in MODEL_MAP (and vice versa), so this is a clean
              // either/or, not a fallback guess.
              const hfModelId = HUGGINGFACE_MODEL_MAP[selectedModel];
              if (hfModelId) {
                incrementRateLimit(request, 'huggingface').catch(() => {});
                streamHuggingFaceLeg(selectedModel, hfModelId, hfMessages, enqueue, finishModel);
                return;
              }

              const modelId = MODEL_MAP[selectedModel] || targetModelId;
              (async () => {
                // The AI SDK does NOT throw provider/network errors through
                // `textStream` - it only reports them via `onError`, so the
                // for-await loop below just ends silently (zero chunks) on
                // a failure like an invalid key or rate limit. Without this
                // flag that reads as a normal empty response instead of the
                // failure it actually was.
                let streamError: unknown = null;
                try {
                  const result = await streamText({
                    model: groq(modelId),
                    instructions: systemPrompt,
                    messages,
                    maxOutputTokens: maxTokens,
                    onError: ({ error }) => { streamError = error; },
                  });

                  for await (const chunk of result.textStream) {
                    enqueue({ model: selectedModel, content: chunk, done: false });
                  }

                  if (streamError) throw streamError;
                  enqueue({ model: selectedModel, content: '', done: true });
                } catch (error) {
                  console.error(`Multi-perspective streaming error (${selectedModel}):`, streamError ?? error);
                  enqueue({ model: selectedModel, content: getUserFriendlyErrorMessage(), done: true });
                } finally {
                  finishModel();
                }
              })();
            });
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

      // Single model mode (default or when image is present)
      // Use Vercel AI SDK to stream the response via Groq Provider
      // The AI SDK reports provider/network failures via `onError`, not by
      // throwing through `textStream` - without capturing it here, a failed
      // request (bad key, rate limit, etc.) silently ends the loop below
      // with zero chunks and looks identical to a normal empty response.
      let streamError: unknown = null;
      const result = await streamText({
        model: groq(targetModelId),
        instructions: systemPrompt,
        messages,
        maxOutputTokens: maxTokens,
        onError: ({ error }) => { streamError = error; },
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

            if (streamError) throw streamError;

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
            );
            controller.close();
          } catch (error) {
            console.error('Streaming error:', streamError ?? error);
            // Only try to send error if controller is still writable
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: getUserFriendlyErrorMessage(), done: true })}\n\n`)
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
      console.error('Groq API error:', error);
      return sseError(getUserFriendlyErrorMessage());
    }
  } catch (error) {
    console.error('Query processing error:', error);
    return sseError(getUserFriendlyErrorMessage());
  }
}
