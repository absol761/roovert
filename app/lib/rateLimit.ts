/**
 * OpenRouter Rate Limiting
 * Re-exports from comprehensive rate limiting system for backward compatibility
 */

// Re-export from comprehensive rate limiting system
export {
  getClientIP,
  getUserIdentifier,
  shouldHideOpenRouterModels,
  getRateLimitStatus,
  incrementRateLimit,
} from './security/rateLimit';
