import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Redis } from '@upstash/redis';

// The real @upstash/redis Redis constructor just stores config locally - it
// makes no network call until a command is actually issued - so these tests
// use it directly rather than mocking the module.
const ENV_KEYS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;

// `client` is a protected member of Redis, inaccessible from outside the
// class hierarchy; reach into it structurally just to assert which base URL
// the constructed client actually holds.
function baseUrlOf(client: Redis): string {
  return (client as unknown as { client: { baseUrl: string } }).client.baseUrl;
}

describe('getRedis', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.restoreAllMocks();
  });

  it('returns null when no credentials are configured', async () => {
    const { getRedis } = await import('./redis');
    expect(getRedis()).toBeNull();
  });

  it('warns once when falling back to in-memory (no credentials)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getRedis } = await import('./redis');

    getRedis();
    getRedis();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/falling back to in-memory/);
  });

  it('constructs a client from UPSTASH_REDIS_REST_URL/TOKEN', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';

    const { getRedis } = await import('./redis');
    const client = getRedis();

    expect(client).toBeInstanceOf(Redis);
    expect(client && baseUrlOf(client)).toBe('https://upstash.example.com');
  });

  it('falls back to KV_REST_API_URL/TOKEN (Vercel KV naming) when Upstash vars are unset', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';

    const { getRedis } = await import('./redis');
    const client = getRedis();

    expect(client).toBeInstanceOf(Redis);
    expect(client && baseUrlOf(client)).toBe('https://kv.example.com');
  });

  it('prefers UPSTASH_* over KV_* when both are set', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
    process.env.KV_REST_API_URL = 'https://kv.example.com';
    process.env.KV_REST_API_TOKEN = 'kv-token';

    const { getRedis } = await import('./redis');
    const client = getRedis();

    expect(client && baseUrlOf(client)).toBe('https://upstash.example.com');
  });

  it('caches the client - a later env change does not affect an already-resolved result', async () => {
    const { getRedis } = await import('./redis');
    expect(getRedis()).toBeNull();

    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';

    // Same module instance (no resetModules) - `attempted` short-circuits.
    expect(getRedis()).toBeNull();
  });
});
