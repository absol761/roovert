import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt, filterResponse, containsOffensiveContent } from '../../lib/prompts';
import { applyRateLimit, incrementRateLimit, getRateLimitStatus, shouldHideOpenRouterModels } from '../../lib/security/rateLimit';
import { validateAIQueryRequest, validateBodySize, createValidationErrorResponse, MAX_LENGTHS } from '../../lib/security/validation';

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

function buildSimulationResponse(query: string, reason: string) {
  return [
    `Systems Notice: ${reason || 'AI Service Unavailable'}.`,
    'Roovert is running in local inference mode until the API is reachable.',
    '',
    `Focus: "${query?.trim() || 'awaiting a concrete prompt'}".`,
    '',
    'Immediate protocol:',
    '1. Add/verify OPENROUTER_API_KEY in .env.local',
    '2. Restart the server if running locally.',
    '3. Re-run this query to resume intelligent responses.',
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting - apply before processing
    const rateLimitResponse = applyRateLimit(request, 'ai-query');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Security: Check OpenRouter-specific rate limit (45/24hrs)
    if (shouldHideOpenRouterModels(request)) {
      const status = getRateLimitStatus(request, 'openrouter');
      return new Response(
        `data: ${JSON.stringify({ 
          content: `OpenRouter rate limit exceeded. You've used ${status.count} of ${status.limit} requests. The limit resets in ${Math.ceil((status.resetAt - Date.now()) / (1000 * 60 * 60))} hours.`, 
          done: true 
        })}\n\n`,
        {
          status: 429,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Retry-After': String(Math.ceil((status.resetAt - Date.now()) / 1000)),
          },
        }
      );
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

    // Security: Model allowlist - prevent model injection attacks (using top-level OPENROUTER_MODEL_MAP)
    const ALLOWED_MODEL_IDS = new Set(Object.keys(OPENROUTER_MODEL_MAP));

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
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is missing from environment variables');
      const simulation = buildSimulationResponse(query, 'OpenRouter API key missing');
      return new Response(
        `data: ${JSON.stringify({ content: simulation, done: true })}\n\n`,
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
    incrementRateLimit(request, 'ai-query');

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
        }),
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
      }

      // Security: Increment rate limit after successful request
      incrementRateLimit(request, 'openrouter');
      incrementRateLimit(request, 'ai-query');

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
          } catch (error: any) {
            console.error('Streaming error:', error);
            try {
              const errorMsg = buildSimulationResponse(query, error?.message || 'Streaming failed');
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: errorMsg, done: true })}\n\n`)
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
      console.error('OpenRouter API error:', error);
      // Security: Still increment rate limit on error (to prevent retry abuse)
      incrementRateLimit(request, 'openrouter');
      incrementRateLimit(request, 'ai-query');
      const simulation = buildSimulationResponse(query, error?.message || 'OpenRouter API request failed');
      return new Response(
        `data: ${JSON.stringify({ content: simulation, done: true })}\n\n`,
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
    const simulation = buildSimulationResponse('', error?.message || 'Failed to process query');
    return new Response(
      `data: ${JSON.stringify({ content: simulation, done: true })}\n\n`,
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
  const rateLimitResponse = applyRateLimit(request, 'stats');
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

  const status = getRateLimitStatus(request, 'openrouter');
  incrementRateLimit(request, 'stats');
  
  return NextResponse.json({
    shouldHide: status.isBlocked,
    count: status.count,
    limit: status.limit,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
}
