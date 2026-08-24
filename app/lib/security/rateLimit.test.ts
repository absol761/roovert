import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  getClientIP,
  checkRateLimit,
  incrementRateLimit,
  createRateLimitResponse,
  applyRateLimit,
  getRateLimitStatus,
  shouldHideOpenRouterModels,
} from './rateLimit';

type MockRequest = { headers: { get: (key: string) => string | null } };
type EndpointType = Parameters<typeof applyRateLimit>[1];
type CustomConfig = Parameters<typeof applyRateLimit>[2];

// Build a minimal duck-typed request object (matches the `{ headers: { get } }`
// shape every function in rateLimit.ts accepts - no need for a real NextRequest).
function mockRequest(headers: Record<string, string> = {}): MockRequest {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: {
      get: (key: string) => lower.get(key.toLowerCase()) ?? null,
    },
  };
}

// The in-memory store backing rate limiting is module-level state that is
// keyed by (endpointType, windowMs, maxRequests, identifierType, identifier)
// and isn't reset between tests. Giving every test its own IP (via
// x-forwarded-for) keeps tests independent without needing to reach into
// module internals.
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}
function requestFromIp(ip: string): MockRequest {
  return mockRequest({ 'x-forwarded-for': ip });
}

async function consumeTimes(
  request: MockRequest,
  endpointType: EndpointType,
  config: CustomConfig,
  times: number
): Promise<Response | null> {
  let last: Response | null = null;
  for (let i = 0; i < times; i++) {
    last = await applyRateLimit(request, endpointType, config);
  }
  return last;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getClientIP', () => {
  it('trusts the last hop of x-forwarded-for (the value the proxy appended)', () => {
    const request = mockRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
    expect(getClientIP(request)).toBe('9.10.11.12');
  });

  it('trims whitespace and ignores empty hops in x-forwarded-for', () => {
    const request = mockRequest({ 'x-forwarded-for': '1.2.3.4,  , 9.10.11.12 ,' });
    expect(getClientIP(request)).toBe('9.10.11.12');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const request = mockRequest({ 'x-real-ip': '8.8.8.8' });
    expect(getClientIP(request)).toBe('8.8.8.8');
  });

  it('falls back to cf-connecting-ip when neither forwarded header is present', () => {
    const request = mockRequest({ 'cf-connecting-ip': '1.1.1.1' });
    expect(getClientIP(request)).toBe('1.1.1.1');
  });

  it('returns "unknown" when no identifying headers are present', () => {
    const request = mockRequest({});
    expect(getClientIP(request)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip and cf-connecting-ip when all are present', () => {
    const request = mockRequest({
      'x-forwarded-for': '2.2.2.2',
      'x-real-ip': '3.3.3.3',
      'cf-connecting-ip': '4.4.4.4',
    });
    expect(getClientIP(request)).toBe('2.2.2.2');
  });
});

