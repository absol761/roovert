import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { MODELS, OPENROUTER_MODELS, HUGGINGFACE_MODELS } from '../../lib/models';
import * as providers from '../../lib/providers';
import * as rateLimit from '../../lib/security/rateLimit';

// ---------------------------------------------------------------------------
// Request-construction helpers - mirrors the conventions in
// app/api/provider/route.test.ts (real NextRequest, a fresh IP per test so
// the shared 'stats' rate-limit bucket never leaks between tests).
// ---------------------------------------------------------------------------

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/models', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

const ENV_KEYS = ['CEREBRAS_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'DEEPSEEK_API_KEY', 'TOGETHER_API_KEY', 'CUSTOM_PROVIDERS'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  vi.restoreAllMocks();
});

describe('GET /api/models', () => {
  it('returns the full static catalog (MODELS + OPENROUTER_MODELS + HUGGINGFACE_MODELS) with a matching count', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();

    const expectedTotal = MODELS.length + OPENROUTER_MODELS.length + HUGGINGFACE_MODELS.length;
    expect(body.models.length).toBe(expectedTotal);
    expect(body.count).toBe(expectedTotal);
  });

  it('flags exactly the multi-perspective model with requiresMultiPerspective', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    const flagged = body.models.filter((m: { requiresMultiPerspective: boolean }) => m.requiresMultiPerspective);
    expect(flagged.map((m: { id: string }) => m.id)).toEqual(['multi-perspective']);
  });

  it('does not leak apiId (used only server-side to call the provider) in the public catalog', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    for (const model of body.models) {
      expect(model).not.toHaveProperty('apiId');
    }
  });

  it('returns an empty providerModels array when no provider API keys are configured', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.providerModels).toEqual([]);
  });

  it('includes provider-registry models once a built-in provider key is set, independently of the static catalog', async () => {
    process.env.CEREBRAS_API_KEY = 'test-cerebras-key';
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.providerModels.length).toBeGreaterThan(0);
    expect(body.providerModels.every((m: { id: string }) => m.id.startsWith('cerebras-'))).toBe(true);
    // The static catalog is untouched by provider configuration.
    expect(body.models.length).toBe(MODELS.length + OPENROUTER_MODELS.length + HUGGINGFACE_MODELS.length);
  });

  it('degrades to an empty providerModels array instead of a 500 when the provider registry throws', async () => {
    vi.spyOn(providers, 'getAvailableProviderModels').mockImplementation(() => {
      throw new Error('malformed CUSTOM_PROVIDERS');
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.providerModels).toEqual([]);
    // The rest of the response must still be intact.
    expect(body.models.length).toBe(MODELS.length + OPENROUTER_MODELS.length + HUGGINGFACE_MODELS.length);
  });

  it('returns a 500 with a generic error message when something throws unexpectedly', async () => {
    vi.spyOn(rateLimit, 'applyRateLimit').mockRejectedValue(new Error('redis unreachable'));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to load models' });
  });

  it('is never cached (always revalidated), unlike a typical static catalog response', async () => {
    const response = await GET(makeRequest());
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rate-limits after 100 requests/minute from the same IP (the lenient "stats" bucket)', async () => {
    const ip = freshIp();
    for (let i = 0; i < 100; i++) {
      const response = await GET(makeRequest(ip));
      expect(response.status).toBe(200);
    }
    const blocked = await GET(makeRequest(ip));
    expect(blocked.status).toBe(429);
  });
});
