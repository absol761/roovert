import { NextResponse } from 'next/server';

/**
 * Liveness/readiness probe for uptime monitors and load balancers.
 * Deliberately no rate limiting (health checks are polled frequently and
 * aren't user-facing data) and no external calls - it must stay fast and
 * succeed even if Redis/SQLite are unreachable, since those degrade
 * gracefully elsewhere in the app (see app/lib/redis.ts, app/lib/db.ts)
 * rather than being hard dependencies.
 */
export async function GET() {
  const redisConfigured = Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services: {
        // Boolean presence only - never expose the values themselves.
        redis: redisConfigured ? 'configured' : 'in-memory-fallback',
        sqlite: process.env.VERCEL ? 'unavailable-serverless' : 'available',
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
