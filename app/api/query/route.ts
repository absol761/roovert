import { NextRequest, NextResponse } from 'next/server';

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
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
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

    // Ooverta (Default) Configuration
    if (!model || model === 'ooverta') {
      // Use standard sonar-reasoning as the base for Ooverta
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
        - Use internet search data (provided by the underlying engine) to answer current events if needed.`;
      }
    } else {
      // Map model ID to API ID if it exists in the map, otherwise use the model ID directly
      targetModel = MODEL_MAP[model] || model.trim();
    }

    const respondWithSimulation = (reason: string) =>
      NextResponse.json({
        response: buildSimulationResponse(userQuery, reason, modelLabel),
        warning: reason,
        simulated: true,
        timestamp: new Date().toISOString(),
        query: userQuery,
      });

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is missing');
      return respondWithSimulation('OpenRouter API key missing');
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
        max_tokens: 1000,
      }),
    });

    if (!upstream.ok) {
        const errorText = await upstream.text();
        console.error('OpenRouter API error:', upstream.status, errorText);
        
        let errorMessage = `Provider Error (${upstream.status})`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
                errorMessage = errorJson.error.message;
            }
        } catch (e) {
            errorMessage += `: ${errorText.substring(0, 100)}`;
        }

        // Clarify generic "User not found" errors from OpenRouter
        if (errorMessage.includes('User not found')) {
            errorMessage = 'OpenRouter Key Invalid: Ensure the key in Vercel matches your OpenRouter dashboard.';
        } else if (errorMessage.includes('No endpoints found')) {
            // Auto-fallback if the default model fails
            if (modelLabel === 'ooverta') {
                console.warn('Ooverta default model failed, falling back to Llama.');
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
                            ]
                        })
                    });
                    if (fallback.ok) {
                        const fallbackData = await fallback.json();
                        return NextResponse.json({
                            response: fallbackData.choices?.[0]?.message?.content || 'No response.',
                            timestamp: new Date().toISOString(),
                            query: userQuery,
                            warning: 'Primary engine offline; rerouted to backup intelligence.'
                        });
                    }
                } catch(e) { console.error('Fallback failed', e); }
            }
            errorMessage = `No providers online for model "${targetModel}". Try a different model.`;
        }
        
        return respondWithSimulation(errorMessage);
    }

    const data = await upstream.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated.';

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
      query: userQuery,
    });

  } catch (error: any) {
    console.error('Query processing error:', error);
    const reason = error?.message || 'Failed to process query';
    return NextResponse.json({
      response: buildSimulationResponse(userQuery, reason, modelLabel),
      warning: reason,
      simulated: true,
      timestamp: new Date().toISOString(),
      query: userQuery,
    });
  }
}