describe('applyRateLimit', () => {
  it('allows requests under the limit, returning null', async () => {
    const request = requestFromIp(freshIp());
    const result = await applyRateLimit(request, 'general', { maxRequests: 5, windowMs: 60_000 });
    expect(result).toBeNull();
  });

  it('allows exactly maxRequests requests, then rejects the next one (boundary)', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 3, windowMs: 60_000 };

    expect(await applyRateLimit(request, 'general', config)).toBeNull();
    expect(await applyRateLimit(request, 'general', config)).toBeNull();
    expect(await applyRateLimit(request, 'general', config)).toBeNull();

    const blocked = await applyRateLimit(request, 'general', config);
    expect(blocked).not.toBeNull();
    expect(blocked).toBeInstanceOf(Response);
    expect(blocked?.status).toBe(429);
  });

  it('returns a 429 response with the correct headers and body once the limit is exceeded', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 1, windowMs: 60_000 };

    expect(await applyRateLimit(request, 'general', config)).toBeNull();
    const blocked = await applyRateLimit(request, 'general', config);

    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Content-Type')).toBe('application/json');
    expect(blocked?.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(blocked?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
    expect(Number(blocked?.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(blocked?.headers.get('X-RateLimit-Reset')).toBeTruthy();

    const body = await blocked?.json();
    expect(body.error).toBe('Rate limit exceeded. Please try again later.');
    expect(typeof body.retryAfter).toBe('number');
    expect(typeof body.resetAt).toBe('string');
  });

  it('rate-limits different IPs independently', async () => {
    const config: CustomConfig = { maxRequests: 1, windowMs: 60_000 };
    const requestA = requestFromIp(freshIp());
    const requestB = requestFromIp(freshIp());

    // Exhaust the quota for client A.
    expect(await applyRateLimit(requestA, 'general', config)).toBeNull();
    const blockedA = await applyRateLimit(requestA, 'general', config);
    expect(blockedA).not.toBeNull();
    expect(blockedA?.status).toBe(429);

    // Client B has never made a request, so it must still be allowed.
    const allowedB = await applyRateLimit(requestB, 'general', config);
    expect(allowedB).toBeNull();
  });

  it('rate-limits different endpoint types independently for the same IP', async () => {
    const ip = freshIp();
    const requestAI = requestFromIp(ip);
    const requestGeneral = requestFromIp(ip);
    const config: CustomConfig = { maxRequests: 1, windowMs: 60_000 };

    expect(await applyRateLimit(requestAI, 'ai-query', config)).toBeNull();
    const blocked = await applyRateLimit(requestAI, 'ai-query', config);
    expect(blocked?.status).toBe(429);

    // Same IP, different endpoint bucket - should be unaffected.
    const allowed = await applyRateLimit(requestGeneral, 'general', config);
    expect(allowed).toBeNull();
  });

  it('falls back to the "Rate limit exceeded" message when no message is configured', async () => {
    const request = requestFromIp(freshIp());
    const unknownEndpoint = 'not-a-real-endpoint' as unknown as EndpointType;
    const config: CustomConfig = { maxRequests: 1, windowMs: 60_000 };

    expect(await applyRateLimit(request, unknownEndpoint, config)).toBeNull();
    const blocked = await applyRateLimit(request, unknownEndpoint, config);
    expect(blocked?.status).toBe(429);
    const body = await blocked?.json();
    expect(body.error).toBe('Rate limit exceeded');
  });

  it('slides the window: after it elapses, a previously blocked client is allowed again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 2, windowMs: 1_000 };

    expect(await applyRateLimit(request, 'general', config)).toBeNull();
    expect(await applyRateLimit(request, 'general', config)).toBeNull();
    const blocked = await applyRateLimit(request, 'general', config);
    expect(blocked?.status).toBe(429);

    // Still inside the window - stays blocked.
    vi.advanceTimersByTime(500);
    const stillBlocked = await applyRateLimit(request, 'general', config);
    expect(stillBlocked?.status).toBe(429);

    // Past the window - a fresh bucket should open up.
    vi.advanceTimersByTime(600);
    const allowedAgain = await applyRateLimit(request, 'general', config);
    expect(allowedAgain).toBeNull();
  });

  it('reports a resetAt in the future on the 429 response, consistent with the configured window', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(start);

    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 1, windowMs: 10_000 };
    expect(await applyRateLimit(request, 'general', config)).toBeNull();
    const blocked = await applyRateLimit(request, 'general', config);

    const body = await blocked?.json();
    const resetAt = new Date(body.resetAt).getTime();
    expect(resetAt).toBeGreaterThan(start.getTime());
    expect(resetAt).toBeLessThanOrEqual(start.getTime() + 10_000);
    expect(body.retryAfter).toBeLessThanOrEqual(10);
  });

  it('treats requests with no identifying headers as a shared "unknown" bucket', async () => {
    const requestA = mockRequest({});
    const requestB = mockRequest({});
    const config: CustomConfig = { maxRequests: 1, windowMs: 60_000 };

    // Two entirely unrelated "unknown" clients share one bucket, so the
    // second one gets blocked by the first's usage.
    expect(await applyRateLimit(requestA, 'general', config)).toBeNull();
    const blocked = await applyRateLimit(requestB, 'general', config);
    expect(blocked?.status).toBe(429);
  });
});

