import { Redis } from '@upstash/redis';

let client: Redis | null = null;
let attempted = false;

/**
 * Returns a shared Upstash Redis client, or null if UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN aren't configured. Callers should fall back to an
 * in-memory store when this returns null (e.g. local dev without Upstash).
 */
export function getRedis(): Redis | null {
  if (attempted) return client;
  attempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      '[redis] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — falling back to in-memory rate limiting (not shared across serverless instances).'
    );
    return null;
  }

  client = new Redis({ url, token });
  return client;
}
