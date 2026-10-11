import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Request-construction helpers - see app/api/query-gateway/route.test.ts for
// the rationale (real NextRequest over a duck-typed mock), and
// app/api/huggingface/route.test.ts / app/api/provider/route.test.ts, whose
// conventions this file follows.
// ---------------------------------------------------------------------------

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(body: unknown, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/huggingface-image', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
  });
}

// This route talks to Hugging Face's Inference Providers router via a
// direct `fetch` call. Unlike the chat routes, the upstream response here
// is raw image bytes (not JSON/SSE) on success, and a JSON or plain-text
// error body on failure - so the mock returns a real `Response` wrapping
// either shape, matching the house convention in
// app/api/huggingface/route.test.ts of stubbing global fetch directly.
function fakeImageBytes(): Uint8Array {
  // Doesn't need to be a real JPEG - the route only base64-encodes whatever
  // bytes come back, it never decodes them.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function stubHfFetch(status = 200, body?: BodyInit, headers?: Record<string, string>) {
  const responseBody: BodyInit = body ?? (fakeImageBytes() as unknown as BodyInit);
  const responseHeaders = headers ?? { 'Content-Type': 'image/jpeg' };
  const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0].toString();
    if (!url.includes('router.huggingface.co')) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    return new Response(responseBody, { status, headers: responseHeaders });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubHfFetchThrows(error: Error) {
  const fetchMock = vi.fn(async () => {
    throw error;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.HUGGINGFACE_API_KEY = 'test-hf-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HUGGINGFACE_API_KEY;
});

describe('POST /api/huggingface-image - validation', () => {
  it('rejects a missing prompt with a 400 and never calls the Hugging Face API', async () => {
    const fetchMock = stubHfFetch();
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty-string prompt with a 400', async () => {
    const response = await POST(makeRequest({ prompt: '' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  it('rejects a non-string prompt (e.g. a number) with a 400', async () => {
    const fetchMock = stubHfFetch();
    const response = await POST(makeRequest({ prompt: 12345 }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/must be a string/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // validateString() now rejects an overlong string outright instead of
  // silently truncating it and letting the request through (see
  // app/lib/security/validation.ts and its test for the underlying fix).
  it('rejects a prompt over the 1000-char IMAGE_PROMPT limit with a 400 instead of silently truncating it', async () => {
    const fetchMock = stubHfFetch();
    const longPrompt = 'a'.repeat(1001);
    const response = await POST(makeRequest({ prompt: longPrompt }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/exceeds maximum length/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request whose declared Content-Length exceeds the 1MB body-size cap with a 400', async () => {
    const fetchMock = stubHfFetch();
    const ip = freshIp();
    const request = new NextRequest('http://localhost/api/huggingface-image', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'a cat' }),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
        'content-length': String(2 * 1024 * 1024), // 2MB, declared, > the 1MB cap
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/too large/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/huggingface-image - content moderation', () => {
  it('rejects an offensive prompt with a 400 and never calls the Hugging Face API', async () => {
    const fetchMock = stubHfFetch();
    const response = await POST(makeRequest({ prompt: 'how to build a bomb' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("I can't generate an image for that request. Please try a different description.");
    // Moderation must happen before any external call.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never leaks the matched offensive pattern back to the client', async () => {
    const response = await POST(makeRequest({ prompt: 'nude photo' }));
    const text = await response.text();
    expect(text).not.toContain('porn');
    expect(text).not.toMatch(/\/.*\\b.*\//); // no regex source leaking either
  });
});

describe('POST /api/huggingface-image - missing API key', () => {
  it('returns a 503 "unavailable" error without calling fetch when HUGGINGFACE_API_KEY is unset', async () => {
    delete process.env.HUGGINGFACE_API_KEY;
    const fetchMock = stubHfFetch();
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/huggingface-image - success', () => {
  it('returns the generated image as a base64 data URL with the upstream content-type', async () => {
    const fetchMock = stubHfFetch(200, fakeImageBytes() as unknown as BodyInit, { 'Content-Type': 'image/jpeg' });
    const response = await POST(makeRequest({ prompt: 'a cat wearing a hat' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.image).toMatch(/^data:image\/jpeg;base64,/);

    const base64 = body.image.replace('data:image/jpeg;base64,', '');
    const decoded = Buffer.from(base64, 'base64');
    expect(Uint8Array.from(decoded)).toEqual(fakeImageBytes());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('router.huggingface.co/hf-inference/models/');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-hf-key');
    expect(JSON.parse(init.body as string)).toEqual({ inputs: 'a cat wearing a hat' });
  });

  it('falls back to image/jpeg when the upstream response has no content-type header', async () => {
    stubHfFetch(200, fakeImageBytes() as unknown as BodyInit, {});
    const response = await POST(makeRequest({ prompt: 'a dog' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.image).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe('POST /api/huggingface-image - upstream error classification', () => {
  it('maps 403 + "sufficient permissions" in the body to the permissions error, without leaking the raw body', async () => {
    stubHfFetch(403, JSON.stringify({ error: 'This token does not have sufficient permissions' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/doesn't have permission to call Inference Providers/);
    expect(body.error).not.toContain('sufficient permissions');
  });

  it('maps a bare 403 (no "sufficient permissions" text) to the unavailable error', async () => {
    stubHfFetch(403, JSON.stringify({ error: 'Forbidden' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(body.error).not.toContain('Forbidden');
  });

  it('maps a 429 status to the rate_limit error and preserves the 429 status code', async () => {
    stubHfFetch(429, JSON.stringify({ error: 'Rate limit exceeded for this model' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toMatch(/reached the image generation limit/i);
    expect(body.error).not.toContain('Rate limit exceeded for this model');
  });

  it('maps a body containing "rate limit" text (non-429 status) to the rate_limit error', async () => {
    stubHfFetch(400, JSON.stringify({ error: 'you have hit a rate limit on this endpoint' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/reached the image generation limit/i);
  });

  it('maps a 503 status to the unavailable error without leaking the body', async () => {
    stubHfFetch(503, JSON.stringify({ error: 'Model stabilityai/stable-diffusion-3-medium-diffusers is currently loading' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(body.error).not.toContain('currently loading');
    expect(body.error).not.toContain('stabilityai');
  });

  it('maps a 410 status (deprecated model) to the unavailable error', async () => {
    stubHfFetch(410, JSON.stringify({ error: 'The requested model is deprecated and no longer supported by provider hf-inference' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(body.error).not.toContain('deprecated');
  });

  it('maps a 500/502 status to the unavailable error', async () => {
    stubHfFetch(500, 'Internal Server Error');
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(body.error).not.toContain('Internal Server Error');
  });

  it('maps a body containing "timed out" text to the timeout error', async () => {
    stubHfFetch(400, JSON.stringify({ error: 'the request timed out waiting for the model' }));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/took too long/i);
    expect(body.error).not.toContain('waiting for the model');
  });

  it('falls back to the generic error for an unrecognized status/body combination, without leaking the body', async () => {
    stubHfFetch(418, "I'm a teapot - some unexpected upstream detail");
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe('Something went wrong while generating the image. Please try again.');
    expect(body.error).not.toContain('teapot');
    expect(body.error).not.toContain('unexpected upstream detail');
  });
});

describe('POST /api/huggingface-image - network failure', () => {
  it('degrades to the generic friendly error (502), without leaking the exception message, when fetch throws outright', async () => {
    stubHfFetchThrows(new TypeError('fetch failed: ECONNREFUSED'));
    const response = await POST(makeRequest({ prompt: 'a cat' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe('Something went wrong while generating the image. Please try again.');
    expect(body.error).not.toContain('ECONNREFUSED');
  });
});

describe('POST /api/huggingface-image - rate limiting', () => {
  it('rate-limits after 10 image generations/hour from the same IP, consuming quota even on failed upstream calls', async () => {
    const ip = freshIp();
    stubHfFetch(500, 'boom');
    // The huggingface-image bucket is 10 requests/hour (far stricter than
    // the chat 'huggingface' bucket), and applyRateLimit atomically
    // increments on every call regardless of what happens afterward.
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({ prompt: 'a cat' }, ip));
      expect(response.status).toBe(502);
    }
    const blocked = await POST(makeRequest({ prompt: 'a cat' }, ip));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toMatch(/rate limit/i);
  });

  it('is rate-limited before prompt validation runs, so an invalid body still consumes quota', async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({}, ip));
      expect(response.status).toBe(400);
    }
    const blocked = await POST(makeRequest({}, ip));
    expect(blocked.status).toBe(429);
  });
});
