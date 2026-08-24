import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// db.ts always opens a fixed on-disk path (process.cwd()/data/visitors.db) -
// there's no env var or parameter to point it at a temp/in-memory database.
// To keep these tests from touching real disk state, we mock 'better-sqlite3'
// so every `new Database(path)` call transparently opens ':memory:' instead
// (the real Database class otherwise, so schema/CRUD behavior is exercised
// for real), and mock 'fs' so the real-directory existsSync/mkdirSync calls
// in getDatabase() never touch the filesystem either.
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

describe('getDatabase', () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
  });

  it('throws in a serverless (VERCEL) environment instead of touching SQLite', async () => {
    process.env.VERCEL = '1';
    const { getDatabase } = await import('./db');
    expect(() => getDatabase()).toThrow('SQLite not available in serverless environment');
  });

  it('creates the expected tables', async () => {
    const { getDatabase } = await import('./db');
    const db = getDatabase();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (row) => row.name
    );
    expect(tables).toEqual(
      expect.arrayContaining(['unique_visitors', 'message_feedback', 'shared_conversations'])
    );
  });

  it('creates the expected indexes', async () => {
    const { getDatabase } = await import('./db');
    const db = getDatabase();
    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as { name: string }[]).map(
      (row) => row.name
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_visitor_hash',
        'idx_first_seen',
        'idx_last_seen',
        'idx_feedback_model',
        'idx_feedback_created_at',
        'idx_shared_expires_at',
      ])
    );
  });

  it('returns the same singleton instance across repeated calls', async () => {
    const { getDatabase } = await import('./db');
    const a = getDatabase();
    const b = getDatabase();
    expect(a).toBe(b);
  });

  it('supports inserting into and querying unique_visitors, with visit_count defaulting to 1', async () => {
    const { getDatabase } = await import('./db');
    const db = getDatabase();
    db.prepare(
      'INSERT INTO unique_visitors (visitor_hash, first_seen, last_seen) VALUES (?, ?, ?)'
    ).run('hash-1', 1000, 1000);

    const row = db.prepare('SELECT * FROM unique_visitors WHERE visitor_hash = ?').get('hash-1');
    expect(row).toMatchObject({ visitor_hash: 'hash-1', first_seen: 1000, last_seen: 1000, visit_count: 1 });
  });

  it('enforces uniqueness on visitor_hash', async () => {
    const { getDatabase } = await import('./db');
    const db = getDatabase();
    db.prepare(
      'INSERT INTO unique_visitors (visitor_hash, first_seen, last_seen) VALUES (?, ?, ?)'
    ).run('dup', 1, 1);

    expect(() =>
      db
        .prepare('INSERT INTO unique_visitors (visitor_hash, first_seen, last_seen) VALUES (?, ?, ?)')
        .run('dup', 2, 2)
    ).toThrow();
  });

  it('supports inserting into and reading back shared_conversations', async () => {
    const { getDatabase } = await import('./db');
    const db = getDatabase();
    db.prepare(
      'INSERT INTO shared_conversations (id, content, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run('share-1', '{"messages":[]}', 1000, 2000);

    const row = db.prepare('SELECT * FROM shared_conversations WHERE id = ?').get('share-1');
    expect(row).toMatchObject({ id: 'share-1', content: '{"messages":[]}', created_at: 1000, expires_at: 2000 });
  });
});
