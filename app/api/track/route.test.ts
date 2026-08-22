import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createVisitorHash } from '../../lib/tracking';

// This route's fallback path goes through getDatabase() (../../lib/db),
// which opens a fixed on-disk path with no override - mock 'fs'/
// 'better-sqlite3' the same way app/lib/db.test.ts does so it runs against
// a real, in-memory SQLite database. Also mock '@vercel/kv' directly (the
// same pattern app/lib/share.test.ts and app/api/feedback/route.test.ts
// use) so the KV-first path can be driven and made to fail without a real
// network client.
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

const kvMock = { set: vi.fn(), incr: vi.fn(), get: vi.fn() };
vi.mock('@vercel/kv', () => ({ kv: kvMock }));

// This route checks KV_REST_API_URL/TOKEN directly, but so does the shared
// rate limiter (via app/lib/redis.ts's fallback to the same two env vars) -
// see app/api/feedback/route.test.ts for the same interaction. Force the
// rate limiter onto its in-memory store so only this route's own KV branch
// is under test.
vi.mock('@/app/lib/redis', () => ({ getRedis: vi.fn(() => null) }));

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(
  method: 'POST' | 'GET',
  headers: Record<string, string> = {},
  ip: string = freshIp()
): NextRequest {
  return new NextRequest('http://localhost/api/track', {
    method,
    headers: { 'user-agent': 'test-agent/1.0', ...headers, 'x-forwarded-for': ip },
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

describe('POST /api/track - validation', () => {
  it('rejects a request whose declared Content-Length exceeds the 1MB limit', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST', { 'content-length': String(2 * 1024 * 1024) }));
    expect(response.status).toBe(400);
  });

  it('rate-limits after the shared "tracking" bucket is exhausted (60/min)', async () => {
    const ip = freshIp();
    const { POST } = await import('./route');
    for (let i = 0; i < 60; i++) {
      const response = await POST(makeRequest('POST', {}, ip));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(makeRequest('POST', {}, ip));
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/track - SQLite fallback (no KV configured)', () => {
  it('records a brand-new visitor as isNew: true with a count of 1', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.totalUniqueVisitors).toBe(1);
  });

  it('stores a privacy-focused hash, never the raw IP or User-Agent', async () => {
    const ip = '198.51.100.7';
    const ua = 'test-agent/1.0';
    const { POST } = await import('./route');
    await POST(makeRequest('POST', {}, ip));

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT visitor_hash FROM unique_visitors').get() as { visitor_hash: string } | undefined;
    expect(row?.visitor_hash).toBe(createVisitorHash(ip, ua));
    expect(row?.visitor_hash).not.toContain(ip);
  });

  it('does not double-count the same visitor (same IP + User-Agent) on a repeat visit', async () => {
    const ip = freshIp();
    const { POST } = await import('./route');
    const first = await POST(makeRequest('POST', {}, ip));
    const firstBody = await first.json();
    expect(firstBody.isNew).toBe(true);
    expect(firstBody.totalUniqueVisitors).toBe(1);

    const second = await POST(makeRequest('POST', {}, ip));
    const secondBody = await second.json();
    expect(secondBody.isNew).toBe(false);
    expect(secondBody.totalUniqueVisitors).toBe(1);
  });

  it('counts a different User-Agent from the same IP as a distinct visitor', async () => {
    const ip = freshIp();
    const { POST } = await import('./route');
    await POST(makeRequest('POST', {}, ip));
    const response = await POST(makeRequest('POST', { 'user-agent': 'a-different-agent/2.0' }, ip));
    const body = await response.json();
    expect(body.isNew).toBe(true);
    expect(body.totalUniqueVisitors).toBe(2);
  });

  it('reports storage failure honestly (success: false) instead of a false positive when SQLite itself fails', async () => {
    const dbModule = await import('../../lib/db');
    vi.spyOn(dbModule, 'getDatabase').mockImplementation(() => {
      throw new Error('disk full');
    });

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(200); // never a 500 - errors are reported in the body
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

describe('POST /api/track - KV path', () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';
  });

  it('increments the unique counter for a brand-new visitor and does not touch SQLite', async () => {
    kvMock.set.mockResolvedValue('OK'); // NX succeeded - genuinely new
    kvMock.incr.mockResolvedValue(1);
    kvMock.get.mockResolvedValue(1);

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.totalUniqueVisitors).toBe(1);
    expect(kvMock.incr).toHaveBeenCalledWith('unique_visitors');

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
    expect(row.count).toBe(0);
  });

  it('does not increment the counter for a returning visitor', async () => {
    kvMock.set.mockResolvedValue(null); // NX failed - visitor key already exists
    kvMock.get.mockResolvedValue(5);

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    const body = await response.json();
    expect(body.isNew).toBe(false);
    expect(body.totalUniqueVisitors).toBe(5);
    expect(kvMock.incr).not.toHaveBeenCalled();
  });

  it('falls back to SQLite when the KV write fails', async () => {
    kvMock.set.mockRejectedValue(new Error('kv unavailable'));

    const { POST } = await import('./route');
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
    expect(row.count).toBe(1);
  });
});

describe('GET /api/track', () => {
  it('returns the current unique-visitor count from SQLite when no KV is configured', async () => {
    const { POST, GET } = await import('./route');
    await POST(makeRequest('POST'));
    await POST(makeRequest('POST'));

    const response = await GET(makeRequest('GET'));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.totalUniqueVisitors).toBe(2);
  });

  it('returns the KV count directly when KV is configured', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    kvMock.get.mockResolvedValue(17);

    const { GET } = await import('./route');
    const response = await GET(makeRequest('GET'));
    const body = await response.json();
    expect(body.totalUniqueVisitors).toBe(17);
  });

  it('degrades to a zero count (still success: true) instead of an error when both KV and SQLite fail', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    kvMock.get.mockRejectedValue(new Error('kv down'));

    const dbModule = await import('../../lib/db');
    vi.spyOn(dbModule, 'getDatabase').mockImplementation(() => {
      throw new Error('disk full');
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest('GET'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.totalUniqueVisitors).toBe(0);
  });
});
