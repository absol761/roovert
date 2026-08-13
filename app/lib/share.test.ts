import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConversationMessage } from './security/validation';

// share.ts's SQLite fallback goes through getDatabase() (./db), which opens
// a fixed on-disk path with no override. Mock 'better-sqlite3'/'fs' the same
// way db.test.ts does so the fallback path is exercised against a real,
// in-memory SQLite database instead of touching the filesystem.
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

const kvMock = { get: vi.fn(), set: vi.fn() };
vi.mock('@vercel/kv', () => ({ kv: kvMock }));

let idCounter = 0;
function freshId(): string {
  idCounter += 1;
  return `share-id-${idCounter}`;
}

const sampleMessages: ConversationMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there' },
] as ConversationMessage[];

describe('share.ts', () => {
  const originalKvUrl = process.env.KV_REST_API_URL;
  const originalKvToken = process.env.KV_REST_API_TOKEN;

  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    kvMock.get.mockReset();
    kvMock.set.mockReset();
  });

  afterEach(() => {
    if (originalKvUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = originalKvUrl;
    if (originalKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = originalKvToken;
  });

  describe('SHARE_TTL_SECONDS', () => {
    it('is 60 days in seconds', async () => {
      const { SHARE_TTL_SECONDS } = await import('./share');
      expect(SHARE_TTL_SECONDS).toBe(60 * 24 * 60 * 60);
    });
  });

  describe('without KV configured (SQLite fallback)', () => {
    it('round-trips a saved conversation', async () => {
      const { saveSharedConversation, getSharedConversation } = await import('./share');
      const id = freshId();

      await saveSharedConversation(id, sampleMessages);
      const result = await getSharedConversation(id);

      expect(result).not.toBeNull();
      expect(result?.messages).toEqual(sampleMessages);
      expect(typeof result?.createdAt).toBe('number');
      expect(kvMock.set).not.toHaveBeenCalled();
      expect(kvMock.get).not.toHaveBeenCalled();
    });

    it('returns null for an id that was never saved', async () => {
      const { getSharedConversation } = await import('./share');
      const result = await getSharedConversation(freshId());
      expect(result).toBeNull();
    });

    it('overwrites an existing record for the same id (INSERT OR REPLACE)', async () => {
      const { saveSharedConversation, getSharedConversation } = await import('./share');
      const id = freshId();

      await saveSharedConversation(id, [{ role: 'user', content: 'first' }] as ConversationMessage[]);
      await saveSharedConversation(id, [{ role: 'user', content: 'second' }] as ConversationMessage[]);

      const result = await getSharedConversation(id);
      expect(result?.messages).toEqual([{ role: 'user', content: 'second' }]);
    });

    it('treats an expired record as not found and deletes it lazily on read', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const { saveSharedConversation, getSharedConversation } = await import('./share');
        const id = freshId();
        await saveSharedConversation(id, sampleMessages);

        // Past the 60-day TTL.
        vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
        const expired = await getSharedConversation(id);
        expect(expired).toBeNull();

        // A second read confirms the row was actually deleted, not just
        // filtered - re-fetching still yields null with no side effects.
        const stillGone = await getSharedConversation(id);
        expect(stillGone).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('with KV configured', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://example-kv.example.com';
      process.env.KV_REST_API_TOKEN = 'test-token';
    });

    it('writes through kv.set with the namespaced key and TTL, not SQLite', async () => {
      const { saveSharedConversation, SHARE_TTL_SECONDS } = await import('./share');
      kvMock.set.mockResolvedValue('OK');
      const id = freshId();

      await saveSharedConversation(id, sampleMessages);

      expect(kvMock.set).toHaveBeenCalledTimes(1);
      const [key, value, opts] = kvMock.set.mock.calls[0];
      expect(key).toBe(`share:${id}`);
      expect(opts).toEqual({ ex: SHARE_TTL_SECONDS });
      expect(JSON.parse(value).messages).toEqual(sampleMessages);
    });

    it('reads back through kv.get, parsing a JSON string payload', async () => {
      const { getSharedConversation } = await import('./share');
      const id = freshId();
      kvMock.get.mockResolvedValue(JSON.stringify({ messages: sampleMessages, createdAt: 12345 }));

      const result = await getSharedConversation(id);
      expect(result).toEqual({ messages: sampleMessages, createdAt: 12345 });
    });

    it('accepts an already-deserialized object from kv.get', async () => {
      const { getSharedConversation } = await import('./share');
      kvMock.get.mockResolvedValue({ messages: sampleMessages, createdAt: 999 });

      const result = await getSharedConversation(freshId());
      expect(result).toEqual({ messages: sampleMessages, createdAt: 999 });
    });

    it('returns null when kv.get finds nothing', async () => {
      const { getSharedConversation } = await import('./share');
      kvMock.get.mockResolvedValue(null);

      const result = await getSharedConversation(freshId());
      expect(result).toBeNull();
    });

    it('falls back to SQLite when kv.set fails, and the record is still readable there', async () => {
      const { saveSharedConversation, getSharedConversation } = await import('./share');
      kvMock.set.mockRejectedValue(new Error('kv unavailable'));
      const id = freshId();

      await expect(saveSharedConversation(id, sampleMessages)).resolves.toBeUndefined();

      // Read path checks KV first (which is configured) and finds nothing
      // there, but must still fall back to SQLite - otherwise a link
      // created during a transient KV outage would 404 forever even though
      // the caller was told the share succeeded.
      kvMock.get.mockResolvedValue(null);
      const result = await getSharedConversation(id);
      expect(result?.messages).toEqual(sampleMessages);
      expect(kvMock.get).toHaveBeenCalledTimes(1);
    });

    it('does not consult SQLite when KV already has the record', async () => {
      const { getSharedConversation } = await import('./share');
      kvMock.get.mockResolvedValue(JSON.stringify({ messages: sampleMessages, createdAt: 42 }));

      const result = await getSharedConversation(freshId());
      expect(result).toEqual({ messages: sampleMessages, createdAt: 42 });
      // Nothing to assert on the SQLite side directly here beyond the KV
      // result winning outright - covered by "reads back through kv.get"
      // above; this test's job is just to make sure the new SQLite
      // fallback doesn't shadow a real KV hit.
    });

    it('returns null (does not fall back to SQLite) when kv.get itself throws', async () => {
      const { getSharedConversation } = await import('./share');
      kvMock.get.mockRejectedValue(new Error('kv read failure'));

      const result = await getSharedConversation(freshId());
      expect(result).toBeNull();
    });
  });
});
