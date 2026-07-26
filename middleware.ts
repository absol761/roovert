import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, incrementRateLimit, createRateLimitResponse } from './app/lib/security/rateLimit';

// Cheap first-pass rate limit at the edge, shared (via Redis) across all
// serverless instances. Individual routes still apply their own
// endpoint-specific limits (ai-query, tracking, openrouter, stats) on top
// of this general one.
const GENERAL_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

export async function middleware(request: NextRequest) {
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

  const result = await checkRateLimit(request, 'general', GENERAL_CONFIG);
  if (!result.allowed) {
    return createRateLimitResponse(result, { ...GENERAL_CONFIG, message: 'Rate limit exceeded. Please try again later.' });
  }
  await incrementRateLimit(request, 'general', GENERAL_CONFIG);

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
