import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// This route's read path goes through getDatabase() (../../../lib/db) as a
// fallback - mock 'fs'/'better-sqlite3' the same way app/lib/db.test.ts and
// app/lib/share.test.ts do so it runs against a real, in-memory SQLite
// database.
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

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/share/some-id', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const validHistory = [
  { role: 'user' as const, content: 'Hello' },
  { role: 'assistant' as const, content: 'Hi there' },
];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/share/[id] - id format validation', () => {
  it('returns 404 for an id that is not a valid UUID, without attempting a lookup', async () => {
    const { GET } = await import('./route');
    const shareModule = await import('../../../lib/share');
    const getSpy = vi.spyOn(shareModule, 'getSharedConversation');

    const response = await GET(makeRequest(), paramsFor('not-a-uuid'));
    expect(response.status).toBe(404);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for a path-traversal-shaped id, without attempting a lookup', async () => {
    const { GET } = await import('./route');
    const shareModule = await import('../../../lib/share');
    const getSpy = vi.spyOn(shareModule, 'getSharedConversation');

    const response = await GET(makeRequest(), paramsFor('../../../etc/passwd'));
    expect(response.status).toBe(404);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('accepts an uppercase UUID as a valid format (passes the pattern check, reaches the lookup)', async () => {
    const shareModule = await import('../../../lib/share');
    const getSpy = vi.spyOn(shareModule, 'getSharedConversation');
    const id = (await import('crypto')).randomUUID();

    const { GET } = await import('./route');
    await GET(makeRequest(), paramsFor(id.toUpperCase()));
    // The format check is case-insensitive - it should reach the storage
    // lookup rather than being rejected outright as malformed. Whether the
    // record itself is found is a separate, case-sensitive storage concern
    // (not this route's job), covered by the exact-case lookup test below.
    expect(getSpy).toHaveBeenCalledWith(id.toUpperCase());
  });
});

describe('GET /api/share/[id] - lookup', () => {
  it('returns the stored conversation for a valid, existing id', async () => {
    const shareModule = await import('../../../lib/share');
    const id = (await import('crypto')).randomUUID();
    await shareModule.saveSharedConversation(id, validHistory);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(), paramsFor(id));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.messages).toHaveLength(2);
    expect(body.createdAt).toBeDefined();
  });

  it('returns 404 for a well-formed but non-existent id', async () => {
    const id = (await import('crypto')).randomUUID();
    const { GET } = await import('./route');
    const response = await GET(makeRequest(), paramsFor(id));
    expect(response.status).toBe(404);
  });

  it('rate-limits after the "share-read" bucket is exhausted (60/min)', async () => {
    const shareModule = await import('../../../lib/share');
    const id = (await import('crypto')).randomUUID();
    await shareModule.saveSharedConversation(id, validHistory);

    const ip = freshIp();
    const { GET } = await import('./route');
    for (let i = 0; i < 60; i++) {
      const response = await GET(makeRequest(ip), paramsFor(id));
      expect(response.status).toBe(200);
    }
    const blocked = await GET(makeRequest(ip), paramsFor(id));
    expect(blocked.status).toBe(429);
  });
});

describe('GET /api/share/[id] - resilience', () => {
  it('returns a 500 without leaking internal error details when the lookup itself throws', async () => {
    const id = (await import('crypto')).randomUUID();
    const shareModule = await import('../../../lib/share');
    vi.spyOn(shareModule, 'getSharedConversation').mockRejectedValue(new Error('disk full: /data/shares.db'));

    const { GET } = await import('./route');
    const response = await GET(makeRequest(), paramsFor(id));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to load shared conversation');
    expect(JSON.stringify(body)).not.toContain('disk full');
  });
});
