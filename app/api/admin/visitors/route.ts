// Admin endpoint to view unique visitor statistics
import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';

/**
 * GET /api/admin/visitors
 * 
 * Returns statistics about unique visitors.
 * 
 * Security Note: In production, you should add authentication/authorization
 * to protect this endpoint. For example:
 * - Check for an admin API key in headers
 * - Verify JWT token
 * - Check session authentication
 * 
 * Example protection:
 * const adminKey = request.headers.get('x-admin-key');
 * if (adminKey !== process.env.ADMIN_API_KEY) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function GET(request: Request) {
  try {
    const db = getDatabase();
    
    // Get total unique visitors
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
    
    // Get visitors from last 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentResult = db
      .prepare('SELECT COUNT(*) as count FROM unique_visitors WHERE last_seen > ?')
      .get(twentyFourHoursAgo) as { count: number };
    
    // Get visitors from last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const weeklyResult = db
      .prepare('SELECT COUNT(*) as count FROM unique_visitors WHERE last_seen > ?')
      .get(sevenDaysAgo) as { count: number };
    
    // Get visitors from last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const monthlyResult = db
      .prepare('SELECT COUNT(*) as count FROM unique_visitors WHERE last_seen > ?')
      .get(thirtyDaysAgo) as { count: number };
    
    // Get oldest and newest visitor timestamps
    const oldestVisitor = db
      .prepare('SELECT first_seen FROM unique_visitors ORDER BY first_seen ASC LIMIT 1')
      .get() as { first_seen: number } | undefined;
    
    const newestVisitor = db
      .prepare('SELECT first_seen FROM unique_visitors ORDER BY first_seen DESC LIMIT 1')
      .get() as { first_seen: number } | undefined;
    
    // Get total visit count (sum of all visit_count)
    const totalVisitsResult = db
      .prepare('SELECT SUM(visit_count) as total FROM unique_visitors')
      .get() as { total: number | null };
    
    return NextResponse.json({
      success: true,
      stats: {
        totalUniqueVisitors: totalResult.count,
        last24Hours: recentResult.count,
        last7Days: weeklyResult.count,
        last30Days: monthlyResult.count,
        totalVisits: totalVisitsResult.total || 0,
        oldestVisitorDate: oldestVisitor ? new Date(oldestVisitor.first_seen).toISOString() : null,
        newestVisitorDate: newestVisitor ? new Date(newestVisitor.first_seen).toISOString() : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch visitor statistics' },
      { status: 500 }
    );
  }
}

