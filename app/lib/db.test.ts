import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sep } from 'path';

// vi.mock() factories are hoisted above const declarations, so the mocks
// they reference must themselves be created inside vi.hoisted() - a plain
// const here would be undefined (TDZ) by the time the factory runs.
const { pragmaMock, execMock, DatabaseCtorMock, existsSyncMock, mkdirSyncMock } = vi.hoisted(() => ({
  pragmaMock: vi.fn(),
  execMock: vi.fn(),
  DatabaseCtorMock: vi.fn(),
  existsSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
}));

// `new mockFn()` forwards construction to the implementation function itself,
// and arrow functions are never constructable - this must be a real function.
DatabaseCtorMock.mockImplementation(function () {
  return {
    pragma: pragmaMock,
    exec: execMock,
  };
});

vi.mock('better-sqlite3', () => ({
  default: DatabaseCtorMock,
}));

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
}));

describe('getDatabase', () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.resetModules();
    DatabaseCtorMock.mockClear();
    pragmaMock.mockClear();
    execMock.mockClear();
    existsSyncMock.mockReset();
    mkdirSyncMock.mockReset();
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
  });

  it('throws when running in the Vercel serverless environment', async () => {
    process.env.VERCEL = '1';
    const { getDatabase } = await import('./db');

    expect(() => getDatabase()).toThrow('SQLite not available in serverless environment');
    expect(DatabaseCtorMock).not.toHaveBeenCalled();
  });

  it('creates the data directory when it does not already exist', async () => {
    existsSyncMock.mockReturnValue(false);
    const { getDatabase } = await import('./db');

    getDatabase();

    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining('data'), { recursive: true });
  });

  it('does not attempt to create the data directory when it already exists', async () => {
    existsSyncMock.mockReturnValue(true);
    const { getDatabase } = await import('./db');

    getDatabase();

    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });

  it('opens the database at data/visitors.db and enables WAL mode', async () => {
    existsSyncMock.mockReturnValue(true);
    const { getDatabase } = await import('./db');

    getDatabase();

    expect(DatabaseCtorMock).toHaveBeenCalledWith(expect.stringContaining(`${sep}data${sep}visitors.db`));
    expect(pragmaMock).toHaveBeenCalledWith('journal_mode = WAL');
  });

  it('initializes schema for unique_visitors, message_feedback, and shared_conversations tables', async () => {
    existsSyncMock.mockReturnValue(true);
    const { getDatabase } = await import('./db');

    getDatabase();

    expect(execMock).toHaveBeenCalledTimes(1);
    const schemaSql = execMock.mock.calls[0][0] as string;
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS unique_visitors');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS message_feedback');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS shared_conversations');
  });

  it('returns the same database instance on repeated calls (singleton)', async () => {
    existsSyncMock.mockReturnValue(true);
    const { getDatabase } = await import('./db');

    const first = getDatabase();
    const second = getDatabase();

    expect(first).toBe(second);
    expect(DatabaseCtorMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows and does not cache the instance when initialization fails', async () => {
    existsSyncMock.mockReturnValue(true);
    execMock.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const { getDatabase } = await import('./db');

    expect(() => getDatabase()).toThrow('disk full');

    // A subsequent call should retry construction rather than reuse a
    // half-initialized instance from the failed attempt.
    execMock.mockImplementationOnce(() => undefined);
    expect(() => getDatabase()).not.toThrow();
    expect(DatabaseCtorMock).toHaveBeenCalledTimes(2);
  });
});
