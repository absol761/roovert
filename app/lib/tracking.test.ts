import { describe, it, expect } from 'vitest';
import { createVisitorHash, getClientIP, getUserAgent } from './tracking';

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/track', { headers });
}

describe('createVisitorHash', () => {
  it('returns a 64-character hex SHA-256 digest', () => {
    const hash = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same IP + User-Agent', () => {
    const a = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    const b = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    expect(a).toBe(b);
  });

  it('produces different hashes for different IPs', () => {
    const a = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    const b = createVisitorHash('5.6.7.8', 'Mozilla/5.0');
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different User-Agents', () => {
    const a = createVisitorHash('1.2.3.4', 'Mozilla/5.0');
    const b = createVisitorHash('1.2.3.4', 'curl/8.0');
    expect(a).not.toBe(b);
  });

  it('does not collide when the IP|UA split point shifts (no raw string equality)', () => {
    // "1.2.3.4|xyz" and "1.2.3.4x|yz" combine to different strings even
    // though naive concatenation without a separator could collide here.
    const a = createVisitorHash('1.2.3.4', 'xyz');
    const b = createVisitorHash('1.2.3.4x', 'yz');
    expect(a).not.toBe(b);
  });
});

describe('getClientIP', () => {
  it('trusts the last hop of x-forwarded-for (the value the proxy appended)', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
    expect(getClientIP(request)).toBe('9.10.11.12');
  });

  it('trims whitespace and ignores empty hops in x-forwarded-for', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '1.2.3.4,  , 9.10.11.12 ,' });
    expect(getClientIP(request)).toBe('9.10.11.12');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const request = requestWithHeaders({ 'x-real-ip': '  8.8.8.8  ' });
    expect(getClientIP(request)).toBe('8.8.8.8');
  });

  it('falls back to cf-connecting-ip when neither forwarded header is present', () => {
    const request = requestWithHeaders({ 'cf-connecting-ip': '1.1.1.1' });
    expect(getClientIP(request)).toBe('1.1.1.1');
  });

  it('returns "unknown" when no identifying headers are present', () => {
    const request = requestWithHeaders({});
    expect(getClientIP(request)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip and cf-connecting-ip when all are present', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '2.2.2.2',
      'x-real-ip': '3.3.3.3',
      'cf-connecting-ip': '4.4.4.4',
    });
    expect(getClientIP(request)).toBe('2.2.2.2');
  });

  it('prefers x-real-ip over cf-connecting-ip when x-forwarded-for is absent', () => {
    const request = requestWithHeaders({ 'x-real-ip': '3.3.3.3', 'cf-connecting-ip': '4.4.4.4' });
    expect(getClientIP(request)).toBe('3.3.3.3');
  });
});

describe('getUserAgent', () => {
  it('returns the user-agent header value', () => {
    const request = requestWithHeaders({ 'user-agent': 'Mozilla/5.0 Test' });
    expect(getUserAgent(request)).toBe('Mozilla/5.0 Test');
  });

  it('returns "unknown" when no user-agent header is present', () => {
    const request = requestWithHeaders({});
    expect(getUserAgent(request)).toBe('unknown');
  });
});
