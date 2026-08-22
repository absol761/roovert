import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/news', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/news', () => {
  it('fetches exactly the top 3 story ids, even when the index has many more', async () => {
    const allIds = Array.from({ length: 50 }, (_, i) => i + 1);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('topstories.json')) {
        return jsonResponse(allIds);
      }
      const idMatch = url.match(/item\/(\d+)\.json/);
      const id = idMatch ? Number(idMatch[1]) : -1;
      return jsonResponse({ id, title: `Story ${id}` });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const stories = await response.json();
    expect(stories).toHaveLength(3);
    expect(stories.map((s: { id: number }) => s.id)).toEqual([1, 2, 3]);
    // 1 index fetch + 3 story fetches, never more.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns a generic 500 without leaking details when the index fetch itself fails (non-ok)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null, false)));

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to fetch news');
  });

  it('returns a generic 500 without leaking details when the index fetch throws (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed: ECONNREFUSED');
      })
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to fetch news');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('returns a generic 500 when one of the individual story fetches fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('topstories.json')) {
        return jsonResponse([1, 2, 3]);
      }
      if (url.includes('/item/2.json')) {
        throw new Error('story 2 unavailable');
      }
      return jsonResponse({ id: 1, title: 'ok' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });

  it('rate-limits after 100 requests/minute from the same IP (the lenient "stats" bucket)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('topstories.json')) return jsonResponse([1]);
      return jsonResponse({ id: 1 });
    }));

    const ip = freshIp();
    for (let i = 0; i < 100; i++) {
      const response = await GET(makeRequest(ip));
      expect(response.status).toBe(200);
    }
    const blocked = await GET(makeRequest(ip));
    expect(blocked.status).toBe(429);
  });
});
