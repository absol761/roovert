import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// getRedis() is mocked to null for most tests below, forcing the in-memory
// fallback path (the memoryStore Map is module-level state). Tests use
// unique identifiers per case (via distinct IPs/user ids) to avoid
// cross-test pollution of that shared store.
vi.mock('../redis', () => ({
  getRedis: vi.fn(() => null),
}));

import {
  getClientIP,
  getUserIdentifier,
  checkRateLimit,
  applyRateLimit,
  incrementRateLimit,
  createRateLimitResponse,
  getRateLimitStatus,
} from './rateLimit';

function makeRequest(headers: Record<string, string>) {
  const map = new Map(Object.entries(headers));
  return {
    headers: {
      get: (key: string) => map.get(key.toLowerCase()) ?? null,
    },
  };
}

let ipCounter = 0;
function uniqueIP(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

describe('getClientIP', () => {
  it('prefers the first x-forwarded-for entry when present', () => {
    const request = makeRequest({
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      'x-real-ip': '9.9.9.9',
    });

    expect(getClientIP(request)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const request = makeRequest({ 'x-real-ip': '9.9.9.9' });

    expect(getClientIP(request)).toBe('9.9.9.9');
  });

  it('falls back to cf-connecting-ip when the other two headers are absent', () => {
    const request = makeRequest({ 'cf-connecting-ip': '8.8.8.8' });

    expect(getClientIP(request)).toBe('8.8.8.8');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const request = makeRequest({});

    expect(getClientIP(request)).toBe('unknown');
  });
});

describe('getUserIdentifier', () => {
  it('returns the x-user-id header when present', () => {
    const request = makeRequest({ 'x-user-id': 'user-123' });

    expect(getUserIdentifier(request)).toBe('user-123');
  });

  it('returns null when x-user-id is absent', () => {
    const request = makeRequest({});

    expect(getUserIdentifier(request)).toBeNull();
  });
});

describe('checkRateLimit (in-memory, read-only)', () => {
  it('reports the full quota available for a request that has never consumed', async () => {
    const request = makeRequest({ 'x-forwarded-for': uniqueIP() });

    const result = await checkRateLimit(request, 'general');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(30);
    expect(result.limit).toBe(30);
  });

  it('does not consume quota, so repeated calls report the same remaining count', async () => {
    const request = makeRequest({ 'x-forwarded-for': uniqueIP() });

    const first = await checkRateLimit(request, 'general');
    const second = await checkRateLimit(request, 'general');

    expect(first.remaining).toBe(second.remaining);
  });
});

describe('applyRateLimit (in-memory, consuming)', () => {
  it('allows a request within the configured limit and returns null', async () => {
    const request = makeRequest({ 'x-forwarded-for': uniqueIP() });

    const response = await applyRateLimit(request, 'huggingface-image');

    expect(response).toBeNull();
  });

  it('blocks a request once maxRequests has been consumed', async () => {
    const ip = uniqueIP();
    const config = { windowMs: 60_000, maxRequests: 2 };

    await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);
    await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);
    const thirdResponse = await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);

    expect(thirdResponse).not.toBeNull();
    expect(thirdResponse?.status).toBe(429);
  });

  it('tracks separate identifiers independently', async () => {
    const config = { windowMs: 60_000, maxRequests: 1 };
    const ipA = uniqueIP();
    const ipB = uniqueIP();

    const firstA = await applyRateLimit(makeRequest({ 'x-forwarded-for': ipA }), 'general', config);
    const firstB = await applyRateLimit(makeRequest({ 'x-forwarded-for': ipB }), 'general', config);

    expect(firstA).toBeNull();
    expect(firstB).toBeNull();
  });

  it('rate-limits by user identifier instead of IP when x-user-id is present', async () => {
    const config = { windowMs: 60_000, maxRequests: 1 };
    const request1 = makeRequest({ 'x-user-id': 'shared-user', 'x-forwarded-for': uniqueIP() });
    const request2 = makeRequest({ 'x-user-id': 'shared-user', 'x-forwarded-for': uniqueIP() });

    const first = await applyRateLimit(request1, 'general', config);
    const second = await applyRateLimit(request2, 'general', config);

    // Same user id, different IPs -> still counted against the same bucket.
    expect(first).toBeNull();
    expect(second).not.toBeNull();
  });

  it('includes Retry-After and X-RateLimit-* headers on a blocked response', async () => {
    const ip = uniqueIP();
    const config = { windowMs: 60_000, maxRequests: 1 };

    await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);
    const blocked = await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);

    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
    expect(blocked?.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(blocked?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('returns a JSON body with the configured error message when blocked', async () => {
    const ip = uniqueIP();
    const config = { windowMs: 60_000, maxRequests: 1 };

    await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'openrouter', config);
    const blocked = await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'openrouter', config);

    const body = await blocked?.json();
    expect(body.error).toMatch(/OpenRouter rate limit exceeded/);
  });
});

