/**
 * Comprehensive Rate Limiting System
 * Implements IP-based and user-based rate limiting with configurable limits
 * Follows OWASP best practices for rate limiting
 *
 * Features:
 * - IP-based rate limiting (primary)
 * - User-based rate limiting (when user identifier available)
 * - Fixed window algorithm, backed by Upstash Redis so limits are shared
 *   across serverless instances; falls back to a per-instance in-memory
 *   store if Redis isn't configured (e.g. local dev)
 * - Graceful 429 responses with Retry-After headers
 * - Configurable limits per endpoint
 */

import { getRedis } from '../redis';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback store, used only when Redis isn't configured.
const memoryStore = new Map<string, RateLimitEntry>();

// Default rate limit configurations per endpoint type
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // AI query endpoints - more restrictive due to cost
  'ai-query': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    message: 'Too many AI queries. Please wait before making another request.',
  },
  // General API endpoints
  'general': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'Rate limit exceeded. Please try again later.',
  },
  // Tracking/analytics endpoints - more lenient
  'tracking': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many tracking requests. Please slow down.',
  },
  // Stats endpoints - very lenient
  'stats': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests. Please wait.',
  },
  // OpenRouter-specific: 45 requests per 24 hours (different from general AI query limits)
  'openrouter': {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 45, // 45 requests per 24 hours
    message: 'OpenRouter rate limit exceeded. You\'ve used all 45 requests. The limit resets in 24 hours.',
  },
  // Hugging Face-specific: separate bucket from the shared 'ai-query' limit,
  // mirroring the 'openrouter' bucket above - a distinct external API with
  // its own quota deserves its own ceiling rather than sharing Groq's.
  'huggingface': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 30, // 30 requests per hour
    message: 'Hugging Face rate limit exceeded. Please wait before making another request.',
  },
  // Image generation is far more expensive per-request (a single
  // diffusion run takes ~15s of GPU time on the provider side) than a
  // chat completion, so it gets its own, much stricter bucket rather
  // than sharing 'huggingface' with the chat models.
  'huggingface-image': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 images per hour
    message: 'Image generation rate limit exceeded. Please wait before generating another image.',
  },
};

/**
 * Get client IP address from request headers
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
 */
export function getClientIP(request: { headers: { get: (key: string) => string | null } }): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  const ip = forwarded?.split(',')[0]?.trim() || realIp?.trim() || cfConnectingIp?.trim() || 'unknown';
  return ip;
}

/**
 * Get user identifier (for user-based rate limiting)
 * Can be extended to use session IDs, API keys, etc.
 */
export function getUserIdentifier(request: { headers: { get: (key: string) => string | null } }): string | null {
  const userId = request.headers.get('x-user-id');
  return userId || null;
}

/**
 * Read the current count for a key without incrementing it.
 */
async function peekCount(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const redis = getRedis();
  const now = Date.now();

  if (redis) {
    const [count, ttlMs] = await Promise.all([
      redis.get<number>(key),
      redis.pttl(key),
    ]);
    const resetAt = ttlMs && ttlMs > 0 ? now + ttlMs : now + windowMs;
    return { count: count ?? 0, resetAt };
  }

  const entry = memoryStore.get(key);
  if (!entry || now >= entry.resetAt) {
    return { count: 0, resetAt: now + windowMs };
  }
  return { count: entry.count, resetAt: entry.resetAt };
}

/**
 * Atomically increment the counter for a key, setting its expiry on first
 * increment within a window.
 */
async function incrementCount(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const redis = getRedis();
  const now = Date.now();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    const ttlMs = await redis.pttl(key);
    const resetAt = ttlMs && ttlMs > 0 ? now + ttlMs : now + windowMs;
    return { count, resetAt };
  }

  let entry = memoryStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }
  entry.count++;
  memoryStore.set(key, entry);

  // Clean up old entries periodically (bound memory growth)
  if (memoryStore.size > 10000) {
    for (const [k, v] of memoryStore.entries()) {
      if (now >= v.resetAt) memoryStore.delete(k);
    }
  }

  return { count: entry.count, resetAt: entry.resetAt };
}

