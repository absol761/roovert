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
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    // Try Vercel KV first (primary for production/serverless)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const visitorKey = `visitor_hash:${visitorHash}`;
        const lastSeen = await kv.get(visitorKey) as number | null;
        
        if (lastSeen) {
          // Existing visitor
          const isNewVisit = lastSeen < twentyFourHoursAgo;
          await kv.set(visitorKey, now, { ex: 86400 * 365 }); // Update last seen, extend expiry
          
          if (isNewVisit) {
            await kv.incr('total_visits'); // Increment total visits
          }
          
          const count = await kv.get('unique_visitors') as number || 0;
          return NextResponse.json({
            success: true,
            isNew: false,
            isNewVisit: isNewVisit,
            totalUniqueVisitors: count,
          });
        } else {
          // New unique visitor
          await kv.set(visitorKey, now, { ex: 86400 * 365, nx: true }); // Set if not exists
          const count = await kv.incr('unique_visitors');
          await kv.incr('total_visits');
          
          return NextResponse.json({
            success: true,
            isNew: true,
            isNewVisit: true,
            totalUniqueVisitors: count,
          });
        }
      } catch (kvError) {
        console.error('KV tracking error:', kvError);
        // Fall through to SQLite fallback
      }
    }
    
    // Fallback to SQLite (works locally)
    try {
      const db = getDatabase();
      
      // Check if this visitor has been seen before
      const existingVisitor = db
        .prepare('SELECT id, last_seen, visit_count FROM unique_visitors WHERE visitor_hash = ?')
        .get(visitorHash) as { id: number; last_seen: number; visit_count: number } | undefined;
      
      if (existingVisitor) {
        // Visitor exists - check if last visit was more than 24 hours ago
        const isNewVisit = existingVisitor.last_seen < twentyFourHoursAgo;
        
        if (isNewVisit) {
          // Update last_seen and increment visit_count
          db.prepare(
            'UPDATE unique_visitors SET last_seen = ?, visit_count = visit_count + 1 WHERE id = ?'
          ).run(now, existingVisitor.id);
        } else {
          // Same visitor within 24 hours - just update last_seen, don't increment count
          db.prepare('UPDATE unique_visitors SET last_seen = ? WHERE id = ?').run(now, existingVisitor.id);
        }
        
        // Get total unique visitor count
        const totalCount = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
        
        return NextResponse.json({
          success: true,
          isNew: false,
          isNewVisit: isNewVisit,
          totalUniqueVisitors: totalCount.count,
        });
      } else {
        // New unique visitor - insert into database
        db.prepare(
          'INSERT INTO unique_visitors (visitor_hash, first_seen, last_seen, visit_count) VALUES (?, ?, ?, 1)'
        ).run(visitorHash, now, now);
        
        // Get total unique visitor count
        const totalCount = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
        
        return NextResponse.json({
          success: true,
          isNew: true,
          isNewVisit: true,
          totalUniqueVisitors: totalCount.count,
        });
      }
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

