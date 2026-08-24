import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock '@vercel/kv' directly (the same pattern app/api/feedback/route.test.ts
// and app/api/track/route.test.ts use) so the KV-first path can be driven
// and made to fail without a real network client. This route has no SQLite
// fallback of its own - it silently degrades to a "simulation" success when
// KV isn't configured, so no 'fs'/'better-sqlite3' mocking is needed here.
const kvMock = { set: vi.fn(), incr: vi.fn(), get: vi.fn() };
vi.mock('@vercel/kv', () => ({ kv: kvMock }));

// The shared rate limiter also reads KV_REST_API_URL/TOKEN as a fallback
// (via app/lib/redis.ts) for its own Redis-backed counters - see
// app/api/feedback/route.test.ts and app/api/track/route.test.ts for the
// same interaction. Force it onto its in-memory store so only this route's
// own KV branch is under test.
vi.mock('@/app/lib/redis', () => ({ getRedis: vi.fn(() => null) }));

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(body: unknown, headers: Record<string, string> = {}, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/visit', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers, 'x-forwarded-for': ip },
  });
}

const ENV_KEYS = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
  kvMock.set.mockReset();
  kvMock.incr.mockReset();
  kvMock.get.mockReset();
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe('POST /api/visit - validation', () => {
  it('rejects an invalid JSON body', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest('not-json'));
    expect(response.status).toBe(400);
  });

  it('rejects a request whose declared Content-Length exceeds the 1MB limit', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ visitorId: 'v1' }, { 'content-length': String(2 * 1024 * 1024) }));
    expect(response.status).toBe(400);
  });

  it('rejects a missing visitorId', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Visitor ID required');
  });

  it('rate-limits after the shared "tracking" bucket is exhausted (60/min)', async () => {
    const ip = freshIp();
    const { POST } = await import('./route');
    for (let i = 0; i < 60; i++) {
      const response = await POST(makeRequest({ visitorId: 'v1' }, {}, ip));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(makeRequest({ visitorId: 'v1' }, {}, ip));
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/visit - no KV configured (simulation fallback)', () => {
  it('reports a silent success without ever touching KV', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ visitorId: 'v1' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.mode).toBe('simulation');
    expect(kvMock.set).not.toHaveBeenCalled();
  });
});

describe('POST /api/visit - KV path', () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';
  });

  it('increments the counter and returns isNew: true for a brand-new visitor', async () => {
    kvMock.set.mockResolvedValue('OK'); // NX succeeded - genuinely new
    kvMock.incr.mockResolvedValue(9);

    const { POST } = await import('./route');
    const response = await POST(makeRequest({ visitorId: 'new-visitor' }));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.count).toBe(9);
    expect(kvMock.set).toHaveBeenCalledWith('visitor:new-visitor', '1', { ex: 86400 * 365, nx: true });
  });

  it('stores a fingerprint-to-visitorId mapping for a new visitor when a fingerprint is provided', async () => {
    kvMock.set.mockResolvedValue('OK');
    kvMock.incr.mockResolvedValue(1);

    const { POST } = await import('./route');
    await POST(makeRequest({ visitorId: 'new-visitor', fingerprint: 'fp-abc123' }));

    expect(kvMock.set).toHaveBeenCalledWith('fp:fp-abc123', 'new-visitor', { ex: 86400 * 365 });
  });

  it('does not increment the counter for a returning visitor, and returns the current count instead', async () => {
    kvMock.set.mockResolvedValue(null); // NX failed - visitor key already exists
    kvMock.get.mockResolvedValue(42);

    const { POST } = await import('./route');
    const response = await POST(makeRequest({ visitorId: 'returning-visitor' }));
    const body = await response.json();
    expect(body.isNew).toBe(false);
    expect(body.count).toBe(42);
    expect(kvMock.incr).not.toHaveBeenCalled();
  });

  it('falls back to simulation mode when the KV write itself throws', async () => {
    kvMock.set.mockRejectedValue(new Error('kv unavailable'));

    const { POST } = await import('./route');
    const response = await POST(makeRequest({ visitorId: 'v1' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.mode).toBe('simulation');
  });

  it('coerces a string count from KV.get to a number for a returning visitor', async () => {
    kvMock.set.mockResolvedValue(null);
    kvMock.get.mockResolvedValue('7'); // Upstash can return numeric strings
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ visitorId: 'returning-visitor' }));
    const body = await response.json();
    expect(body.count).toBe(7);
    expect(typeof body.count).toBe('number');
  });
});
