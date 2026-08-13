import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Request-construction helpers - see app/api/query-gateway/route.test.ts for
// the rationale (real NextRequest over a duck-typed mock).
// ---------------------------------------------------------------------------

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(body: unknown, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/openrouter', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
  });
}

interface OutgoingMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// This route talks to OpenRouter via a direct `fetch` call (no SDK in the
// way), so mocking global fetch stands in directly for the OpenRouter API.
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
        );
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function stubOpenRouterFetch(chunks: string[] = ['ok']) {
  const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0].toString();
    if (!url.includes('openrouter.ai')) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    return sseResponse(chunks);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function sentBody(fetchMock: ReturnType<typeof stubOpenRouterFetch>): Promise<{ model: string; messages: OutgoingMessage[] }> {
  expect(fetchMock).toHaveBeenCalled();
  const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
  return JSON.parse(init.body as string) as { model: string; messages: OutgoingMessage[] };
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/openrouter', () => {
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

  it('defaults to gpt-4o when no model is provided', async () => {
    const fetchMock = stubOpenRouterFetch();
    const response = await POST(makeRequest({ query: 'hi' }));
    expect(response.status).toBe(200);
    await response.text();

    const body = await sentBody(fetchMock);
    expect(body.model).toBe('openai/gpt-4o');
  });

  it('maps an allowlisted model id to its OpenRouter identifier', async () => {
    const fetchMock = stubOpenRouterFetch();
    const response = await POST(makeRequest({ query: 'hi', model: 'deepseek-chat' }));
    expect(response.status).toBe(200);
    await response.text();

    const body = await sentBody(fetchMock);
    expect(body.model).toBe('deepseek/deepseek-chat');
  });

  it('forwards a multimodal history entry as text, preserving both turns instead of dropping the user turn', async () => {
    const fetchMock = stubOpenRouterFetch(['Hi there!']);

    const response = await POST(
      makeRequest({
        query: 'And now?',
        model: 'gpt-4o',
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
    await response.text();

    const { messages } = await sentBody(fetchMock);

    const userTurn = messages.find((m) => m.content === 'Look at this image');
    expect(userTurn?.role).toBe('user');
    const assistantTurn = messages.find((m) => m.content === 'It looks like a cat.');
    expect(assistantTurn?.role).toBe('assistant');
    // The current turn's query must still be present too.
    expect(messages.find((m) => m.content === 'And now?')?.role).toBe('user');

    // The image data itself must never leak into the outgoing text-only history.
    expect(JSON.stringify(messages)).not.toContain('AAAABBBBCCCC');
  });

  it('drops an image-only history entry (no caption text) instead of sending an empty message', async () => {
    const fetchMock = stubOpenRouterFetch();
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
