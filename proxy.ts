import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyRateLimit } from './app/lib/security/rateLimit';

// Cheap first-pass rate limit at the edge, shared (via Redis) across all
// serverless instances. Individual routes still apply their own
// endpoint-specific limits (ai-query, tracking, openrouter, stats) on top
// of this general one.
const GENERAL_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

// Builds the Content-Security-Policy header value for a given per-request
// nonce. script-src intentionally omits 'unsafe-inline' - the nonce is what
// authorizes the one inline <script> in app/layout.tsx (see the matching
// nonce prop read via headers() there). style-src keeps 'unsafe-inline'
// since that's out of scope for the nonce migration (Tailwind/R3F inline
// styles may depend on it).
function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.segment.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.segment.io",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export async function proxy(request: NextRequest) {
  // Per-request nonce for the CSP script-src allowlist. Forwarded to Server
  // Components via the x-nonce request header (read in app/layout.tsx) and
  // also applied directly to the inline <script>'s nonce attribute there -
  // it must be the same value in both HTML nonce="" and the CSP header for
  // the browser to allow the inline script to execute.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const respondNext = () => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  };

  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return respondNext();
  }

  // Skip rate limiting for endpoints that apply their own (more lenient) limits
  const skipRateLimit = [
    '/api/stats', // Public stats endpoint
  ].some(path => request.nextUrl.pathname.startsWith(path));

  if (skipRateLimit) {
    return respondNext();
  }

  // applyRateLimit atomically checks-and-consumes in one step (see
  // rateLimit.ts) - a separate checkRateLimit-then-incrementRateLimit here
  // would silently never enforce anything, since incrementRateLimit is now
  // a no-op (the old two-step pattern was a TOCTOU race under concurrent
  // requests; applyRateLimit is the only correct way to spend the quota).
  const rateLimitResponse = await applyRateLimit(request, 'general', GENERAL_CONFIG);
  if (rateLimitResponse) {
    rateLimitResponse.headers.set('Content-Security-Policy', cspHeader);
    return rateLimitResponse;
  }

  return respondNext();
}

export const config = {
  // Runs on every route except static assets and Next's internal image
  // optimizer, so the CSP nonce is set on page requests too, not just
  // /api/*. The rate-limiting branch above still only fires for /api/*
  // paths, exactly as before - this just broadens what the proxy function
  // sees, not what it enforces.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
