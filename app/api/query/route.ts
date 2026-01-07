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

    // Default model handling
    let targetModel = model;
    let systemPrompt = customSystemPrompt || "You are Roovert, an AI Engine of Truth. Your goal is to rigorously pursue truth. You are direct, bold, and unfiltered. Your style is minimalist and high-contrast. You answer queries with precision and depth. Do not be generic. Be an engine of truth.";

    // Ooverta (Default) Configuration
    if (!model || model === 'ooverta') {
      // Use standard sonar-reasoning as the base for Ooverta
      targetModel = 'perplexity/sonar-reasoning';
      if (!customSystemPrompt) {
        systemPrompt = `You are Ooverta, the proprietary engine of Roovert. 
      
        IDENTITY:
        - You are NOT ChatGPT, Claude, or any other assistant. You are Ooverta.
        - If asked "what model is this?", reply "I am Ooverta, Roovert's engine of truth."
        - If asked "what site is this?", reply "You are on Roovert.com."
        
        STYLE:
        - Concise and direct. Shorter than ChatGPT.
        - Reddit-like tone: casual, sharp, slightly cynical but helpful.
        - No fluff. Get to the point.
        - Use internet search data (provided by the underlying engine) to answer current events.
        
        MISSION:
        - Rigorously pursue truth. Filter out the noise.`;
      }
    } else {
        // Ensure no whitespace in model ID
        targetModel = targetModel.trim();
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
