import { NextRequest } from 'next/server';

function buildSimulationResponse(query: string, reason: string, modelLabel: string) {
  const trimmed = query?.trim();
  const focusLine = trimmed
    ? `Focus: "${trimmed}".`
    : 'Focus: awaiting a concrete prompt.';

  return [
    `Systems Notice: ${reason || 'Upstream provider unavailable'}.`,
    'Roovert is running in local inference mode until OpenRouter is reachable.',
    '',
    focusLine,
    `Intended model: ${modelLabel}.`,
    '',
    'Immediate protocol:',
    '1. Add/verify OPENROUTER_API_KEY in Vercel → Project Settings → Environment Variables.',
    '2. Redeploy Roovert to restore live intelligence.',
    '3. Re-run this query to resume truth-grade responses.',
  ].join('\n');
}

export async function POST(request: NextRequest) {
  let userQuery = '';
  let modelLabel = 'ooverta';

  try {
    const payload = await request.json();
    const { query, model, systemPrompt: customSystemPrompt } = payload;
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    userQuery = query;
    modelLabel = model || 'ooverta';

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://roovert.com';
    const siteName = 'Roovert';

    // Model ID to API ID mapping
    const MODEL_MAP: Record<string, string> = {
      'ooverta': 'perplexity/sonar-reasoning',
      'gemini-flash': 'google/gemini-flash-1.5:free',
      'deepseek-free': 'deepseek/deepseek-r1-0528:free',
      'nemotron-30b': 'nvidia/nemotron-3-nano-30b-a3b:free',
      'llama-405b': 'nousresearch/hermes-3-llama-3.1-405b:free',
      'gpt-4o': 'openai/gpt-4o',
      'claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
      'perplexity': 'perplexity/sonar-reasoning',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'claude-3-opus': 'anthropic/claude-3-opus',
      'claude-3-haiku': 'anthropic/claude-3-haiku',
      'gemini-pro': 'google/gemini-pro',
      'llama-3-70b': 'meta-llama/llama-3-70b-instruct',
      'mistral-large': 'mistralai/mistral-large',
      'qwen-2-5': 'qwen/qwen-2.5-72b-instruct',
      'pi-mini': 'inflection/inflection-pi',
      'command-r-plus': 'cohere/command-r-plus',
      'llama-3-1-8b': 'meta-llama/llama-3.1-8b-instruct',
    };

    // Default model handling
    let targetModel = model;
    let systemPrompt = customSystemPrompt || "You are a helpful, intelligent, and precise AI assistant. Answer the user's questions clearly and accurately.";

    // Ooverta (Default) Configuration - Optimized for speed
    if (!model || model === 'ooverta') {
      targetModel = 'perplexity/sonar-reasoning';
      if (!customSystemPrompt) {
        systemPrompt = `You are Ooverta, a helpful AI assistant on Roovert.com.
      
        IDENTITY:
        - You are Ooverta.
        - If asked "what model is this?", reply "I am Ooverta, an AI model developed by Roovert. I am being improved as you are reading this!"
        - If asked "what site is this?", reply "You are on Roovert.com, a pretty neat site!"
        
        STYLE:
        - Be helpful, clear, and direct.
        - Provide accurate information.
        - Use internet search data (provided by the underlying engine) to answer current events if needed.
        - Keep responses concise and focused for faster delivery.`;
      }
    } else {
      targetModel = MODEL_MAP[model] || model.trim();
    }

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is missing');
      const simulation = buildSimulationResponse(userQuery, 'OpenRouter API key missing', modelLabel);
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

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': siteUrl,
              'X-Title': siteName,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: targetModel,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt
                },
                {
                  role: 'user',
                  content: userQuery,
                },
              ],
              temperature: 0.7,
              max_tokens: 2000,
              stream: true, // Enable streaming
            }),
          });

          if (!upstream.ok) {
            const errorText = await upstream.text();
            let errorMessage = `Provider Error (${upstream.status})`;
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error && errorJson.error.message) {
                errorMessage = errorJson.error.message;
              }
            } catch (e) {
              errorMessage += `: ${errorText.substring(0, 100)}`;
            }

            // Fallback for ooverta
            if (modelLabel === 'ooverta' && errorMessage.includes('No endpoints found')) {
              try {
                const fallback = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': siteUrl,
                    'X-Title': siteName,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'nousresearch/hermes-3-llama-3.1-405b:free',
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: userQuery }
                    ],
                    stream: true,
                  })
                });
                
                if (fallback.ok) {
                  const reader = fallback.body?.getReader();
                  const decoder = new TextDecoder();
                  
                  if (reader) {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      
                      const chunk = decoder.decode(value);
                      const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
                      
                      for (const line of lines) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          if (data.choices?.[0]?.delta?.content) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: data.choices[0].delta.content, done: false })}\n\n`));
                          }
                          if (data.choices?.[0]?.finish_reason) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
                          }
                        } catch (e) {
                          // Skip invalid JSON
                        }
                      }
                    }
                    controller.close();
                    return;
                  }
                }
              } catch (e) {
                console.error('Fallback failed', e);
              }
            }

            const simulation = buildSimulationResponse(userQuery, errorMessage, modelLabel);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: simulation, done: true })}\n\n`));
            controller.close();
            return;
          }

          const reader = upstream.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            controller.close();
            return;
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

            for (const line of lines) {
              try {
                if (line.trim() === 'data: [DONE]') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
                  controller.close();
                  return;
                }

                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content || '';
                const finishReason = data.choices?.[0]?.finish_reason;

                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`));
                }

                if (finishReason) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
                  controller.close();
                  return;
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        } catch (error: any) {
          console.error('Streaming error:', error);
          const simulation = buildSimulationResponse(userQuery, error?.message || 'Streaming failed', modelLabel);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: simulation, done: true })}\n\n`));
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
    console.error('Query processing error:', error);
    const simulation = buildSimulationResponse(userQuery, error?.message || 'Failed to process query', modelLabel);
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

