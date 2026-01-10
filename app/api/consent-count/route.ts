import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';

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
 * Cookie Consent Click Counter
 * 
 * Tracks how many times users have clicked the cookie consent banner.
 * This is used for the "People who've used Roovert" stat.
 */

const CONSENT_COUNT_KEY = 'consent_clicks_total';

export async function POST(request: Request) {
  try {
    // Try Vercel KV first (production)
    if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await kv.incr(CONSENT_COUNT_KEY);
        const count = await kv.get(CONSENT_COUNT_KEY) as number;
        
        return NextResponse.json({
          success: true,
          count: count || 0,
        });
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
        CREATE TABLE IF NOT EXISTS consent_clicks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clicked_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_clicked_at ON consent_clicks(clicked_at);
      `);

      // Insert click
      const now = Date.now();
      db.prepare('INSERT INTO consent_clicks (clicked_at) VALUES (?)').run(now);

      // Get total count
      const result = db.prepare('SELECT COUNT(*) as count FROM consent_clicks').get() as { count: number };
      
      return NextResponse.json({
        success: true,
        count: result.count || 0,
      });
    } catch (dbError: any) {
      // SQLite not available (e.g., in serverless) - return success with 0
      // This is expected in production on Vercel
      if (dbError.message?.includes('serverless') || dbError.message?.includes('SQLite not available')) {
        return NextResponse.json({
          success: true,
          count: 0,
          note: 'SQLite not available in serverless environment',
        });
      }
      console.error('Database error:', dbError);
      // Return success even if storage fails
      return NextResponse.json({
        success: true,
        count: 0,
        error: 'Storage unavailable',
      });
    }
  } catch (error: any) {
    console.error('Consent count error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Try Vercel KV first
    if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const count = (await kv.get(CONSENT_COUNT_KEY) as number) || 0;
        return NextResponse.json({
          success: true,
          count,
        });
      } catch (kvError) {
        console.error('KV error:', kvError);
        // Fall through to SQLite
      }
    }

    // Fallback to SQLite
    try {
      const db = getDatabase();
      const result = db.prepare('SELECT COUNT(*) as count FROM consent_clicks').get() as { count: number };
      
      return NextResponse.json({
        success: true,
        count: result.count || 0,
      });
    } catch (dbError: any) {
      // SQLite not available (e.g., in serverless) - return 0
      // This is expected in production on Vercel
      if (dbError.message?.includes('serverless') || dbError.message?.includes('SQLite not available')) {
        return NextResponse.json({
          success: true,
          count: 0,
        });
      }
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        count: 0,
      });
    }
  } catch (error: any) {
    console.error('Consent count fetch error:', error);
    return NextResponse.json({
      success: true,
      count: 0,
    });
  }
}
