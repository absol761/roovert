// Privacy-focused visitor tracking endpoint
import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { createVisitorHash, getClientIP, getUserAgent } from '@/app/lib/tracking';
import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  try {
    // Extract IP and User-Agent from request
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);
    
    if (!ipAddress || !userAgent) {
      console.warn('Missing IP or User-Agent for tracking');
      return NextResponse.json({ success: false, error: 'Missing tracking data' }, { status: 400 });
    }
    
    // Create privacy-focused hash (no raw PII stored)
    const visitorHash = createVisitorHash(ipAddress, userAgent);
    
    const now = Date.now();
    
    // Try Vercel KV first (primary for production/serverless)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const visitorKey = `visitor:${visitorHash}`;
        
        // Use SET with nx: true to ensure visitor is only counted once (lifetime unique)
        // No expiry (TTL) means the visitor is remembered forever
        const setResult = await kv.set(visitorKey, true, { nx: true });
        
        let isNew = false;
        if (setResult === 'OK') {
          // Brand new visitor - increment the unique counter
          await kv.incr('unique_visitors');
          isNew = true;
        }
        
        // Get the current total unique visitors count
        const totalUniqueVisitors = (await kv.get('unique_visitors') as number) || 0;
        
        return NextResponse.json({
          success: true,
          isNew: isNew,
          totalUniqueVisitors: totalUniqueVisitors,
        });
      } catch (kvError) {
        console.error('KV tracking error:', kvError);
        // Fall through to SQLite fallback
      }
    }
    
    // Fallback to SQLite (works locally)
    try {
      const db = getDatabase();
      
      // Use INSERT OR IGNORE to match KV's "set if not exists" logic
      // This ensures a visitor is only counted once (lifetime unique)
      const insertResult = db
        .prepare(
          'INSERT OR IGNORE INTO unique_visitors (visitor_hash, first_seen, last_seen, visit_count) VALUES (?, ?, ?, 1)'
        )
        .run(visitorHash, now, now);
      
      // Check if a new row was inserted (changes > 0 means it was a new visitor)
      const isNew = insertResult.changes > 0;
      
      // Get total unique visitor count
      const totalCount = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
      
      return NextResponse.json({
        success: true,
        isNew: isNew,
        totalUniqueVisitors: totalCount.count,
      });
    } catch (dbError) {
      console.error('Database error in tracking:', dbError);
      
      // If all else fails, still return success to not break the page
      return NextResponse.json({ 
        success: true, // Return success even if storage fails
        error: 'Tracking storage unavailable',
        totalUniqueVisitors: 0
      });
    }
  } catch (error) {
    console.error('Tracking error:', error);
    // Return success even on error to avoid breaking the page load
    return NextResponse.json({ 
      success: false, 
      error: 'Tracking failed',
      totalUniqueVisitors: 0
    });
  }
}

// Allow GET for simple health check
export async function GET() {
  try {
    // Try KV first
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const count = await kv.get('unique_visitors') as number || 0;
        return NextResponse.json({
          success: true,
          totalUniqueVisitors: count,
        });
      } catch (kvError) {
        console.error('KV GET error:', kvError);
      }
    }
    
    // Fallback to SQLite
    try {
      const db = getDatabase();
      const totalCount = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
      
      return NextResponse.json({
        success: true,
        totalUniqueVisitors: totalCount.count,
      });
    } catch (dbError) {
      console.error('SQLite GET error:', dbError);
      return NextResponse.json({
        success: true,
        totalUniqueVisitors: 0,
      });
    }
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ success: true, totalUniqueVisitors: 0 });
  }
}