describe('checkRateLimit (non-consuming peek)', () => {
  it('does not consume quota - repeated peeks report the same remaining count', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 3, windowMs: 60_000 };

    const first = await checkRateLimit(request, 'general', config);
    const second = await checkRateLimit(request, 'general', config);
    const third = await checkRateLimit(request, 'general', config);

    expect(first).toEqual({ allowed: true, remaining: 3, resetAt: first.resetAt, limit: 3 });
    expect(second.remaining).toBe(3);
    expect(third.remaining).toBe(3);
  });

  it('reflects consumption performed via applyRateLimit', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 3, windowMs: 60_000 };

    await applyRateLimit(request, 'general', config);
    await applyRateLimit(request, 'general', config);

    const status = await checkRateLimit(request, 'general', config);
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(1);
    expect(status.limit).toBe(3);
  });

  it('reports allowed: false once the quota consumed elsewhere is exhausted', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 2, windowMs: 60_000 };

    await consumeTimes(request, 'general', config, 2);

    const status = await checkRateLimit(request, 'general', config);
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
  });
});

describe('getRateLimitStatus', () => {
  it('reports count, limit, remaining, and isBlocked for a partially used bucket', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 5, windowMs: 60_000 };

    await consumeTimes(request, 'general', config, 2);

    const status = await getRateLimitStatus(request, 'general', config);
    expect(status).toMatchObject({ count: 2, limit: 5, remaining: 3, isBlocked: false });
  });

  it('reports isBlocked: true once the bucket is exhausted', async () => {
    const request = requestFromIp(freshIp());
    const config: CustomConfig = { maxRequests: 2, windowMs: 60_000 };

    await consumeTimes(request, 'general', config, 2);

    const status = await getRateLimitStatus(request, 'general', config);
    expect(status.isBlocked).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('reports a fresh, unblocked status for a client that has never made a request', async () => {
    const request = requestFromIp(freshIp());
    const status = await getRateLimitStatus(request, 'general', { maxRequests: 5, windowMs: 60_000 });
    expect(status).toMatchObject({ count: 0, limit: 5, remaining: 5, isBlocked: false });
  });
});

describe('shouldHideOpenRouterModels', () => {
  it('returns false for a client under the openrouter quota', async () => {
    const request = requestFromIp(freshIp());
    expect(await shouldHideOpenRouterModels(request)).toBe(false);
  });

  it('returns true once a client has exhausted the openrouter quota (45/24h)', async () => {
    const request = requestFromIp(freshIp());
    await consumeTimes(request, 'openrouter', undefined, 45);
    expect(await shouldHideOpenRouterModels(request)).toBe(true);
  });

  it('does not affect other clients sharing no state with the exhausted one', async () => {
    const exhausted = requestFromIp(freshIp());
    const fresh = requestFromIp(freshIp());
    await consumeTimes(exhausted, 'openrouter', undefined, 45);

    expect(await shouldHideOpenRouterModels(exhausted)).toBe(true);
    expect(await shouldHideOpenRouterModels(fresh)).toBe(false);
  });
});

describe('incrementRateLimit (deprecated no-op)', () => {
  it('resolves without throwing and does not consume any quota', async () => {
    const request = requestFromIp(freshIp());
    await expect(incrementRateLimit(request, 'general')).resolves.toBeUndefined();
    await expect(incrementRateLimit(request, 'general')).resolves.toBeUndefined();

    // A caller that (per the real call sites) calls incrementRateLimit after
    // applyRateLimit should still have its full quota available afterward.
    const status = await getRateLimitStatus(request, 'general', { maxRequests: 5, windowMs: 60_000 });
    expect(status.count).toBe(0);
    expect(status.remaining).toBe(5);
  });
});

