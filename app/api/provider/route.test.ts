import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Request-construction helpers - see app/api/query-gateway/route.test.ts for
// the rationale (real NextRequest over a duck-typed mock), and
// app/api/openrouter/route.test.ts, whose conventions this file follows.
// ---------------------------------------------------------------------------

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  // TEST-NET-3 (RFC 5737) - reserved for documentation, never a real client.
  return `203.0.113.${ipCounter}`;
}

function makeRequest(body: unknown, ip: string = freshIp()): NextRequest {
  return new NextRequest('http://localhost/api/provider', {
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

// This route talks to the upstream provider via a direct `fetch` call (no
// SDK in the way, same as openrouter/route.ts), so mocking global fetch
// stands in directly for whatever upstream provider is configured.
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

// A custom provider (via CUSTOM_PROVIDERS) is used for all tests below
// rather than one of the real built-in providers - it gives deterministic
// control over the model id / apiId / baseURL without depending on
// Cerebras/Gemini/Mistral's real, occasionally-changing catalogs, exactly
// the scenario CUSTOM_PROVIDERS exists to support (a deployer's own
// OpenAI-compatible endpoint).
const TEST_PROVIDER_HOST = 'test-provider.example.invalid';
const TEST_MODEL_ID = 'testprov-echo-model';

function setUpTestProvider() {
  process.env.CUSTOM_PROVIDERS = JSON.stringify([
    {
      id: 'testprov',
      name: 'Test Provider',
      baseURL: `https://${TEST_PROVIDER_HOST}/v1/chat/completions`,
      apiKeyEnvVar: 'TESTPROV_API_KEY',
      models: [
        { id: 'echo-model', name: 'Echo Model', apiId: 'echo-model-v1', category: 'Test', description: 'Test model.' },
      ],
    },
  ]);
  process.env.TESTPROV_API_KEY = 'test-provider-key';
}

function stubProviderFetch(chunks: string[] = ['ok']) {
  const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0].toString();
    if (!url.includes(TEST_PROVIDER_HOST)) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    return sseResponse(chunks);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function sentBody(fetchMock: ReturnType<typeof stubProviderFetch>): Promise<{ model: string; messages: OutgoingMessage[] }> {
  expect(fetchMock).toHaveBeenCalled();
  const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
  return JSON.parse(init.body as string) as { model: string; messages: OutgoingMessage[] };
}

const ENV_KEYS = ['CEREBRAS_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'CUSTOM_PROVIDERS', 'TESTPROV_API_KEY'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  vi.unstubAllGlobals();
});

describe('POST /api/provider', () => {
  it('rejects a request with no query with a 400', async () => {
    setUpTestProvider();
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  it('rejects a request with no model with a 400 (no default model exists across providers)', async () => {
    setUpTestProvider();
    const response = await POST(makeRequest({ query: 'hi' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/model is required/);
  });

  it('rejects an unrecognized model id with a 400 rather than silently substituting one', async () => {
    setUpTestProvider();
    const response = await POST(makeRequest({ query: 'hi', model: 'not-a-real-model' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/Invalid model ID/);
  });

  it('rejects every model id when no provider API keys and no CUSTOM_PROVIDERS are configured (graceful no-op deployment)', async () => {
    // Deliberately do NOT call setUpTestProvider() - this simulates a
    // deployment that hasn't opted into any of Cerebras/Gemini/Mistral/
    // custom providers at all.
    const response = await POST(makeRequest({ query: 'hi', model: TEST_MODEL_ID }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body.errors as string[]).join(' ')).toMatch(/Invalid model ID/);
  });

  it('routes a valid request to the configured provider and streams the response', async () => {
    setUpTestProvider();
    const fetchMock = stubProviderFetch(['Hello', ' world']);
    const response = await POST(makeRequest({ query: 'hi', model: TEST_MODEL_ID }));
    expect(response.status).toBe(200);
    const text = await response.text();

    expect(text).toContain('"content":"Hello"');
    expect(text).toContain('"content":" world"');
    expect(text).toContain('"done":true');

    const { model } = await sentBody(fetchMock);
    // The apiId sent upstream, not Roovert's internal flattened id.
    expect(model).toBe('echo-model-v1');
  });

  it('sends the request to the exact provider baseURL configured, with a Bearer auth header using its api key', async () => {
    setUpTestProvider();
    const fetchMock = stubProviderFetch();
    const response = await POST(makeRequest({ query: 'hi', model: TEST_MODEL_ID }));
    await response.text();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://${TEST_PROVIDER_HOST}/v1/chat/completions`);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-provider-key');
  });

  it('forwards a multimodal history entry as text, preserving both turns instead of dropping the user turn', async () => {
    setUpTestProvider();
    const fetchMock = stubProviderFetch(['Hi there!']);

    const response = await POST(
      makeRequest({
        query: 'And now?',
        model: TEST_MODEL_ID,
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
    setUpTestProvider();
    const fetchMock = stubProviderFetch();
    const response = await POST(
      makeRequest({
        query: 'Describe it',
        model: TEST_MODEL_ID,
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

  it('sends the current image as a multimodal content part', async () => {
    setUpTestProvider();
    const fetchMock = stubProviderFetch();
    const response = await POST(
      makeRequest({ query: 'what is this', model: TEST_MODEL_ID, image: 'data:image/png;base64,IMGDATA' })
    );
    await response.text();

    const { messages } = await sentBody(fetchMock);
    const current = messages[messages.length - 1];
    expect(Array.isArray(current.content)).toBe(true);
    const parts = current.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(parts.find((p) => p.type === 'text')?.text).toBe('what is this');
    expect(parts.find((p) => p.type === 'image_url')?.image_url?.url).toBe('data:image/png;base64,IMGDATA');
  });

  it('returns a friendly error and does not crash when the upstream provider responds with an error status', async () => {
    setUpTestProvider();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 }))
    );

    const response = await POST(makeRequest({ query: 'hi', model: TEST_MODEL_ID }));
    expect(response.status).toBe(200); // errors are surfaced via the SSE body, not HTTP status
    const text = await response.text();
    expect(text).toContain('"done":true');
    expect(text).not.toContain('rate limited'); // internal error detail must never leak
  });

  it('rate-limits after 10 ai-query requests/minute from the same IP', async () => {
    setUpTestProvider();
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
