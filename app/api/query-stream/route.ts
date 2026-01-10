import { NextRequest } from 'next/server';

// Route segment config - increase timeout and allow larger bodies
export const maxDuration = 60; // 60 seconds for image processing
export const runtime = 'nodejs';

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
    let payload;
    try {
      payload = await request.json();
    } catch (jsonError: any) {
      // Handle JSON parsing errors (often caused by payload too large)
      if (jsonError.message && jsonError.message.includes('body')) {
        return new Response(
          JSON.stringify({ error: 'Payload too large. Please compress your image or use a smaller file.' }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw jsonError;
    }
    
    const { query, model, systemPrompt: customSystemPrompt, conversationHistory, image } = payload;
    
    // Security: Validate image size on server side
    const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
    if (image && typeof image === 'string') {
      // Base64 images are ~33% larger than binary
      // 20MB binary ≈ 26.6MB base64
      const base64Size = image.length * 0.75; // Approximate binary size
      if (base64Size > MAX_IMAGE_SIZE) {
        return new Response(
          JSON.stringify({ error: 'Image too large. Maximum 20MB allowed.' }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Input validation: Query
    const MAX_QUERY_LENGTH = 10000; // characters
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

    // Input validation: System prompt
    const MAX_SYSTEM_PROMPT_LENGTH = 2000; // characters
    if (customSystemPrompt && typeof customSystemPrompt === 'string' && customSystemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `System prompt too long. Maximum ${MAX_SYSTEM_PROMPT_LENGTH} characters allowed.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Input validation: Conversation history
    const MAX_HISTORY_LENGTH = 50; // messages
    if (conversationHistory && Array.isArray(conversationHistory)) {
      if (conversationHistory.length > MAX_HISTORY_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Conversation history too long. Maximum ${MAX_HISTORY_LENGTH} messages allowed.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Validate each message structure
      for (const msg of conversationHistory) {
        if (!msg || typeof msg !== 'object') {
          return new Response(
            JSON.stringify({ error: 'Invalid message format in conversation history' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
          return new Response(
            JSON.stringify({ error: 'Invalid message role. Must be "user" or "assistant"' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (!msg.content || (typeof msg.content !== 'string' && !Array.isArray(msg.content))) {
          return new Response(
            JSON.stringify({ error: 'Invalid message content format' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Validate content length if string
        if (typeof msg.content === 'string' && msg.content.length > MAX_QUERY_LENGTH) {
          return new Response(
            JSON.stringify({ error: `Message content too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    userQuery = query;
    modelLabel = model || 'ooverta';

    // Build conversation history from provided history
    // conversationHistory should be an array of { role: 'user' | 'assistant', content: string }
    const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://roovert.com';
    const siteName = 'Roovert';

    // Model ID to API ID mapping - ALLOWLIST ONLY
    const MODEL_MAP: Record<string, string> = {
      'ooverta': 'google/gemini-2.0-flash-exp:free', // Changed to reliable Gemini model
      'gemini-flash': 'google/gemini-2.0-flash-exp:free',
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
    
    // Security: Validate model against allowlist to prevent injection
    const ALLOWED_MODEL_IDS = new Set(Object.keys(MODEL_MAP));

    // If image is provided, use vision-capable model
    // Default to Gemini 2.0 Flash for vision if no model specified or if current model doesn't support vision
    const visionModels = ['google/gemini-2.0-flash-exp:free', 'google/gemini-flash-1.5:free', 'google/gemini-pro', 'meta-llama/llama-4-maverick:free'];
    const needsVision = !!image;
    const currentModelSupportsVision = model && visionModels.includes(MODEL_MAP[model] || model);

    // Default model handling
    let targetModel = model;
    let systemPrompt = customSystemPrompt || "You are a helpful, intelligent, and precise AI assistant. Answer the user's questions clearly and accurately.";

    // Ooverta (Default) Configuration - Optimized for speed
    if (!model || model === 'ooverta') {
      if (needsVision) {
        // Use Gemini for vision by default
        targetModel = 'google/gemini-2.0-flash-exp:free';
      } else {
        targetModel = 'perplexity/sonar-reasoning';
      }
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
        - Keep responses concise and focused for faster delivery.
        ${needsVision ? '- You can see and analyze images. Describe what you see clearly and accurately.' : ''}`;
      }
    } else {
      // Security: Validate model ID against allowlist
      if (!ALLOWED_MODEL_IDS.has(model)) {
        return new Response(
          JSON.stringify({ error: 'Invalid model specified. Please select a model from the allowed list.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Look up model in allowlist
      targetModel = MODEL_MAP[model];
      
      if (!targetModel) {
        return new Response(
          JSON.stringify({ error: 'Model not found in allowlist' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // If image provided but model doesn't support vision, switch to Gemini
      if (needsVision && !currentModelSupportsVision) {
        console.warn(`Model ${targetModel} doesn't support vision, switching to Gemini 2.0 Flash`);
        targetModel = 'google/gemini-2.0-flash-exp:free';
      }
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
          // Build messages array with conversation history
          // Content can be string or array (for vision)
          type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
          const messages: Array<{ 
            role: 'system' | 'user' | 'assistant'; 
            content: MessageContent 
          }> = [
            {
              role: 'system',
              content: systemPrompt
            }
          ];

          // Add conversation history if provided (already validated above)
          if (conversationHistory && Array.isArray(conversationHistory)) {
            // Limit to last MAX_HISTORY_LENGTH messages to prevent memory issues
            const limitedHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
            // Add history messages
            for (const msg of limitedHistory) {
              if (msg.role && msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
                messages.push({
                  role: msg.role,
                  content: msg.content as MessageContent // Can be string or array for vision
                });
              }
            }
          }

          // Add current user query with image if present
          if (image) {
            // Vision format: array with text and image
            messages.push({
              role: 'user',
              content: [
                { type: 'text', text: userQuery },
                { type: 'image_url', image_url: { url: image } }
              ]
            });
          } else {
            // Standard format: string only
            messages.push({
              role: 'user',
              content: userQuery,
            });
          }

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
              messages: messages,
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

            // Fallback for ooverta - try multiple reliable models
            if (modelLabel === 'ooverta') {
              const fallbackModels = [
                'deepseek/deepseek-r1-0528:free',
                'nousresearch/hermes-3-llama-3.1-405b:free',
                'nvidia/nemotron-3-nano-30b-a3b:free',
              ];
              
              for (const fallbackModel of fallbackModels) {
                try {
                  // Build fallback messages with conversation history
                  type FallbackMessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
                  const fallbackMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: FallbackMessageContent }> = [
                    { role: 'system', content: systemPrompt }
                  ];
                  
                  if (conversationHistory && Array.isArray(conversationHistory)) {
                    for (const msg of conversationHistory) {
                      if (msg.role && msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
                        fallbackMessages.push({
                          role: msg.role,
                          content: msg.content as FallbackMessageContent
                        });
                      }
                    }
                  }
                  
                  // Add current message with image if present
                  if (image) {
                    fallbackMessages.push({
                      role: 'user',
                      content: [
                        { type: 'text', text: userQuery },
                        { type: 'image_url', image_url: { url: image } }
                      ]
                    });
                  } else {
                    fallbackMessages.push({ role: 'user', content: userQuery });
                  }

                  const fallback = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${apiKey}`,
                      'HTTP-Referer': siteUrl,
                      'X-Title': siteName,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: fallbackModel,
                      messages: fallbackMessages,
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
                            if (line.trim() === 'data: [DONE]') {
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
                              controller.close();
                              return;
                            }
                            
                            const data = JSON.parse(line.slice(6));
                            if (data.choices?.[0]?.delta?.content) {
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: data.choices[0].delta.content, done: false })}\n\n`));
                            }
                            if (data.choices?.[0]?.finish_reason) {
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
                              controller.close();
                              return;
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
                  console.error(`Fallback to ${fallbackModel} failed:`, e);
                  continue; // Try next fallback model
                }
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

          // DoS protection: Set limits for streaming
          const MAX_STREAM_DURATION = 60 * 1000; // 60 seconds
          const MAX_RESPONSE_LENGTH = 100000; // 100k characters
          const startTime = Date.now();
          let totalLength = 0;

          while (true) {
            // Check timeout
            if (Date.now() - startTime > MAX_STREAM_DURATION) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n[Stream timeout - response too long]', done: true })}\n\n`));
              controller.close();
              return;
            }

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
                  // Check response length limit
                  totalLength += content.length;
                  if (totalLength > MAX_RESPONSE_LENGTH) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n[Response too long - truncated]', done: true })}\n\n`));
                    controller.close();
                    return;
                  }
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

