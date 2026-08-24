import { NextRequest, NextResponse } from 'next/server';
import { MODELS, OPENROUTER_MODELS, HUGGINGFACE_MODELS } from '../../lib/models';
import { applyRateLimit } from '../../lib/security/rateLimit';
import { getAvailableProviderModels } from '../../lib/providers';

/**
 * Public catalog of models available through this app.
 * Derived directly from app/lib/models.ts (the app's single source of
 * truth for model metadata) so this endpoint can't drift out of sync
 * with the model picker in app/page.tsx.
 *
 * Also the one place `getAvailableProviderModels()` (app/lib/providers.ts)
 * is called for client consumption: that function's result depends on
 * which provider API-key env vars are actually set on the server, so it
 * can never be imported into app/page.tsx (a client component) directly -
 * doing so would either try to bundle server env access into client code
 * or just silently evaluate to [] in the browser. Instead, page.tsx fetches
 * this route on mount (see app/hooks/useAvailableProviderModels.ts, which
 * mirrors the existing poll-on-mount pattern in
 * app/hooks/useProviderRateLimits.ts) and merges `providerModels` into its
 * `availableModels` alongside the static MODELS/OPENROUTER_MODELS/
 * HUGGINGFACE_MODELS arrays. With no provider keys configured (the default
 * for a fresh deployment/template checkout), `providerModels` is simply
 * `[]` and the picker behaves exactly as it did before this field existed.
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Rate limiting - read-only, publicly-cacheable data
    const rateLimitResponse = await applyRateLimit(request, 'stats');
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

    const allModels = [...MODELS, ...OPENROUTER_MODELS, ...HUGGINGFACE_MODELS];

    const models = allModels.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      category: model.category,
      requiresMultiPerspective: model.id === 'multi-perspective',
    }));

    // Never let a malformed CUSTOM_PROVIDERS env var (or any other
    // unexpected error inside the registry) take this whole endpoint down -
    // providers.ts already degrades individual bad entries to [] internally,
    // but this call is still wrapped so a client fetch always gets valid
    // JSON back with an empty provider list in the worst case, rather than
    // a 500.
    let providerModels: ReturnType<typeof getAvailableProviderModels> = [];
    try {
      providerModels = getAvailableProviderModels();
    } catch (error) {
      console.error('Provider models lookup failed:', error);
    }

    return NextResponse.json(
      {
        models,
        providerModels,
        count: models.length,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // Deliberately NOT cached like the static `models` list above -
          // provider availability can change at runtime (a deployer adding
          // an API key without a full redeploy - see the doc comment on
          // getAvailableProviders in providers.ts), and this response is
          // small/cheap enough that there's no real cost to always
          // recomputing it.
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Models API Error:', error);
    return NextResponse.json(
      { error: 'Failed to load models' },
      { status: 500 }
    );
  }
}
