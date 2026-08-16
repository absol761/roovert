import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET } from './route';
import { MODELS, OPENROUTER_MODELS, HUGGINGFACE_MODELS } from '../../lib/models';

vi.mock('../../lib/security/rateLimit', () => ({
  applyRateLimit: vi.fn(),
}));

import { applyRateLimit } from '../../lib/security/rateLimit';

function makeRequest() {
  return new NextRequest('http://localhost/api/models');
}

describe('GET /api/models', () => {
  beforeEach(() => {
    vi.mocked(applyRateLimit).mockReset();
  });

  it('returns every model from MODELS, OPENROUTER_MODELS, and HUGGINGFACE_MODELS', async () => {
    vi.mocked(applyRateLimit).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(MODELS.length + OPENROUTER_MODELS.length + HUGGINGFACE_MODELS.length);
    expect(body.models).toHaveLength(body.count);
  });

  it('maps each model to only id, name, description, category, and requiresMultiPerspective', async () => {
    vi.mocked(applyRateLimit).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.models[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      requiresMultiPerspective: expect.any(Boolean),
    });
    // apiId is internal (used to call the provider) and should not leak publicly
    expect(body.models[0]).not.toHaveProperty('apiId');
  });

  it('flags only the multi-perspective model as requiring multi-perspective mode', async () => {
    vi.mocked(applyRateLimit).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    const flagged = body.models.filter((m: { requiresMultiPerspective: boolean }) => m.requiresMultiPerspective);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].id).toBe('multi-perspective');
  });

  it('sets a public, cacheable Cache-Control header', async () => {
    vi.mocked(applyRateLimit).mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=3600');
  });

  it('returns a 429 with the rate limit payload when the client is rate limited', async () => {
    const rateLimitBody = { error: 'Too many requests. Please wait.', retryAfter: 30 };
    vi.mocked(applyRateLimit).mockResolvedValue(
      NextResponse.json(rateLimitBody, { status: 429, headers: { 'Retry-After': '30' } })
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual(rateLimitBody);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('returns a 500 with a generic error message when something throws unexpectedly', async () => {
    vi.mocked(applyRateLimit).mockRejectedValue(new Error('redis unreachable'));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to load models' });
  });
});
