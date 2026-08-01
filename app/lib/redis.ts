import { Redis } from '@upstash/redis';

let client: Redis | null = null;
let attempted = false;

/**
 * Returns a shared Upstash Redis client, or null if no compatible REST
 * credentials are configured. Callers should fall back to an in-memory
 * store when this returns null (e.g. local dev without either configured).
 *
 * Checks UPSTASH_REDIS_REST_URL/TOKEN first (Upstash's own naming, and
 * what .env.example documents), then falls back to KV_REST_API_URL/TOKEN
 * (Vercel KV's naming) - this project's actual production environment has
 * only ever had the latter configured, which this function silently didn't
 * recognize, so rate limiting had been running on a per-instance in-memory
 * store in production this whole time instead of the shared store it was
 * designed for. Vercel KV is Upstash Redis under the hood, so the same
 * REST URL/token shape works with the @upstash/redis client directly -
 * no need to switch to the @vercel/kv package.
 */
export function getRedis(): Redis | null {
  if (attempted) return client;
  attempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn(
      '[redis] Neither UPSTASH_REDIS_REST_URL/TOKEN nor KV_REST_API_URL/TOKEN are set — falling back to in-memory rate limiting (not shared across serverless instances).'
    );
    return null;
  }

  client = new Redis({ url, token });
  return client;
}
