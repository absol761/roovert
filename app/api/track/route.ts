// Privacy-focused visitor tracking endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { createVisitorHash, getClientIP, getUserAgent } from '@/app/lib/tracking';
import { kv } from '@vercel/kv';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateBodySize, createValidationErrorResponse } from '../../lib/security/validation';

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting for tracking endpoints
    const rateLimitResponse = await applyRateLimit(request, 'tracking');
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

    // Security: Validate request body size
    const contentLength = request.headers.get('content-length');
    const bodySizeErrors = validateBodySize(contentLength, 1024 * 1024); // 1MB max
    if (bodySizeErrors.length > 0) {
      return createValidationErrorResponse(bodySizeErrors);
    }
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

        // Get the current total unique visitors count (real, honest count)
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

      // Get total unique visitor count (real, honest count)
      const totalCount = db.prepare('SELECT COUNT(*) as count FROM unique_visitors').get() as { count: number };
      const visitorCount = totalCount.count || 0;

      // Security: Increment rate limit after successful processing
      await incrementRateLimit(request, 'tracking');

      return NextResponse.json({
        success: true,
        isNew: isNew,
        totalUniqueVisitors: visitorCount,
      });
    } catch (dbError) {
      console.error('Database error in tracking:', dbError);

      // Security: Increment rate limit even on error (to prevent retry abuse)
      await incrementRateLimit(request, 'tracking');

      // Storage genuinely failed - be honest about it rather than fabricating a count
      return NextResponse.json({
        success: false,
        error: 'Tracking storage unavailable',
      });
    }
  } catch (error) {
    console.error('Tracking error:', error);
    // Security: Don't expose internal error details, but don't fabricate a count either
    return NextResponse.json({
      success: false,
      error: 'Tracking failed',
    });
  }
}

// Allow GET for simple health check
export async function GET(request: NextRequest) {
  // Security: Rate limiting for stats endpoints
  const rateLimitResponse = await applyRateLimit(request, 'stats');
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

  // Security: Increment rate limit after validation
  await incrementRateLimit(request, 'stats');
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
