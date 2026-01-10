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
 * The "People who've used Roovert" stat is based on cookie consent clicks.
 * Each time someone clicks Accept or Decline on the cookie banner, it counts as one person.
 */
async function getConsentClickCount(): Promise<number> {
  // Try Vercel KV first (production)
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const count = (await kv.get('consent_clicks_total') as number) || 0;
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
      CREATE TABLE IF NOT EXISTS consent_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clicked_at INTEGER NOT NULL
      );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM consent_clicks').get() as { count: number };
    return Math.max(result.count || 0, 0);
  } catch (dbError: any) {
    // SQLite not available (e.g., in serverless) - return 0
    // This is expected in production on Vercel
    if (dbError.message?.includes('serverless') || dbError.message?.includes('SQLite not available')) {
      return 0;
    }
    console.error('Database error:', dbError);
    return 0;
  }
}

export async function GET() {
  try {
    const now = new Date();
    
    // Get consent click count (this is our "People who've used Roovert" number)
    const consentClicks = await getConsentClickCount();
    
    // Calculate derived stats based on consent clicks
    // Assume each person who clicked consent has made ~3 queries on average
    const queriesProcessed = Math.max(consentClicks * 3, 0);
    
    // Active users: estimate based on time of day
    const hour = now.getUTCHours();
    const cycle = Math.sin(((hour - 14) * Math.PI) / 12);
    const activityFactor = 0.3 + ((cycle + 1) / 2 * 0.7);
    const activeUsers = Math.max(1, Math.floor(consentClicks * 0.1 * activityFactor));

    const stats = {
      queriesProcessed,
      activeUsers,
      uniqueMinds: consentClicks,
      totalVisitors: consentClicks,
      visitsLast24Hours: Math.floor(consentClicks * 0.15),
      visitsLast7Days: Math.floor(consentClicks * 0.35),
      visitsLast30Days: Math.floor(consentClicks * 0.60),
      totalVisits: queriesProcessed,
      accuracy: '99.4',
      uptime: '99.99%',
      timestamp: now.toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats API Error:', error);
    // Return safe defaults on error
    return NextResponse.json({
      queriesProcessed: 0,
      activeUsers: 0,
      uniqueMinds: 0,
      totalVisitors: 0,
      visitsLast24Hours: 0,
      visitsLast7Days: 0,
      visitsLast30Days: 0,
      totalVisits: 0,
      accuracy: '99.4',
      uptime: '99.99%',
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  }
}

