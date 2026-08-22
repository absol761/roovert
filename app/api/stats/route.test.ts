import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// This route's stat comes from getRedis() (production) with a SQLite
// fallback via getDatabase() (local dev) - mock 'fs'/'better-sqlite3' the
// same way app/lib/db.test.ts does so the SQLite path runs against a real,
// in-memory database, and mock '@/app/lib/redis' directly (rather than the
// underlying @upstash/redis package) so the Redis path can be driven and
// made to fail without a real network client.
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

const redisGetMock = vi.fn();

// rateLimit.ts also calls getRedis() (via the same underlying module,
// resolved through a different relative specifier) for its own Redis-backed
// counters - a mocked client needs to support incr/pexpire/pttl too, or the
// rate-limiting call that runs before this route's own logic throws.
function fakeRedisClient() {
  return {
    get: redisGetMock,
    incr: vi.fn(async () => 1),
    pexpire: vi.fn(async () => 1),
    pttl: vi.fn(async () => -1),
  };
}

vi.mock('@/app/lib/redis', () => ({
  getRedis: vi.fn(() => null),
}));

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/stats', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

beforeEach(() => {
  vi.resetModules();
  redisGetMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/stats - SQLite fallback (no Redis configured)', () => {
  it('returns a zero count when no clicks have been recorded yet', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toBe(0);
    expect(body.totalUsers).toBe(0);
    expect(body.timestamp).toBeDefined();
  });

  it('reflects real rows inserted into the initialize_clicks table', async () => {
    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    db.exec('CREATE TABLE IF NOT EXISTS initialize_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, clicked_at INTEGER NOT NULL)');
    const insert = db.prepare('INSERT INTO initialize_clicks (clicked_at) VALUES (?)');
    insert.run(Date.now());
    insert.run(Date.now());
    insert.run(Date.now());

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.users).toBe(3);
    expect(body.totalUsers).toBe(3);
  });

  it('rate-limits after 100 requests/minute from the same IP (the lenient "stats" bucket)', async () => {
    const ip = freshIp();
    const { GET } = await import('./route');
    for (let i = 0; i < 100; i++) {
      const response = await GET(makeRequest(ip));
      expect(response.status).toBe(200);
    }
    const blocked = await GET(makeRequest(ip));
    expect(blocked.status).toBe(429);
  });
});

describe('GET /api/stats - Redis path', () => {
  it('uses the Redis count when a client is available, without touching SQLite', async () => {
    vi.doMock('@/app/lib/redis', () => ({
      getRedis: vi.fn(() => fakeRedisClient()),
    }));
    redisGetMock.mockResolvedValue(42);

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.users).toBe(42);
    expect(redisGetMock).toHaveBeenCalledWith('initialize_chat_clicks');
  });

  it('falls back to SQLite when the Redis call throws', async () => {
    vi.doMock('@/app/lib/redis', () => ({
      getRedis: vi.fn(() => fakeRedisClient()),
    }));
    redisGetMock.mockRejectedValue(new Error('redis unavailable'));

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    // No rows in the (empty, freshly created) in-memory SQLite fallback.
    expect(body.users).toBe(0);
  });

  it('never returns a negative count even if Redis somehow holds one', async () => {
    vi.doMock('@/app/lib/redis', () => ({
      getRedis: vi.fn(() => fakeRedisClient()),
    }));
    redisGetMock.mockResolvedValue(-5);

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.users).toBe(0);
  });
});

describe('GET /api/stats - resilience', () => {
  it('degrades to safe zero defaults (still HTTP 200) instead of a 500 on an unexpected failure', async () => {
    vi.doMock('@/app/lib/redis', () => ({
      getRedis: vi.fn(() => {
        throw new Error('totally unexpected failure');
      }),
    }));

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toBe(0);
    expect(body.totalUsers).toBe(0);
  });
});
