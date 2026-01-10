import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

// Vercel AI Gateway configuration
const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;

function buildSimulationResponse(query: string, reason: string) {
  return [
    `Systems Notice: ${reason || 'AI Gateway unavailable'}.`,
    'Roovert is running in local inference mode until AI Gateway is reachable.',
    '',
    `Focus: "${query?.trim() || 'awaiting a concrete prompt'}".`,
    '',
    'Immediate protocol:',
    '1. Add/verify AI_GATEWAY_API_KEY in Vercel → Project Settings → Environment Variables.',
    '2. Redeploy Roovert to restore live intelligence.',
    '3. Re-run this query to resume truth-grade responses.',
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch (jsonError: any) {
      if (jsonError.message && jsonError.message.includes('body')) {
        return new Response(
          JSON.stringify({ error: 'Payload too large. Please compress your image or use a smaller file.' }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw jsonError;
    }

    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image } = payload;

    // Input validation
    const MAX_QUERY_LENGTH = 10000;
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const MAX_SYSTEM_PROMPT_LENGTH = 2000;
    if (customSystemPrompt && typeof customSystemPrompt === 'string' && customSystemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `System prompt too long. Maximum ${MAX_SYSTEM_PROMPT_LENGTH} characters allowed.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate conversation history
    const MAX_HISTORY_LENGTH = 50;
    if (conversationHistory && Array.isArray(conversationHistory)) {
      if (conversationHistory.length > MAX_HISTORY_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Conversation history too long. Maximum ${MAX_HISTORY_LENGTH} messages allowed.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for AI Gateway API key
    if (!gatewayApiKey) {
      console.error('AI_GATEWAY_API_KEY is missing');
      const simulation = buildSimulationResponse(query, 'AI Gateway API key missing');
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

    // Model mapping for AI Gateway
    const MODEL_MAP: Record<string, string> = {
      'ooverta': 'google/gemini-2.0-flash-exp:free',
      'gemini-flash': 'google/gemini-2.0-flash-exp:free',
      'gpt-4o': 'gpt-4o',
      'claude-3-5-sonnet': 'claude-3-5-sonnet',
      'claude-3-opus': 'claude-3-opus',
      'claude-3-haiku': 'claude-3-haiku',
    };

    const ALLOWED_MODEL_IDS = new Set(Object.keys(MODEL_MAP));
    let targetModel = model || 'ooverta';

    // Validate model
    if (model && !ALLOWED_MODEL_IDS.has(model)) {
      return new Response(
        JSON.stringify({ error: 'Invalid model specified. Please select a model from the allowed list.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (model && MODEL_MAP[model]) {
      targetModel = MODEL_MAP[model];
    } else if (!model || model === 'ooverta') {
      targetModel = 'google/gemini-2.0-flash-exp:free';
    }

    // Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // Add system prompt
    const systemPrompt = customSystemPrompt || "You are a helpful, intelligent, and precise AI assistant. Answer the user's questions clearly and accurately.";
    messages.push({ role: 'system', content: systemPrompt });

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const limitedHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
      for (const msg of limitedHistory) {
        if (msg.role && msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
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

    // Create OpenAI client configured for Vercel AI Gateway
    // Vercel AI Gateway uses the standard OpenAI-compatible API
    const openai = createOpenAI({
      apiKey: gatewayApiKey,
      // If using Vercel AI Gateway, the baseURL should be your gateway URL
      // For Cloudflare AI Gateway: 'https://gateway.ai.cloudflare.com/v1'
      // For custom gateway, set via AI_GATEWAY_BASE_URL env var
      baseURL: process.env.AI_GATEWAY_BASE_URL || 'https://gateway.ai.cloudflare.com/v1',
    });

    try {
      // Use Vercel AI SDK to stream the response
      const result = await streamText({
        model: openai(targetModel),
        messages: messages as any,
        maxTokens: 2000, // Note: Some models may use max_tokens in the model config
        temperature: 0.7,
      } as any); // Type assertion to handle SDK version differences

      // Convert to Server-Sent Events format
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            for await (const chunk of result.textStream) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`)
              );
            }
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
            );
            controller.close();
          } catch (error: any) {
            console.error('Streaming error:', error);
            const errorMsg = buildSimulationResponse(query, error?.message || 'Streaming failed');
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: errorMsg, done: true })}\n\n`)
            );
            controller.close();
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
      console.error('AI Gateway error:', error);
      const simulation = buildSimulationResponse(query, error?.message || 'AI Gateway request failed');
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
