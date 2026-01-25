/**
 * Comprehensive Rate Limiting System
 * Implements IP-based and user-based rate limiting with configurable limits
 * Follows OWASP best practices for rate limiting
 * 
 * Features:
 * - IP-based rate limiting (primary)
 * - User-based rate limiting (when user identifier available)
 * - Sliding window algorithm
 * - Graceful 429 responses with Retry-After headers
 * - Configurable limits per endpoint
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
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
  firstRequestAt: number;
}

// In-memory store (for production, consider Redis/Upstash)
const rateLimitStores = new Map<string, Map<string, RateLimitEntry>>();

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
  // Could use session ID, API key, or other user identifier
  const userId = request.headers.get('x-user-id');
  return userId || null;
}

/**
 * Check rate limit for a given identifier and configuration
 */
function checkRateLimitInternal(
  storeKey: string,
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  
  // Get or create store for this configuration
  let store = rateLimitStores.get(storeKey);
  if (!store) {
    store = new Map<string, RateLimitEntry>();
    rateLimitStores.set(storeKey, store);
  }

  let entry = store.get(identifier);

  // If no entry or reset time has passed, create new entry
  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
      firstRequestAt: now,
    };
    store.set(identifier, entry);
  }

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count < config.maxRequests;

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Increment rate limit counter
 */
function incrementRateLimitInternal(
  storeKey: string,
  identifier: string,
  config: RateLimitConfig
): void {
  const now = Date.now();
  
  let store = rateLimitStores.get(storeKey);
  if (!store) {
    store = new Map<string, RateLimitEntry>();
    rateLimitStores.set(storeKey, store);
  }

  let entry = store.get(identifier);

  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
      firstRequestAt: now,
    };
  }

  entry.count++;
  store.set(identifier, entry);

  // Clean up old entries periodically (older than 2x window)
  if (store.size > 10000) {
    const cutoff = now - (2 * config.windowMs);
    for (const [key, value] of store.entries()) {
      if (value.resetAt < cutoff) {
        store.delete(key);
      }
    }
  }
}

/**
 * Check rate limit for a request
 * Returns result with allowed status and remaining requests
 */
export function checkRateLimit(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): RateLimitResult {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const storeKey = `${endpointType}-${config.windowMs}-${config.maxRequests}`;
  
  // Try user-based first, fallback to IP-based
  const userId = getUserIdentifier(request);
  const identifier = userId || getClientIP(request);
  const identifierType = userId ? 'user' : 'ip';
  
  return checkRateLimitInternal(`${storeKey}-${identifierType}`, identifier, config);
}

/**
 * Increment rate limit counter for a request
 */
export function incrementRateLimit(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): void {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const storeKey = `${endpointType}-${config.windowMs}-${config.maxRequests}`;
  
  const userId = getUserIdentifier(request);
  const identifier = userId || getClientIP(request);
  const identifierType = userId ? 'user' : 'ip';
  
  incrementRateLimitInternal(`${storeKey}-${identifierType}`, identifier, config);
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
export function applyRateLimit(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): Response | null {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const result = checkRateLimit(request, endpointType, customConfig);
  
  if (!result.allowed) {
    return createRateLimitResponse(result, config);
  }
  
  return null;
}

/**
 * Get rate limit status for a request (for OpenRouter model hiding)
 * Returns detailed status including count, limit, remaining, and blocked status
 */
export function getRateLimitStatus(
  request: { headers: { get: (key: string) => string | null } },
  endpointType: keyof typeof DEFAULT_LIMITS = 'general',
  customConfig?: Partial<RateLimitConfig>
): {
  count: number;
  limit: number;
  remaining: number;
  resetAt: number;
  isBlocked: boolean;
} {
  const config = { ...DEFAULT_LIMITS[endpointType], ...customConfig };
  const result = checkRateLimit(request, endpointType, customConfig);
  
  // Calculate count from remaining
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
 * Used by frontend to conditionally hide models when rate limit is reached
 */
export function shouldHideOpenRouterModels(
  request: { headers: { get: (key: string) => string | null } }
): boolean {
  const status = getRateLimitStatus(request, 'openrouter');
  return status.isBlocked;
}
