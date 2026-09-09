// Admin endpoint to view unique visitor statistics
import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { getDatabase } from '@/app/lib/db';
import { applyRateLimit, incrementRateLimit } from '../../../lib/security/rateLimit';

/**
 * Constant-time key comparison. Plain `===` short-circuits on the first
 * mismatched byte, which leaks a timing signal proportional to how many
 * leading characters an attacker guessed correctly. Hashing both sides to a
 * fixed-length digest first also avoids leaking the expected key's length
 * via a length-check branch, before comparing with timingSafeEqual.
 */
function safeKeyEquals(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

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
    const rateLimitResponse = await applyRateLimit(request, 'general', {
      maxRequests: 10, // More restrictive for admin
      windowMs: 60 * 1000,
    });
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

    // Security: Authentication check - API key must be in environment variable (never hardcoded)
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.ADMIN_API_KEY || process.env.AI_GATEWAY_API_KEY; // Support both for backward compatibility
    
    if (!expectedKey) {
      console.error('ADMIN_API_KEY or AI_GATEWAY_API_KEY not configured in environment variables');
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 503 }
      );
    }

    if (!adminKey || !safeKeyEquals(adminKey, expectedKey)) {
      // Security: Don't reveal whether key exists or not (prevent enumeration)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Security: Increment rate limit after successful authentication
    await incrementRateLimit(request, 'general');
    
    const db = getDatabase();

    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Single pass over unique_visitors: conditional aggregates replace what
    // used to be 7 separate full/index scans of the same table (COUNT(*),
    // three windowed COUNTs, MIN/MAX of first_seen, SUM of visit_count).
    // Note on SQLite semantics: COUNT(*) is 0 on an empty table, but
    // SUM(...)/MIN()/MAX() all return NULL on zero rows (not 0/undefined),
    // so those are coalesced below exactly as the original per-query
    // undefined/null checks did.
    const stats = db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN last_seen > ? THEN 1 ELSE 0 END) as last24h,
           SUM(CASE WHEN last_seen > ? THEN 1 ELSE 0 END) as last7d,
           SUM(CASE WHEN last_seen > ? THEN 1 ELSE 0 END) as last30d,
           MIN(first_seen) as oldest,
           MAX(first_seen) as newest,
           SUM(visit_count) as totalVisits
         FROM unique_visitors`
      )
      .get(twentyFourHoursAgo, sevenDaysAgo, thirtyDaysAgo) as {
      total: number;
      last24h: number | null;
      last7d: number | null;
      last30d: number | null;
      oldest: number | null;
      newest: number | null;
      totalVisits: number | null;
    };

    return NextResponse.json({
      success: true,
      stats: {
        totalUniqueVisitors: stats.total,
        last24Hours: stats.last24h || 0,
        last7Days: stats.last7d || 0,
        last30Days: stats.last30d || 0,
        totalVisits: stats.totalVisits || 0,
        oldestVisitorDate: stats.oldest ? new Date(stats.oldest).toISOString() : null,
        newestVisitorDate: stats.newest ? new Date(stats.newest).toISOString() : null,
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

