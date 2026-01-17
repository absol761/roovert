import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

// Route segment config
export const maxDuration = 60;
export const runtime = 'nodejs';

// Groq API configuration
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

function buildSimulationResponse(query: string, reason: string) {
  return [
    `Systems Notice: ${reason || 'AI Service Unavailable'}.`,
    'Roovert is running in local inference mode until the API is reachable.',
    '',
    `Focus: "${query?.trim() || 'awaiting a concrete prompt'}".`,
    '',
    'Immediate protocol:',
    '1. Add/verify GROQ_API_KEY in .env.local',
    '2. Restart the server if running locally.',
    '3. Re-run this query to resume intelligent responses.',
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

    // Check for Groq API key
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is missing');
      const simulation = buildSimulationResponse(query, 'Groq API key missing');
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

    // Model mapping for Groq Models
    const MODEL_MAP: Record<string, string> = {
      'ooverta': 'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b': 'llama-3.3-70b-versatile',
      'llama-3.1-8b': 'llama-3.1-8b-instant',
    };

    const ALLOWED_MODEL_IDS = new Set(Object.keys(MODEL_MAP));
    let targetModelId = 'llama-3.3-70b-versatile';

    // Model selection logic
    if (model && MODEL_MAP[model]) {
      targetModelId = MODEL_MAP[model];
    } else if (model && ALLOWED_MODEL_IDS.has(model)) {
      targetModelId = MODEL_MAP[model];
    }

    // Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // Add system prompt
    const systemPrompt = customSystemPrompt || "You are a helpful, intelligent, and precise AI assistant. Answer the user's questions clearly and accurately.";
    messages.push({ role: 'system', content: systemPrompt });

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const limitedHistory = conversationHistory.slice(-50);
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

    try {
      // Use Vercel AI SDK to stream the response via Groq Provider
      const result = await streamText({
        model: groq(targetModelId),
        messages: messages as any,
      });

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
            // Only try to send error if controller is still writable
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
      console.error('Groq API error:', error);
      const simulation = buildSimulationResponse(query, error?.message || 'Groq API request failed');
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
