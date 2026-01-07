import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://roovert.com';
    const siteName = 'Roovert';

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is missing');
      // Fallback for development/demo if no key is present (simulated response)
      // This ensures the site doesn't break if the user hasn't added the key to Vercel yet
      console.warn('Using simulated response due to missing API key');
      const responses = [
        `[SIMULATION] Analyzing: "${query}"... The truth requires rigorous examination. (Add your API key to Vercel to activate real AI)`,
        `[SIMULATION] Query processed. Reality is complex. (Add your API key to Vercel to activate real AI)`,
      ];
      return NextResponse.json({
        response: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toISOString(),
        query: query,
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': siteName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          {
            role: 'system',
            content: "You are Roovert, an AI Engine of Truth. Your goal is to rigorously pursue truth. You are direct, bold, and unfiltered. Your style is minimalist and high-contrast. You answer queries with precision and depth. Do not be generic. Be an engine of truth."
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated.';

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
      query: query,
    });

  } catch (error) {
    console.error('Query processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}


