// Shared helpers for the two rate-limit boilerplate patterns copy-pasted
// across the AI provider and tracking routes.
import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, incrementRateLimit, getRateLimitStatus } from './rateLimit';

type RateLimitBucket = Parameters<typeof getRateLimitStatus>[1];

// Re-wraps a 429 Response from applyRateLimit as NextResponse.json so it
// carries the rate-limit headers correctly under Next's routing, falling
// back to returning the raw Response if it isn't JSON.
export async function passthroughRateLimit(rateLimitResponse: Response): Promise<Response> {
  try {
    const errorData = await rateLimitResponse.json();
    return NextResponse.json(errorData, {
      status: 429,
      headers: Object.fromEntries(rateLimitResponse.headers.entries()),
    });
  } catch {
    return rateLimitResponse;
  }
}

// GET /api/<provider>?status handler: apply the 'stats' rate limit, then
// report the current status of `bucket` (used to hide/disable UI once a
// session has exhausted its quota).
export async function rateLimitStatusHandler(request: NextRequest, bucket: RateLimitBucket): Promise<Response> {
  const rateLimitResponse = await applyRateLimit(request, 'stats');
  if (rateLimitResponse) {
    return passthroughRateLimit(rateLimitResponse);
  }

  const status = await getRateLimitStatus(request, bucket);
  await incrementRateLimit(request, 'stats');

  return NextResponse.json({
    shouldHide: status.isBlocked,
    count: status.count,
    limit: status.limit,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
}
