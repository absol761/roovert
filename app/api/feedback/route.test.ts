import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// This route's fallback path goes through getDatabase() (../../lib/db),
// which opens a fixed on-disk path with no override - mock 'fs'/
// 'better-sqlite3' the same way app/lib/db.test.ts does so it runs against
// a real, in-memory SQLite database. Also mock '@vercel/kv' directly (the
// same package/pattern app/lib/share.test.ts uses) so the KV-first path can
// be driven and made to fail without a real network client.
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

const kvMock = { incr: vi.fn(), hincrby: vi.fn() };
vi.mock('@vercel/kv', () => ({ kv: kvMock }));

// This route checks KV_REST_API_URL/TOKEN directly to decide whether to try
// its own @vercel/kv write - but the shared rate limiter (rateLimit.ts) also
// reads those same two env vars as a fallback (see app/lib/redis.ts) to
// decide whether to back ITS OWN counters with a real Upstash Redis client.
// Setting them to test this route's KV branch would otherwise also make the
// rate limiter attempt a real network call. Force it onto the in-memory
// store here so only the route's own KV branch is under test.
vi.mock('@/app/lib/redis', () => ({ getRedis: vi.fn(() => null) }));

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(body: unknown, headers: Record<string, string> = {}, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers, 'x-forwarded-for': ip },
  });
}

const ENV_KEYS = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
  kvMock.incr.mockReset();
  kvMock.hincrby.mockReset();
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

describe('POST /api/feedback - validation', () => {
  it('rejects an invalid JSON body', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest('not-json'));
    expect(response.status).toBe(400);
  });

  it('rejects a rating that is not "up" or "down"', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'sideways', modelId: 'ooverta' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/rating must be/);
  });

  it('rejects a missing modelId', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'up' }));
    expect(response.status).toBe(400);
  });

  it('rejects unexpected fields (rejects mass assignment / message content leakage)', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'up', modelId: 'ooverta', messageContent: 'leaked text' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/Unexpected fields/);
  });

  it('rejects a request whose declared Content-Length exceeds the 1MB limit', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      makeRequest({ rating: 'up', modelId: 'ooverta' }, { 'content-length': String(2 * 1024 * 1024) })
    );
    expect(response.status).toBe(400);
  });

  it('rate-limits after the shared "tracking" bucket is exhausted (60/min)', async () => {
    const ip = freshIp();
    const { POST } = await import('./route');
    for (let i = 0; i < 60; i++) {
      const response = await POST(makeRequest({ rating: 'up', modelId: 'ooverta' }, {}, ip));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(makeRequest({ rating: 'up', modelId: 'ooverta' }, {}, ip));
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/feedback - SQLite fallback (no KV configured)', () => {
  it('accepts valid feedback and persists it to SQLite', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'down', modelId: 'llama-3.3-70b' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT rating, model_id FROM message_feedback WHERE model_id = ?').get('llama-3.3-70b') as
      | { rating: string; model_id: string }
      | undefined;
    expect(row?.rating).toBe('down');
  });

  it('never touches KV when KV env vars are not configured', async () => {
    const { POST } = await import('./route');
    await POST(makeRequest({ rating: 'up', modelId: 'ooverta' }));
    expect(kvMock.incr).not.toHaveBeenCalled();
    expect(kvMock.hincrby).not.toHaveBeenCalled();
  });

  it('reports storage failure honestly (success: false) instead of a false positive when SQLite itself fails', async () => {
    const dbModule = await import('../../lib/db');
    vi.spyOn(dbModule, 'getDatabase').mockImplementation(() => {
      throw new Error('disk full');
    });

    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'up', modelId: 'ooverta' }));
    expect(response.status).toBe(200); // never a 500 - errors are reported in the body
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

describe('POST /api/feedback - KV path', () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';
  });

  it('writes to KV (both counters) and does not touch SQLite when KV succeeds', async () => {
    kvMock.incr.mockResolvedValue(1);
    kvMock.hincrby.mockResolvedValue(1);

    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'up', modelId: 'ooverta' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    expect(kvMock.incr).toHaveBeenCalledWith('feedback:total:up');
    expect(kvMock.hincrby).toHaveBeenCalledWith('feedback:by_model:up', 'ooverta', 1);

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM message_feedback').get() as { count: number };
    expect(row.count).toBe(0);
  });

  it('falls back to SQLite when the KV write fails', async () => {
    kvMock.incr.mockRejectedValue(new Error('kv unavailable'));
    kvMock.hincrby.mockResolvedValue(1);

    const { POST } = await import('./route');
    const response = await POST(makeRequest({ rating: 'down', modelId: 'llama-3.3-70b' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const dbModule = await import('../../lib/db');
    const db = dbModule.getDatabase();
    const row = db.prepare('SELECT rating FROM message_feedback WHERE model_id = ?').get('llama-3.3-70b') as
      | { rating: string }
      | undefined;
    expect(row?.rating).toBe('down');
  });
});
