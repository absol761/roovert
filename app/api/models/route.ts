import { NextRequest, NextResponse } from 'next/server';
import { MODELS, OPENROUTER_MODELS } from '../../lib/models';
import { applyRateLimit } from '../../lib/security/rateLimit';

/**
 * Public catalog of models available through this app.
 * Derived directly from app/lib/models.ts (the app's single source of
 * truth for model metadata) so this endpoint can't drift out of sync
 * with the model picker in app/page.tsx.
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

    const allModels = [...MODELS, ...OPENROUTER_MODELS];

    const models = allModels.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      category: model.category,
      requiresMultiPerspective: model.id === 'multi-perspective',
    }));

    return NextResponse.json(
      {
        models,
        count: models.length,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
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
