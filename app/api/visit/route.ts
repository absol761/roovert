// roovert/app/api/visit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';
import { validateTrackingRequest, validateBodySize, createValidationErrorResponse } from '../../lib/security/validation';

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting for tracking endpoints
    const rateLimitResponse = applyRateLimit(request, 'tracking');
    if (rateLimitResponse) {
      return NextResponse.json(
        JSON.parse(await rateLimitResponse.text()),
        { status: 429, headers: Object.fromEntries(rateLimitResponse.headers.entries()) }
      );
    }

    // Security: Validate request body size
    const contentLength = request.headers.get('content-length');
    const bodySizeErrors = validateBodySize(contentLength, 1024 * 1024); // 1MB max
    if (bodySizeErrors.length > 0) {
      return createValidationErrorResponse(bodySizeErrors);
    }

    // Security: Parse and validate payload
    let body;
    try {
      body = await request.json();
    } catch (jsonError: any) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Security: Validate tracking request
    const validation = validateTrackingRequest(body);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    const { visitorId, fingerprint } = validation.sanitized!;

    if (!visitorId) {
      return NextResponse.json({ error: 'Visitor ID required' }, { status: 400 });
    }

    // If KV is connected, track unique visitors properly
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        // Check if this visitor ID has been seen before
        const seenKey = `visitor:${visitorId}`;
        const isNew = await kv.set(seenKey, '1', { ex: 86400 * 365, nx: true }); // Expire after 1 year, only set if not exists

        if (isNew === 'OK') {
          // New visitor - increment counter
          const count = await kv.incr('unique_visitors');
          
          // Also store fingerprint for deduplication
          if (fingerprint) {
            const fpKey = `fp:${fingerprint}`;
            await kv.set(fpKey, visitorId, { ex: 86400 * 365 });
          }

          return NextResponse.json({ success: true, count, isNew: true });
        } else {
          // Returning visitor - just return current count
          const count = await kv.get('unique_visitors') || 0;
          // Security: Increment rate limit after successful processing
          incrementRateLimit(request, 'tracking');
          
          return NextResponse.json({ success: true, count: Number(count), isNew: false });
        }
      } catch (kvError) {
        console.error('KV Error:', kvError);
        // Fall through to fallback
      }
    }
    
    // Security: Increment rate limit even on fallback
    incrementRateLimit(request, 'tracking');
    
    // Fallback if no KV (silent success)
    return NextResponse.json({ success: true, mode: 'simulation' });
  } catch (error) {
    console.error('Visit tracking error:', error);
    // Security: Don't expose internal error details
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

