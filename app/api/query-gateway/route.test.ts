import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Request-construction helpers. NextRequest is a thin wrapper around the
// standard Request, so building a real one (rather than a duck-typed mock,
// as rateLimit.test.ts does for the lib-level helpers) lets this route's
// actual `request.json()` / header-reading code paths run for real.
// ---------------------------------------------------------------------------

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(body: unknown, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/query-gateway', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
  });
}

interface OutgoingGroqMessage {
  role: string;
  content: string;
}

// Builds an OpenAI-compatible SSE stream. This matches the wire shape that
// Groq's event-source parser expects - the `ai` SDK's Groq provider parses
// raw fetch responses itself, so the mocked `fetch` below stands in for the
// real Groq HTTP endpoint.
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: c }, finish_reason: null }] })}\n\n`
          )
        );
      }
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
      );
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// Stubs global fetch so the AI SDK's Groq provider (which calls fetch
// internally, not something this route calls directly) talks to our fake
// endpoint instead of the real network.
function stubGroqFetch(chunks: string[] = ['ok']) {
  const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0].toString();
    if (!url.includes('api.groq.com')) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    return sseResponse(chunks);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function sentBody(fetchMock: ReturnType<typeof stubGroqFetch>): Promise<{ model: string; messages: OutgoingGroqMessage[] }> {
  expect(fetchMock).toHaveBeenCalled();
  const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
  return JSON.parse(init.body as string) as { model: string; messages: OutgoingGroqMessage[] };
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-groq-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/query-gateway', () => {
  it('rejects a request with no query with a 400', async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  it('rejects an unrecognized model id with a 400 rather than silently substituting one', async () => {
    const response = await POST(makeRequest({ query: 'hi', model: 'not-a-real-model' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/Invalid model ID/);
  });

  it('accepts a Hugging Face model id (valid in the combined allowlist) but falls back to the Groq default rather than calling Groq with it', async () => {
    // 'hf-qwen-2.5-7b' is a member of ALLOWED_MODEL_IDS (the union of
    // MODEL_MAP and HUGGINGFACE_MODEL_MAP) so it passes validation, but it
    // has no entry in this route's own MODEL_MAP, so targetModelId should
    // fall through to the Groq default per the route's documented behavior.
    const fetchMock = stubGroqFetch();
    const response = await POST(makeRequest({ query: 'hi', model: 'hf-qwen-2.5-7b' }));
    expect(response.status).toBe(200);
    await response.text();

    const body = await sentBody(fetchMock);
    expect(body.model).toBe('llama-3.3-70b-versatile');
  });

  it('forwards a multimodal history entry as text, preserving both turns instead of dropping the user turn', async () => {
    const fetchMock = stubGroqFetch(['Hi there!']);

    const response = await POST(
      makeRequest({
        query: 'And now?',
        model: 'llama-3.3-70b',
        conversationHistory: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look at this image' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAABBBBCCCC' } },
            ],
          },
          { role: 'assistant', content: 'It looks like a cat.' },
        ],
      })
    );
    expect(response.status).toBe(200);
    await response.text(); // drain the stream so the underlying fetch has actually fired

    const body = await sentBody(fetchMock);
    const { messages } = body;

    expect(messages.find((m) => m.content === 'Look at this image')?.role).toBe('user');
    expect(messages.find((m) => m.content === 'It looks like a cat.')?.role).toBe('assistant');
    expect(messages.find((m) => m.content === 'And now?')?.role).toBe('user');

    // The image data itself must never leak into the outgoing text-only history.
    expect(JSON.stringify(messages)).not.toContain('AAAABBBBCCCC');
  });

  it('drops an image-only history entry (no caption text) instead of sending an empty message', async () => {
    const fetchMock = stubGroqFetch();
    const response = await POST(
      makeRequest({
        query: 'Describe it',
        conversationHistory: [
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,ZZZZ' } }],
          },
        ],
      })
    );
    await response.text();

    const { messages } = await sentBody(fetchMock);
    expect(messages.some((m) => m.content === '')).toBe(false);
    expect(JSON.stringify(messages)).not.toContain('ZZZZ');
    expect(messages.find((m) => m.content === 'Describe it')?.role).toBe('user');
  });

  it('rate-limits after 10 ai-query requests/minute from the same IP', async () => {
    const ip = freshIp();
    // Rate limiting is checked before body validation, so these can all be
    // otherwise-invalid requests - the point is purely to exhaust the quota.
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({}, ip));
      expect(response.status).toBe(400);
    }
    const blocked = await POST(makeRequest({}, ip));
    expect(blocked.status).toBe(429);
  });
});
