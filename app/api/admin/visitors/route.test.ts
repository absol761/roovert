import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// This route's stats come from getDatabase() (../../../lib/db), which opens
// a fixed on-disk path with no override. Mock 'better-sqlite3'/'fs' the same
// way app/lib/db.test.ts and app/lib/share.test.ts do, so the real query
// logic runs against a real, in-memory SQLite database instead of touching
// the filesystem.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

vi.mock('better-sqlite3', async (importOriginal) => {
  // better-sqlite3 is a CJS `export =` module, so its type doesn't expose a
  // `.default`; the runtime interop shape it's imported through varies, so
  // this stays untyped rather than fighting `typeof import(...)` here.
  const actual = (await importOriginal()) as { default: typeof import('better-sqlite3') };
  const ActualDatabase = actual.default;
  class InMemoryDatabase extends ActualDatabase {
    constructor(_path?: string, options?: ConstructorParameters<typeof ActualDatabase>[1]) {
      super(':memory:', options);
    }
  }
  return { default: InMemoryDatabase };
});

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(headers: Record<string, string> = {}, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/admin/visitors', {
    method: 'GET',
    headers: { ...headers, 'x-forwarded-for': ip },
  });
}

const ENV_KEYS = ['ADMIN_API_KEY', 'AI_GATEWAY_API_KEY', 'VERCEL'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
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
});

describe('GET /api/admin/visitors', () => {
  it('returns 503 without leaking a distinguishable error when no admin key is configured', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest({ 'x-admin-key': 'anything' }));
    expect(response.status).toBe(503);
  });

  it('rejects a request with no x-admin-key header with a 401', async () => {
    process.env.ADMIN_API_KEY = 'correct-key';
    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects an incorrect admin key with a 401', async () => {
    process.env.ADMIN_API_KEY = 'correct-key';
    const { GET } = await import('./route');
    const response = await GET(makeRequest({ 'x-admin-key': 'wrong-key' }));
    expect(response.status).toBe(401);
  });

  it('rejects a key that is merely a prefix or a different length, not just a different value', async () => {
    process.env.ADMIN_API_KEY = 'correct-key-0123456789';
    const { GET } = await import('./route');
    const short = await GET(makeRequest({ 'x-admin-key': 'correct-key' }));
    expect(short.status).toBe(401);
    const long = await GET(makeRequest({ 'x-admin-key': 'correct-key-0123456789-extra' }));
    expect(long.status).toBe(401);
  });

  it('accepts the correct admin key and returns visitor stats', async () => {
    process.env.ADMIN_API_KEY = 'correct-key';
    const { GET } = await import('./route');
    const response = await GET(makeRequest({ 'x-admin-key': 'correct-key' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats).toEqual(
      expect.objectContaining({
        totalUniqueVisitors: 0,
        last24Hours: 0,
        last7Days: 0,
        last30Days: 0,
        totalVisits: 0,
        oldestVisitorDate: null,
        newestVisitorDate: null,
      })
    );
  });

  it('falls back to AI_GATEWAY_API_KEY when ADMIN_API_KEY is unset (documented backward-compat)', async () => {
    process.env.AI_GATEWAY_API_KEY = 'legacy-key';
    const { GET } = await import('./route');
    const response = await GET(makeRequest({ 'x-admin-key': 'legacy-key' }));
    expect(response.status).toBe(200);
  });

  it('counts real visitor rows correctly across the 24h/7d/30d/all-time buckets', async () => {
    process.env.ADMIN_API_KEY = 'correct-key';
    const dbModule = await import('../../../lib/db');
    const db = dbModule.getDatabase();

    const now = Date.now();
    const insert = db.prepare(
      'INSERT INTO unique_visitors (visitor_hash, first_seen, last_seen, visit_count) VALUES (?, ?, ?, ?)'
    );
    // Seen an hour ago - inside every window.
    insert.run('visitor-recent', now - 60 * 60 * 1000, now - 60 * 60 * 1000, 3);
    // Seen 10 days ago - inside 30d only.
    insert.run('visitor-old', now - 10 * 24 * 60 * 60 * 1000, now - 10 * 24 * 60 * 60 * 1000, 1);
    // Seen 60 days ago - outside every rolling window, but still counts toward the all-time total.
    insert.run('visitor-ancient', now - 60 * 24 * 60 * 60 * 1000, now - 60 * 24 * 60 * 60 * 1000, 5);

    const { GET } = await import('./route');
    const response = await GET(makeRequest({ 'x-admin-key': 'correct-key' }));
    const body = await response.json();

    expect(body.stats.totalUniqueVisitors).toBe(3);
    expect(body.stats.last24Hours).toBe(1);
    expect(body.stats.last7Days).toBe(1);
    expect(body.stats.last30Days).toBe(2);
    expect(body.stats.totalVisits).toBe(9); // 3 + 1 + 5
    expect(body.stats.oldestVisitorDate).toBe(new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString());
    expect(body.stats.newestVisitorDate).toBe(new Date(now - 60 * 60 * 1000).toISOString());
  });

  it('rate-limits after 10 requests/minute from the same IP (the stricter admin-specific limit)', async () => {
    process.env.ADMIN_API_KEY = 'correct-key';
    const { GET } = await import('./route');
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      const response = await GET(makeRequest({ 'x-admin-key': 'wrong' }, ip));
      expect(response.status).toBe(401);
    }
    const blocked = await GET(makeRequest({ 'x-admin-key': 'wrong' }, ip));
    expect(blocked.status).toBe(429);
  });
});
