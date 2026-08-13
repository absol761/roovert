import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyRateLimit } from './app/lib/security/rateLimit';

// Cheap first-pass rate limit at the edge, shared (via Redis) across all
// serverless instances. Individual routes still apply their own
// endpoint-specific limits (ai-query, tracking, openrouter, stats) on top
// of this general one.
const GENERAL_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

export async function proxy(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for endpoints that apply their own (more lenient) limits
  const skipRateLimit = [
    '/api/stats', // Public stats endpoint
  ].some(path => request.nextUrl.pathname.startsWith(path));

  if (skipRateLimit) {
    return NextResponse.next();
  }

  // applyRateLimit atomically checks-and-consumes in one step (see
  // rateLimit.ts) - a separate checkRateLimit-then-incrementRateLimit here
  // would silently never enforce anything, since incrementRateLimit is now
  // a no-op (the old two-step pattern was a TOCTOU race under concurrent
  // requests; applyRateLimit is the only correct way to spend the quota).
  const rateLimitResponse = await applyRateLimit(request, 'general', GENERAL_CONFIG);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
