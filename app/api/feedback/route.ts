// Lightweight message feedback (thumbs up/down) logging endpoint.
// Mirrors the privacy-focused pattern used by /api/track: no message
// content, no visitor identifier - just a rating, a model id, and a
// rounded timestamp, so we can see which models get thumbs-down without
// storing anything resembling conversation content.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/db';
import { kv } from '@vercel/kv';
import { applyRateLimit } from '../../lib/security/rateLimit';
import { validateBodySize, validateFeedbackRequest, createValidationErrorResponse } from '../../lib/security/validation';

// Round timestamps to the hour - enough resolution to see trends over time
// without being able to correlate feedback to a precise moment/session.
const HOUR_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting for feedback endpoint (shares the lenient
    // 'tracking' bucket - this is analytics, not a cost-bearing action)
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

    // Security: Parse and validate payload
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return createValidationErrorResponse(['Invalid JSON body']);
    }

    const validation = validateFeedbackRequest(payload);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors);
    }

    const { rating, modelId } = validation.sanitized!;
    const roundedTimestamp = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;

    // Try Vercel KV first (primary for production/serverless)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await Promise.all([
          kv.incr(`feedback:total:${rating}`),
          kv.hincrby(`feedback:by_model:${rating}`, modelId, 1),
        ]);

        return NextResponse.json({ success: true });
      } catch (kvError) {
        console.error('KV feedback error:', kvError);
        // Fall through to SQLite fallback
      }
    }

    // Fallback to SQLite (works locally)
    try {
      const db = getDatabase();

      db.prepare(
        'INSERT INTO message_feedback (rating, model_id, created_at) VALUES (?, ?, ?)'
      ).run(rating, modelId, roundedTimestamp);

      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database error in feedback:', dbError);

      // Storage genuinely failed - be honest about it rather than pretending
      return NextResponse.json({
        success: false,
        error: 'Feedback storage unavailable',
      });
    }
  } catch (error) {
    console.error('Feedback error:', error);
    // Security: Don't expose internal error details
    return NextResponse.json({
      success: false,
      error: 'Feedback failed',
    });
  }
}
