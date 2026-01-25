import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateBodySize, createValidationErrorResponse } from '../../lib/security/validation';

// Conditionally import KV (only if available)
let kv: any = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    kv = require('@vercel/kv').kv;
  }
} catch {
  // KV not available - will use SQLite fallback
}

/**
 * Track "Initialize Chat" click
 */
export async function POST(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Try Vercel KV first (production)
    if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await kv.incr('initialize_chat_clicks');
        return NextResponse.json({ success: true });
      } catch (kvError) {
        console.error('KV error:', kvError);
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
  // Try Vercel KV first (production)
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const count = (await kv.get('initialize_chat_clicks') as number) || 0;
      return Math.max(count, 0);
    } catch (kvError) {
      console.error('KV error:', kvError);
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
      return NextResponse.json(
        JSON.parse(await rateLimitResponse.text()),
        { status: 429, headers: Object.fromEntries(rateLimitResponse.headers.entries()) }
      );
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
