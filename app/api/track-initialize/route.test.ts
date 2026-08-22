import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

// This route's fallback path goes through getDatabase() (../../lib/db),
// which opens a fixed on-disk path with no override - mock 'fs'/
// 'better-sqlite3' the same way app/lib/db.test.ts does so it runs against
// a real, in-memory SQLite database.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

vi.mock('better-sqlite3', async (importOriginal) => {
  const actual = (await importOriginal()) as { default: typeof import('better-sqlite3') };
  const ActualDatabase = actual.default;
  class InMemoryDatabase extends ActualDatabase {
    constructor(_path?: string, options?: ConstructorParameters<typeof ActualDatabase>[1]) {
      super(':memory:', options);
    }
  }
  return { default: InMemoryDatabase };
});

// rateLimit.ts shares the same getRedis() singleton this route uses for its
// own cooldown/counter logic - a mocked client needs incr/pexpire/pttl too
// (see app/api/stats/route.test.ts for the same interaction), or the rate
// limiter's own Redis-backed increment throws before this route's logic
// even runs.
const redisSetMock = vi.fn();
const redisIncrMock = vi.fn();
const redisGetMock = vi.fn();
function fakeRedisClient() {
  return {
    set: redisSetMock,
    incr: redisIncrMock,
    get: redisGetMock,
    pexpire: vi.fn(async () => 1),
    pttl: vi.fn(async () => -1),
  };
}
vi.mock('@/app/lib/redis', () => ({ getRedis: vi.fn(() => null) }));

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(method: 'POST' | 'GET', ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/track-initialize', {
    method,
    headers: { 'x-forwarded-for': ip },
  });
}

beforeEach(() => {
  vi.resetModules();
  redisSetMock.mockReset();
  redisIncrMock.mockReset();
  redisGetMock.mockReset();
  // rateLimit.ts calls redis.incr() on this same mocked client for its own
  // bucket counter (see the module-level comment above) - default it to a
  // low resolved count so the shared rate limiter never sees `undefined`
  // (which fails the `count <= maxRequests` check and 429s every request)
  // unless a specific test deliberately overrides this for the route's own
  // 'initialize_chat_clicks' increment.
  redisIncrMock.mockResolvedValue(1);
});

afterEach(() => {
  // vi.doMock overrides (used below to swap in a Redis client per-test)
  // outlive vi.resetModules() - it clears the module cache, not the doMock
  // registry - so without this, a doMock from one test leaks into the next
  // test's fresh import even though resetModules() ran in between.
  vi.doUnmock('@/app/lib/redis');
  vi.restoreAllMocks();
});

describe('POST /api/track-initialize - SQLite fallback (no Redis configured)', () => {
  it('records a click and returns counted: true', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.counted).toBe(true);
  });

  it('persists a real row in the initialize_clicks table', async () => {
    const { POST } = await import('./route');
    await POST(makeRequest('POST'));

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM initialize_clicks').get() as { count: number };
    expect(row.count).toBe(1);
  });

  it('rate-limits after the shared "tracking" bucket is exhausted (60/min)', async () => {
    const ip = freshIp();
    const { POST } = await import('./route');
    for (let i = 0; i < 60; i++) {
      const response = await POST(makeRequest('POST', ip));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(makeRequest('POST', ip));
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/track-initialize - Redis path', () => {
  beforeEach(() => {
    vi.doMock('@/app/lib/redis', () => ({ getRedis: vi.fn(() => fakeRedisClient()) }));
  });

  it('sets an atomic NX cooldown key and increments the counter on a fresh click', async () => {
    redisSetMock.mockResolvedValue('OK'); // NX succeeded - no prior cooldown
    redisIncrMock.mockResolvedValue(1);

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.counted).toBe(true);
    expect(redisIncrMock).toHaveBeenCalledWith('initialize_chat_clicks');
  });

  it('does not increment (and reports counted: false) when the cooldown is already active', async () => {
    redisSetMock.mockResolvedValue(null); // NX failed - key already exists

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.counted).toBe(false);
    // redisIncrMock is shared with the rate limiter's own bucket counter
    // (see the comment above fakeRedisClient), so assert on the specific
    // key this route's own counter increment would have used, not just
    // "never called at all".
    expect(redisIncrMock).not.toHaveBeenCalledWith('initialize_chat_clicks');
  });

  it('keys the cooldown by a SHA-256 hash of the client IP, never the raw IP (privacy)', async () => {
    redisSetMock.mockResolvedValue('OK');
    redisIncrMock.mockResolvedValue(1);

    const clientIp = '198.51.100.42';
    const { POST } = await import('./route');
    await POST(makeRequest('POST', clientIp));

    const [key] = redisSetMock.mock.calls[0] as [string, unknown, unknown];
    expect(key).not.toContain(clientIp);
    const expectedHash = createHash('sha256').update(clientIp).digest('hex');
    expect(key).toBe(`user_cooldown:${expectedHash}`);
  });

  it('uses the last entry of a multi-hop x-forwarded-for chain, not the first (spoofable) one', async () => {
    redisSetMock.mockResolvedValue('OK');
    redisIncrMock.mockResolvedValue(1);

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/track-initialize', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.99' },
    });
    await POST(request);

    const [key] = redisSetMock.mock.calls[0] as [string, unknown, unknown];
    const expectedHash = createHash('sha256').update('198.51.100.99').digest('hex');
    expect(key).toBe(`user_cooldown:${expectedHash}`);
  });

  it('falls back to SQLite when the Redis set call throws', async () => {
    redisSetMock.mockRejectedValue(new Error('redis unavailable'));

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.counted).toBe(true);

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM initialize_clicks').get() as { count: number };
    expect(row.count).toBe(1);
  });
});

describe('GET /api/track-initialize', () => {
  it('returns the current click count from SQLite when no Redis is configured', async () => {
    const { POST, GET } = await import('./route');
    await POST(makeRequest('POST'));
    await POST(makeRequest('POST'));

    const response = await GET(makeRequest('GET'));
    const body = await response.json();
    expect(body.users).toBe(2);
    expect(body.totalUsers).toBe(2);
  });

  it('returns zero counts (not an error) when nothing has been recorded yet', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest('GET'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toBe(0);
  });
});
