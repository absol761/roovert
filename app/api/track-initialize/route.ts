import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDatabase } from '@/app/lib/db';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { getRedis } from '@/app/lib/redis';

// Cooldown period in seconds (5 minutes)
const COOLDOWN_SECONDS = 300;

/**
 * Get user identifier from request (IP-based)
 *
 * Security: x-forwarded-for is a hop chain each proxy APPENDS to, not
 * replaces. With one trusted reverse proxy in front (Vercel's edge), the
 * LAST entry is the one that proxy appended; earlier entries are whatever
 * the client sent and must never be trusted as the real client IP.
 */
function getUserIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ips = forwarded?.split(',').map(ip => ip.trim()).filter(Boolean);
  const ip = ips && ips.length > 0 ? ips[ips.length - 1] : 'unknown';
  // Hash the IP for privacy - the raw IP must never be used as (or embedded
  // in) the Redis key.
  const hashedIp = createHash('sha256').update(ip).digest('hex');
  return `user_cooldown:${hashedIp}`;
}

/**
 * Track "Initialize Chat" click
 * Rate limited: only counts once per 5 minutes per user
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting for tracking endpoints (matches track/route.ts
    // and visit/route.ts - this route was previously missing this check).
    const rateLimitResponse = await applyRateLimit(request, 'tracking');
    if (rateLimitResponse) {
      try {
        const errorData = await rateLimitResponse.json();
        return NextResponse.json(errorData, {
          status: 429,
          headers: Object.fromEntries(rateLimitResponse.headers.entries())
        });
      } catch {
        return rateLimitResponse;
      }
    }

    const now = Date.now();
    const userKey = getUserIdentifier(request);
    const redis = getRedis();

    // Try Upstash Redis first (production)
    if (redis) {
      try {
        // Atomically set the cooldown key only if it isn't already set - a
        // separate get-then-set (as this used to do) is a TOCTOU race: two
        // concurrent requests from the same IP could both see "no cooldown"
        // before either had set the key, so both would fall through and
        // increment the counter, double-counting a single burst of clicks.
        // SET ... NX makes "start the cooldown" and "was it already active"
        // a single atomic operation, matching the pattern already used by
        // /api/track and /api/visit for their own dedupe keys.
        const setResult = await redis.set(userKey, now, { ex: COOLDOWN_SECONDS, nx: true });

        if (setResult !== 'OK') {
          // User clicked recently, don't increment
          return NextResponse.json({ success: true, counted: false, message: 'Already counted recently' });
        }

        // Increment the counter
        await redis.incr('initialize_chat_clicks');

        return NextResponse.json({ success: true, counted: true });
      } catch (redisError) {
        console.error('Redis error:', redisError);
        // Fall through to SQLite
      }
    }

    // Fallback to SQLite (local development)
    try {
      const db = getDatabase();
      
      // Create table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS initialize_clicks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clicked_at INTEGER NOT NULL
        );
      `);

      db.prepare('INSERT INTO initialize_clicks (clicked_at) VALUES (?)').run(now);
      
      // Security: Increment rate limit after successful processing
      await incrementRateLimit(request, 'tracking');
      
      return NextResponse.json({ success: true, counted: true });
    } catch (dbError) {
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      if (dbErrorMessage.includes('serverless') || dbErrorMessage.includes('SQLite not available')) {
        return NextResponse.json({ success: true, counted: false }); // Silent success in serverless
      }
      console.error('Database error:', dbError);
      return NextResponse.json({ success: false, error: 'Failed to track' }, { status: 500 });
    }
  } catch (error) {
    console.error('Track initialize error:', error);
    return NextResponse.json({ success: false, error: 'Failed to track' }, { status: 500 });
  }
}

/**
 * Get "Initialize Chat" click count
 */
async function getInitializeCount(): Promise<number> {
  // Try Upstash Redis first (production)
  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.get<number>('initialize_chat_clicks');
      return Math.max(count || 0, 0);
    } catch (redisError) {
      console.error('Redis error:', redisError);
      // Fall through to SQLite
    }
  }

  // Fallback to SQLite (local development)
  try {
    const db = getDatabase();
    
    // Create table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS initialize_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clicked_at INTEGER NOT NULL
      );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM initialize_clicks').get() as { count: number };
    return Math.max(result.count || 0, 0);
  } catch (dbError) {
    // SQLite not available (e.g., in serverless) - return 0
    const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError);
    if (dbErrorMessage.includes('serverless') || dbErrorMessage.includes('SQLite not available')) {
      return 0;
    }
    console.error('Database error:', dbError);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Security: Rate limiting for stats endpoints
    const rateLimitResponse = await applyRateLimit(request, 'stats');
    if (rateLimitResponse) {
      try {
        const errorData = await rateLimitResponse.json();
        return NextResponse.json(errorData, {
          status: 429,
          headers: Object.fromEntries(rateLimitResponse.headers.entries())
        });
      } catch {
        return rateLimitResponse;
      }
    }

    const userCount = await getInitializeCount();

    // Security: Increment rate limit after validation
    await incrementRateLimit(request, 'stats');
    
    return NextResponse.json({ users: userCount, totalUsers: userCount });
  } catch (error) {
    console.error('Get initialize count error:', error);
    return NextResponse.json({ users: 0, totalUsers: 0 });
  }
}
