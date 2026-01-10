import { NextResponse } from 'next/server';

/**
 * Model Availability Checker
 * 
 * Checks which models are available based on token limits and API errors.
 * Models that have failed recently (rate limits, quota exceeded, etc.) are marked as unavailable.
 * 
 * Refresh interval: Every 5 minutes
 */

// In-memory cache for model availability (in production, use Redis/KV)
const modelAvailabilityCache = new Map<string, {
  available: boolean;
  lastChecked: number;
  errorCount: number;
  lastError?: string;
}>();

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Error patterns that indicate token/quota exhaustion
const TOKEN_EXHAUSTED_PATTERNS = [
  /rate limit/i,
  /quota exceeded/i,
  /limit exceeded/i,
  /insufficient quota/i,
  /billing/i,
  /payment required/i,
  /429/i, // Too Many Requests
  /402/i, // Payment Required
];

// Error patterns that indicate temporary unavailability
const TEMPORARY_ERROR_PATTERNS = [
  /provider error/i,
  /service unavailable/i,
  /timeout/i,
  /503/i,
  /502/i,
  /504/i,
];

/**
 * Check if a model is available by making a test request
 */
async function checkModelAvailability(modelApiId: string): Promise<{ available: boolean; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  
  if (!apiKey) {
    return { available: false, error: 'API key not configured' };
  }

  try {
    // Make a minimal test request (1 token max)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://roovert.com',
        'X-Title': 'Roovert',
      },
      body: JSON.stringify({
        model: modelApiId,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1, // Minimal token usage for testing
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 100)}`;
      }

      // Check if it's a token/quota error
      const isTokenExhausted = TOKEN_EXHAUSTED_PATTERNS.some(pattern => 
        pattern.test(errorMessage) || pattern.test(errorText)
      );

      if (isTokenExhausted) {
        return { available: false, error: 'Token/quota exhausted' };
      }

      // Check if it's a temporary error
      const isTemporary = TEMPORARY_ERROR_PATTERNS.some(pattern => 
        pattern.test(errorMessage) || pattern.test(errorText)
      );

      if (isTemporary) {
        // Temporary errors don't mark model as unavailable, just log
        return { available: true, error: 'Temporary error (will retry)' };
      }

      // Other errors mark as unavailable
      return { available: false, error: errorMessage };
    }

    // If we get here, model is available
    return { available: true };
  } catch (error: any) {
    return { available: false, error: error.message || 'Network error' };
  }
}

/**
 * GET /api/model-availability
 * Returns which models are currently available
 */
export async function GET() {
  try {
    const now = Date.now();
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({
        available: {},
        error: 'API key not configured',
      });
    }

    // Model ID to API ID mapping
    const MODEL_MAP: Record<string, string> = {
      'ooverta': 'google/gemini-2.0-flash-exp:free',
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

    const availability: Record<string, boolean> = {};
    const checks: Promise<void>[] = [];

    // Check each model (with rate limiting - check max 3 at a time)
    const modelIds = Object.keys(MODEL_MAP);
    
    for (const modelId of modelIds) {
      const cached = modelAvailabilityCache.get(modelId);
      
      // Use cache if still valid
      if (cached && (now - cached.lastChecked) < CACHE_DURATION) {
        availability[modelId] = cached.available;
        continue;
      }

      // Check model availability (throttled)
      const checkPromise = (async () => {
        const modelApiId = MODEL_MAP[modelId];
        const result = await checkModelAvailability(modelApiId);
        
        // Update cache
        modelAvailabilityCache.set(modelId, {
          available: result.available,
          lastChecked: now,
          errorCount: result.available ? 0 : (cached?.errorCount || 0) + 1,
          lastError: result.error,
        });

        availability[modelId] = result.available;
      })();

      checks.push(checkPromise);

      // Rate limit: check 3 models at a time, wait 500ms between batches
      if (checks.length >= 3) {
        await Promise.all(checks);
        checks.length = 0;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Wait for remaining checks
    if (checks.length > 0) {
      await Promise.all(checks);
    }

    // Default all to available if no checks were made (use cache)
    for (const modelId of modelIds) {
      if (availability[modelId] === undefined) {
        const cached = modelAvailabilityCache.get(modelId);
        availability[modelId] = cached?.available ?? true; // Default to available
      }
    }

    return NextResponse.json({
      available: availability,
      timestamp: new Date().toISOString(),
      cacheAge: Math.max(...Array.from(modelAvailabilityCache.values()).map(c => now - c.lastChecked), 0),
    });
  } catch (error: any) {
    console.error('Model availability check error:', error);
    return NextResponse.json({
      available: {},
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * POST /api/model-availability
 * Report a model error (called when a model fails during use)
 */
export async function POST(request: Request) {
  try {
    const { modelId, error } = await request.json();

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID required' }, { status: 400 });
    }

    const now = Date.now();
    const cached = modelAvailabilityCache.get(modelId);
    
    // Check if error indicates token exhaustion
    const errorMessage = error?.message || error?.toString() || '';
    const isTokenExhausted = TOKEN_EXHAUSTED_PATTERNS.some(pattern => 
      pattern.test(errorMessage)
    );

    if (isTokenExhausted) {
      // Mark as unavailable
      modelAvailabilityCache.set(modelId, {
        available: false,
        lastChecked: now,
        errorCount: (cached?.errorCount || 0) + 1,
        lastError: errorMessage,
      });
    } else {
      // Increment error count but don't mark unavailable yet
      // (might be temporary)
      modelAvailabilityCache.set(modelId, {
        available: cached?.available ?? true,
        lastChecked: now,
        errorCount: (cached?.errorCount || 0) + 1,
        lastError: errorMessage,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
