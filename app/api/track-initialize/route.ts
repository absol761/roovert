import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateBodySize, createValidationErrorResponse } from '../../lib/security/validation';
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
 * Track "Initialize Chat" click
 */
export async function POST(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Try Upstash Redis first (production)
    if (redis) {
      try {
        await redis.incr('initialize_chat_clicks');
        return NextResponse.json({ success: true });
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
      incrementRateLimit(request, 'tracking');
      
      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      if (dbError.message?.includes('serverless') || dbError.message?.includes('SQLite not available')) {
        return NextResponse.json({ success: true }); // Silent success in serverless
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
    // Security: Rate limiting for stats endpoints
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

    const userCount = await getInitializeCount();
    
    // Security: Increment rate limit after validation
    incrementRateLimit(request, 'stats');
    
    return NextResponse.json({ users: userCount, totalUsers: userCount });
  } catch (error) {
    console.error('Get initialize count error:', error);
    return NextResponse.json({ users: 0, totalUsers: 0 });
  }
}