function storeKey(endpointType: string, config: RateLimitConfig, identifierType: string, identifier: string): string {
  return `ratelimit:${endpointType}:${config.windowMs}:${config.maxRequests}:${identifierType}:${identifier}`;
}

function resolveIdentifier(request: { headers: { get: (key: string) => string | null } }): { identifier: string; identifierType: string } {
  const userId = getUserIdentifier(request);
  return userId
    ? { identifier: userId, identifierType: 'user' }
    : { identifier: getClientIP(request), identifierType: 'ip' };
}

/**
 * Check rate limit for a request WITHOUT consuming from the quota. Only
 * safe for read-only status checks (e.g. "should we hide OpenRouter models
 * in the UI") that don't gate an action - see checkAndConsumeRateLimit for
 * anything that actually needs to enforce the limit.
 */
export async function checkRateLimit(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const { identifier, identifierType } = resolveIdentifier(request);
  const key = storeKey(endpointType, config, identifierType, identifier);

  const { count, resetAt } = await peekCount(key, config.windowMs);
  const remaining = Math.max(0, config.maxRequests - count);

  return {
    allowed: count < config.maxRequests,
    remaining,
    resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Atomically increment-then-check a request's quota in one step. This is
 * the only correct way to enforce a limit: checking and incrementing as
 * two separate calls (the previous applyRateLimit + incrementRateLimit
 * pattern every route used) has a TOCTOU race - N concurrent requests from
 * the same IP can all pass the check before any of them has incremented,
 * so a burst blows straight through the limit. Redis INCR (and the
 * in-memory fallback's synchronous update) make this atomic per key.
 */
async function checkAndConsumeRateLimit(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS,
  customConfig?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const { identifier, identifierType } = resolveIdentifier(request);
  const key = storeKey(endpointType, config, identifierType, identifier);

  const { count, resetAt } = await incrementCount(key, config.windowMs);
  const remaining = Math.max(0, config.maxRequests - count);

  return {
    allowed: count <= config.maxRequests,
    remaining,
    resetAt,
    limit: config.maxRequests,
  };
}

/**
 * @deprecated No longer needed - applyRateLimit now atomically consumes
 * the quota itself. Kept as a no-op so existing call sites (every API
 * route calls this after applyRateLimit) don't need to change and don't
 * silently double-count if this file is touched again later.
 */
export async function incrementRateLimit(
  _request: { headers: { get: (key: string) => string | null } },
  _endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  _customConfig?: Partial<RateLimitConfig>
): Promise<void> {
  // Intentionally a no-op - see checkAndConsumeRateLimit.
}

/**
 * Create a 429 Too Many Requests response with proper headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  config: RateLimitConfig
): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: config.message || 'Rate limit exceeded',
      retryAfter,
      resetAt: new Date(result.resetAt).toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}

/**
 * Middleware helper to apply rate limiting to a request
 * Returns null if allowed, or a Response if rate limited
 */
export async function applyRateLimit(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): Promise<Response | null> {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const result = await checkAndConsumeRateLimit(request, endpointType, customConfig);

  if (!result.allowed) {
    return createRateLimitResponse(result, config);
  }

  return null;
}

/**
 * Get rate limit status for a request (for OpenRouter model hiding)
 * Returns detailed status including count, limit, remaining, and blocked status
 */
export async function getRateLimitStatus(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): Promise<{
  count: number;
  limit: number;
  remaining: number;
  resetAt: number;
  isBlocked: boolean;
}> {
  const result = await checkRateLimit(request, endpointType, customConfig);
  const count = result.limit - result.remaining;

  return {
    count: Math.max(0, count),
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt,
    isBlocked: !result.allowed,
  };
}

/**
 * Check if OpenRouter models should be hidden for this user
 * Used by the /api/openrouter/status endpoint to tell the client whether to
 * hide OpenRouter models (rate limit reached).
 */
export async function shouldHideOpenRouterModels(
  request: { headers: { get: (key: string) => string | null } }
): Promise<boolean> {
  const status = await getRateLimitStatus(request, 'openrouter');
  return status.isBlocked;
}
