import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// getRedis() caches its result in module-level state after the first call,
// so each test needs a fresh module instance (via resetModules + dynamic
// import) to exercise a different environment-variable combination.
describe('getRedis', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns null when neither Upstash nor KV credentials are configured', async () => {
    const { getRedis } = await import('./redis');

    const client = getRedis();

    expect(client).toBeNull();
  });

  it('logs a warning when falling back to in-memory rate limiting', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getRedis } = await import('./redis');

    getRedis();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/falling back to in-memory/);
  });

  it('creates a client when UPSTASH_REDIS_REST_URL/TOKEN are set', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
    const { getRedis } = await import('./redis');

    const client = getRedis();

    expect(client).not.toBeNull();
  });

  it('falls back to KV_REST_API_URL/TOKEN (Vercel KV naming) when Upstash vars are absent', async () => {
    process.env.KV_REST_API_URL = 'https://example-kv.upstash.io';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    const { getRedis } = await import('./redis');

    const client = getRedis();

    expect(client).not.toBeNull();
  });

  it('prefers UPSTASH_REDIS_REST_URL/TOKEN over KV_REST_API_URL/TOKEN when both are set', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
    process.env.KV_REST_API_URL = 'https://kv.example.io';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    const { getRedis } = await import('./redis');

    const client = getRedis();

    expect(client).not.toBeNull();
  });

  it('caches the client across repeated calls instead of recreating it', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
    const { getRedis } = await import('./redis');

    const first = getRedis();
    const second = getRedis();

    expect(first).toBe(second);
  });

  it('does not warn again on a second call once the null result is cached', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getRedis } = await import('./redis');

    getRedis();
    getRedis();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