describe('incrementRateLimit', () => {
  it('is a no-op that does not affect the quota', async () => {
    const ip = uniqueIP();
    const config = { windowMs: 60_000, maxRequests: 1 };

    // If this incremented the counter, the very next applyRateLimit call
    // (the first real consumption) would already be blocked.
    await incrementRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);
    const response = await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);

    expect(response).toBeNull();
  });
});

describe('createRateLimitResponse', () => {
  it('builds a 429 with the configured message and rate-limit headers', async () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 5000, limit: 10 };
    const config = { windowMs: 60_000, maxRequests: 10, message: 'slow down' };

    const response = createRateLimitResponse(result, config);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('slow down');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  it('falls back to a default message when the config has none', async () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 5000, limit: 10 };
    const config = { windowMs: 60_000, maxRequests: 10 };

    const response = createRateLimitResponse(result, config);
    const body = await response.json();

    expect(body.error).toBe('Rate limit exceeded');
  });
});

describe('getRateLimitStatus', () => {
  it('reports isBlocked=false and correct count for an unconsumed bucket', async () => {
    const request = makeRequest({ 'x-forwarded-for': uniqueIP() });

    const status = await getRateLimitStatus(request, 'general');

    expect(status.isBlocked).toBe(false);
    expect(status.count).toBe(0);
    expect(status.remaining).toBe(30);
  });

  it('reports isBlocked=true and the consumed count after the limit is exceeded', async () => {
    const ip = uniqueIP();
    const config = { windowMs: 60_000, maxRequests: 1 };

    await applyRateLimit(makeRequest({ 'x-forwarded-for': ip }), 'general', config);
    const status = await getRateLimitStatus(makeRequest({ 'x-forwarded-for': ip }), 'general', config);

    expect(status.isBlocked).toBe(true);
    expect(status.count).toBe(1);
    expect(status.remaining).toBe(0);
  });
});

describe('rate limiting backed by Redis', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../redis');
    vi.resetModules();
  });

  it('uses redis incr/pexpire/pttl instead of the in-memory store when Redis is configured', async () => {
    const store = new Map<string, number>();
    const mockRedis = {
      incr: vi.fn(async (key: string) => {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      }),
      pexpire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 60_000),
      get: vi.fn(async (key: string) => store.get(key) ?? null),
    };

    vi.doMock('../redis', () => ({ getRedis: () => mockRedis }));

    const { applyRateLimit: redisApplyRateLimit } = await import('./rateLimit');
    const request = makeRequest({ 'x-forwarded-for': uniqueIP() });

    const response = await redisApplyRateLimit(request, 'general', { windowMs: 60_000, maxRequests: 5 });

    expect(response).toBeNull();
    expect(mockRedis.incr).toHaveBeenCalledTimes(1);
    expect(mockRedis.pexpire).toHaveBeenCalledTimes(1);
  });

  it('blocks once the Redis-backed counter exceeds maxRequests', async () => {
    const store = new Map<string, number>();
    const mockRedis = {
      incr: vi.fn(async (key: string) => {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      }),
      pexpire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 60_000),
      get: vi.fn(async (key: string) => store.get(key) ?? null),
    };

    vi.doMock('../redis', () => ({ getRedis: () => mockRedis }));

    const { applyRateLimit: redisApplyRateLimit } = await import('./rateLimit');
    const request = makeRequest({ 'x-forwarded-for': uniqueIP() });
    const config = { windowMs: 60_000, maxRequests: 1 };

    await redisApplyRateLimit(request, 'general', config);
    const blocked = await redisApplyRateLimit(request, 'general', config);

    expect(blocked?.status).toBe(429);
  });
});
