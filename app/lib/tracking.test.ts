import { describe, it, expect } from 'vitest';
import { createVisitorHash, getClientIP, getUserAgent } from './tracking';

describe('createVisitorHash', () => {
  it('returns a 64-character hex digest', () => {
    const hash = createVisitorHash('1.2.3.4', 'Mozilla/5.0');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for the same IP and user agent', () => {
    const first = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    const second = createVisitorHash('1.2.3.4', 'Mozilla/5.0');

    expect(first).toBe(second);
  });

  it('returns different hashes for different IP addresses', () => {
    const a = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    const b = createVisitorHash('5.6.7.8', 'Mozilla/5.0');

    expect(a).not.toBe(b);
  });

  it('returns different hashes for different user agents', () => {
    const a = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    const b = createVisitorHash('1.2.3.4', 'Chrome/1.0');

    expect(a).not.toBe(b);
  });

  it('does not leak the raw IP or user agent in the output', () => {
    const hash = createVisitorHash('1.2.3.4', 'Mozilla/5.0');

    expect(hash).not.toContain('1.2.3.4');
    expect(hash).not.toContain('Mozilla');
  });
});

describe('getClientIP', () => {
  it('prefers the first IP from X-Forwarded-For when multiple are present', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 10.0.0.2' },
    });

    expect(getClientIP(request)).toBe('9.9.9.9');
  });

  it('trims whitespace around the extracted X-Forwarded-For IP', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '  9.9.9.9  , 10.0.0.1' },
    });

    expect(getClientIP(request)).toBe('9.9.9.9');
  });

  it('falls back to X-Real-IP when X-Forwarded-For is absent', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-real-ip': '8.8.8.8' },
    });

    expect(getClientIP(request)).toBe('8.8.8.8');
  });

  it('falls back to CF-Connecting-IP when the other headers are absent', () => {
    const request = new Request('https://example.com', {
      headers: { 'cf-connecting-ip': '7.7.7.7' },
    });

    expect(getClientIP(request)).toBe('7.7.7.7');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const request = new Request('https://example.com');

    expect(getClientIP(request)).toBe('unknown');
  });

  it('prioritizes X-Forwarded-For over X-Real-IP and CF-Connecting-IP', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
        'cf-connecting-ip': '3.3.3.3',
      },
    });

    expect(getClientIP(request)).toBe('1.1.1.1');
  });
});

describe('getUserAgent', () => {
  it('returns the User-Agent header value when present', () => {
    const request = new Request('https://example.com', {
      headers: { 'user-agent': 'TestAgent/1.0' },
    });

    expect(getUserAgent(request)).toBe('TestAgent/1.0');
  });

  it('returns "unknown" when the User-Agent header is missing', () => {
    const request = new Request('https://example.com');

    expect(getUserAgent(request)).toBe('unknown');
  });
});
