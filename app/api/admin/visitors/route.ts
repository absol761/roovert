// Admin endpoint to view unique visitor statistics
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { applyRateLimit, incrementRateLimit } from '../../../lib/security/rateLimit';

/**
 * GET /api/admin/visitors
 * 
 * Returns statistics about unique visitors.
 * 
 * Security: Protected by admin API key authentication and rate limiting.
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Rate limiting for admin endpoints (stricter)
    const rateLimitResponse = applyRateLimit(request, 'general', {
      maxRequests: 10, // More restrictive for admin
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return NextResponse.json(
        JSON.parse(await rateLimitResponse.text()),
        { status: 429, headers: Object.fromEntries(rateLimitResponse.headers.entries()) }
      );
    }

    // Security: Authentication check - API key must be in environment variable (never hardcoded)
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.ADMIN_API_KEY || process.env.AI_GATEWAY_API_KEY; // Support both for backward compatibility
    
    if (!expectedKey) {
      console.error('AI_GATEWAY_API_KEY not configured');
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 503 }
      );
    }
    
    if (!expectedKey) {
      console.error('ADMIN_API_KEY or AI_GATEWAY_API_KEY not configured in environment variables');
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 503 }
      );
    }
    
    if (!adminKey || adminKey !== expectedKey) {
      // Security: Don't reveal whether key exists or not (prevent enumeration)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Security: Increment rate limit after successful authentication
    incrementRateLimit(request, 'general');
    
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

