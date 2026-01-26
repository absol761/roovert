import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client if environment variables are available
let redis: Redis | null = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

/**
 * Get "Initialize Chat" click count
 * This is now the only stat we track - number of times "Initialize Chat" has been clicked
 */
async function getInitializeCount(): Promise<number> {
  // Try Upstash Redis first (production)
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
  } catch (dbError: any) {
    // SQLite not available (e.g., in serverless) - return 0
    if (dbError.message?.includes('serverless') || dbError.message?.includes('SQLite not available')) {
      return 0;
    }
    console.error('Database error:', dbError);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Security: Rate limiting for stats endpoints (more lenient for public stats)
    const rateLimitResponse = applyRateLimit(request, 'stats');
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

    // Security: Increment rate limit after validation
    incrementRateLimit(request, 'stats');

    // Get "Initialize Chat" click count - this is now the only stat
    const userCount = await getInitializeCount();

    const stats = {
      users: userCount,
      totalUsers: userCount,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats API Error:', error);
    // Return safe defaults on error (no sensitive information)
    return NextResponse.json({
      users: 0,
      totalUsers: 0,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  }
}

