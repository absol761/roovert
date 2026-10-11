import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { passthroughRateLimit, rateLimitStatusHandler } from './rateLimitHelpers';
import { applyRateLimit } from './rateLimit';

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function statusRequest(ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/openrouter?status', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('passthroughRateLimit', () => {
  it('re-wraps a JSON-bodied 429 Response as a NextResponse.json with the same status and headers', async () => {
    const original = NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: 30, resetAt: '2026-01-01T00:00:00.000Z' },
      {
        status: 429,
        headers: {
          'Retry-After': '30',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      }
    );

    const result = await passthroughRateLimit(original);

    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('30');
    expect(result.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(result.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(result.headers.get('Content-Type')).toContain('application/json');

    const body = await result.json();
    expect(body).toEqual({ error: 'Rate limit exceeded', retryAfter: 30, resetAt: '2026-01-01T00:00:00.000Z' });
  });

  it('preserves every header of the original response, not just a hardcoded subset', async () => {
    const original = new Response(JSON.stringify({ error: 'blocked' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        'Retry-After': '5',
      },
    });

    const result = await passthroughRateLimit(original);

    expect(result.headers.get('X-Custom-Header')).toBe('custom-value');
    expect(result.headers.get('Retry-After')).toBe('5');
  });

  it('falls back to returning the raw Response unchanged when the body is not JSON', async () => {
    const original = new Response('not json at all', {
      status: 503,
      headers: { 'Content-Type': 'text/plain', 'X-Marker': 'raw-fallback' },
    });

    const result = await passthroughRateLimit(original);

    // Same instance returned as-is - status/headers untouched (still 503,
    // not forced to 429), and the body is still readable as the original text.
    expect(result).toBe(original);
    expect(result.status).toBe(503);
    expect(result.headers.get('X-Marker')).toBe('raw-fallback');
  });

  it('falls back to the raw Response when the body is empty (also fails to parse as JSON)', async () => {
    const original = new Response('', { status: 429 });
    const result = await passthroughRateLimit(original);
    expect(result).toBe(original);
  });
});

describe('rateLimitStatusHandler', () => {
  it('reports a fresh, unblocked status for a client that has never used the given bucket', async () => {
    const request = statusRequest();
    const response = await rateLimitStatusHandler(request, 'openrouter');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ shouldHide: false, count: 0, limit: 45, remaining: 45 });
    expect(typeof body.resetAt).toBe('number');
  });

  it('reflects quota already consumed via applyRateLimit on the same bucket/IP', async () => {
    const ip = freshIp();
    await applyRateLimit(new NextRequest('http://localhost/api/huggingface', { headers: { 'x-forwarded-for': ip } }), 'huggingface');
    await applyRateLimit(new NextRequest('http://localhost/api/huggingface', { headers: { 'x-forwarded-for': ip } }), 'huggingface');

    const response = await rateLimitStatusHandler(statusRequest(ip), 'huggingface');
    const body = await response.json();

    expect(body).toMatchObject({ shouldHide: false, count: 2, limit: 30, remaining: 28 });
  });

  it('reports shouldHide: true once the queried bucket itself is exhausted', async () => {
    const ip = freshIp();
    const bucketRequest = () => new NextRequest('http://localhost/api/huggingface', { headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 30; i++) {
      await applyRateLimit(bucketRequest(), 'huggingface');
    }

    const response = await rateLimitStatusHandler(statusRequest(ip), 'huggingface');
    const body = await response.json();

    expect(body).toMatchObject({ shouldHide: true, count: 30, limit: 30, remaining: 0 });
  });

  it("checking the status does not itself consume the queried bucket's quota", async () => {
    const ip = freshIp();
    await rateLimitStatusHandler(statusRequest(ip), 'openrouter');
    await rateLimitStatusHandler(statusRequest(ip), 'openrouter');

    const response = await rateLimitStatusHandler(statusRequest(ip), 'openrouter');
    const body = await response.json();
    expect(body.count).toBe(0);
    expect(body.remaining).toBe(45);
  });

  it("returns the 429 passthrough once the handler's own 'stats' bucket is exhausted", async () => {
    const ip = freshIp();
    // The handler applies the 'stats' limit (100/min) to itself before
    // reporting status - exhaust that first.
    for (let i = 0; i < 100; i++) {
      await applyRateLimit(statusRequest(ip), 'stats');
    }

    const response = await rateLimitStatusHandler(statusRequest(ip), 'openrouter');

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