describe('endpoint bucket independence with real production configs', () => {
  // Unlike the tests above (which pass a custom config to isolate the
  // mechanism), these exercise the actual DEFAULT_LIMITS for 'provider'
  // (30/hour - see app/api/provider/route.ts), 'ai-query' (10/min),
  // 'openrouter' (45/24h), and 'huggingface' (30/hour) to pin down the
  // exact production boundary for the new provider route and confirm it
  // doesn't share state with any of the other three AI-query buckets.
  it('provider bucket (30/hour) allows exactly 30 requests then blocks the 31st (boundary)', async () => {
    const request = requestFromIp(freshIp());
    for (let i = 0; i < 30; i++) {
      expect(await applyRateLimit(request, 'provider')).toBeNull();
    }
    const blocked = await applyRateLimit(request, 'provider');
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it('exhausting the provider bucket does not affect ai-query/openrouter/huggingface for the same IP', async () => {
    const request = requestFromIp(freshIp());
    await consumeTimes(request, 'provider', undefined, 30);
    expect((await applyRateLimit(request, 'provider'))?.status).toBe(429); // confirm actually exhausted

    expect(await applyRateLimit(request, 'ai-query')).toBeNull();
    expect(await applyRateLimit(request, 'openrouter')).toBeNull();
    expect(await applyRateLimit(request, 'huggingface')).toBeNull();
  });

  it('exhausting ai-query (10/min) does not affect the provider bucket (30/hour) for the same IP', async () => {
    const request = requestFromIp(freshIp());
    await consumeTimes(request, 'ai-query', undefined, 10);
    expect((await applyRateLimit(request, 'ai-query'))?.status).toBe(429); // confirm actually exhausted

    const providerStatus = await checkRateLimit(request, 'provider');
    expect(providerStatus).toMatchObject({ allowed: true, remaining: 30, limit: 30 });
  });

  it('exhausting openrouter (45/24h) and huggingface (30/hour) does not affect the provider bucket for the same IP', async () => {
    const request = requestFromIp(freshIp());
    await consumeTimes(request, 'openrouter', undefined, 45);
    await consumeTimes(request, 'huggingface', undefined, 30);
    expect((await applyRateLimit(request, 'openrouter'))?.status).toBe(429);
    expect((await applyRateLimit(request, 'huggingface'))?.status).toBe(429);

    const providerStatus = await checkRateLimit(request, 'provider');
    expect(providerStatus).toMatchObject({ allowed: true, remaining: 30, limit: 30 });
  });

  it('different IPs each get their own independent 30/hour provider bucket', async () => {
    const requestA = requestFromIp(freshIp());
    const requestB = requestFromIp(freshIp());

    await consumeTimes(requestA, 'provider', undefined, 30);
    expect((await applyRateLimit(requestA, 'provider'))?.status).toBe(429);

    // B has made no requests yet - must still be fully allowed.
    const statusB = await checkRateLimit(requestB, 'provider');
    expect(statusB).toMatchObject({ allowed: true, remaining: 30, limit: 30 });
  });
});

describe('createRateLimitResponse', () => {
  it('builds a 429 response whose headers and body match the given result/config', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const resetAt = Date.now() + 30_000;

    const response = createRateLimitResponse(
      { allowed: false, remaining: 0, resetAt, limit: 10 },
      { windowMs: 60_000, maxRequests: 10, message: 'Custom limit message' }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(String(resetAt));

    const body = await response.json();
    expect(body).toEqual({
      error: 'Custom limit message',
      retryAfter: 30,
      resetAt: new Date(resetAt).toISOString(),
    });
  });

  it('falls back to the default error message when config.message is not set', async () => {
    const response = createRateLimitResponse(
      { allowed: false, remaining: 0, resetAt: Date.now() + 1000, limit: 1 },
      { windowMs: 1000, maxRequests: 1 }
    );
    const body = await response.json();
    expect(body.error).toBe('Rate limit exceeded');
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
    const request = requestFromIp(freshIp());

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
    const request = requestFromIp(freshIp());
    const config = { windowMs: 60_000, maxRequests: 1 };

    await redisApplyRateLimit(request, 'general', config);
    const blocked = await redisApplyRateLimit(request, 'general', config);

    expect(blocked?.status).toBe(429);
  });
});
