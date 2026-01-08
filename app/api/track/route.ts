// Privacy-focused visitor tracking endpoint
import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { createVisitorHash, getClientIP, getUserAgent } from '@/app/lib/tracking';

export async function POST(request: Request) {
  try {
    // Extract IP and User-Agent from request
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);
    
    // Create privacy-focused hash (no raw PII stored)
    const visitorHash = createVisitorHash(ipAddress, userAgent);
    
    const db = getDatabase();
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    // Check if this visitor has been seen in the last 24 hours
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
  } catch (error) {
    console.error('Tracking error:', error);
    // Return success even on error to avoid breaking the page load
    return NextResponse.json({ success: false, error: 'Tracking failed' }, { status: 500 });
  }
}

// Allow GET for simple health check
export async function GET() {
  try {
    const db = getDatabase();
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
    
    return NextResponse.json({
      success: true,
      totalUniqueVisitors: totalCount.count,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

