// Privacy-focused tracking utilities
import { createHash } from 'crypto';

/**
 * Creates a privacy-focused unique identifier by hashing IP address and User-Agent
 * This ensures no raw PII is stored in the database
 */
export function createVisitorHash(ipAddress: string, userAgent: string): string {
  // Combine IP and User-Agent
  const combined = `${ipAddress}|${userAgent}`;
  
  // Hash using SHA-256 for strong privacy protection
  const hash = createHash('sha256');
  hash.update(combined);
  
  // Return hex digest (64 characters)
  return hash.digest('hex');
}

/**
 * Extracts IP address from request headers
 * Handles various proxy scenarios (X-Forwarded-For, X-Real-IP, etc.)
 *
 * Security: x-forwarded-for is a hop chain each proxy APPENDS to, not
 * replaces. With one trusted reverse proxy in front (Vercel's edge), the
 * LAST entry is the one that proxy appended; earlier entries are whatever
 * the client sent and must never be trusted as the real client IP.
 */
export function getClientIP(request: Request): string {
  // Check various headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare

  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback (shouldn't happen in production with proper proxy setup)
  return 'unknown';
}

/**
 * Gets User-Agent from request headers
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

