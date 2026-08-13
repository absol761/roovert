# The Query Gateway Endpoint (`/api/query-gateway`)

This document replaces a previous `AI_GATEWAY_INTEGRATION.md`, which described integrating with a third-party "Vercel AI Gateway" / "Cloudflare AI Gateway" product (OpenAI-compatible routing, `AI_GATEWAY_API_KEY`/`AI_GATEWAY_BASE_URL`, Gemini/GPT-4o/Claude model IDs). **That integration does not exist in this codebase and never shipped** — `AI_GATEWAY_API_KEY` only survives today as a legacy fallback name for `ADMIN_API_KEY` (see [SECURITY.md](./SECURITY.md) §3). This doc instead describes what `/api/query-gateway` actually does.

## What it is

`/api/query-gateway` is the main chat completion endpoint the frontend (`app/page.tsx`) calls. The `-gateway` in the name is a historical artifact of an earlier design, not a reference to any external gateway product — it talks directly to Groq via the [Vercel AI SDK](https://sdk.vercel.ai/)'s `@ai-sdk/groq` provider, and (for a subset of models, in Multi-Perspective mode only) directly to Hugging Face's router.

**Location:** `app/api/query-gateway/route.ts`

## Required Configuration

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Required. Without it, the endpoint streams back a graceful user-facing error instead of a response — see `getUserFriendlyErrorMessage()`. |
| `HUGGINGFACE_API_KEY` | Required only to use Hugging Face models as one of the two Multi-Perspective combine slots. |

## Supported Models

Model IDs are validated against a fixed allowlist before use (see [SECURITY.md](./SECURITY.md) §2) — arbitrary model IDs are rejected, not passed through.

**Groq-backed (`MODEL_MAP`):**

| Model ID | Underlying model |
|---|---|
| `ooverta` | `meta-llama/llama-4-scout-17b-16e-instruct` (the default model) |
| `llama-4-scout` | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `llama-3.3-70b` | `llama-3.3-70b-versatile` |
| `llama-3.1-8b` | `llama-3.1-8b-instant` |

**Hugging Face-backed (`HUGGINGFACE_MODEL_MAP`, only reachable via Multi-Perspective's combine slots):** Qwen 2.5 72B/7B, DeepSeek V3, DeepSeek R1, Phi-4, Kimi K3, GPT-OSS 120B, Qwen 3 235B — see `app/lib/huggingface.ts` for the exact model ID mapping. Reasoning-capable models (Kimi K3, DeepSeek R1) have their `<think>`/`reasoning_content` chain-of-thought stripped before display.

Single-model (non-parallel) requests for a Hugging Face model ID go through the separate `/api/huggingface` route instead of this one.

## Request Modes

- **Single model** (default, or whenever an image is attached): streams one model's response as Server-Sent Events.
- **Multi-Perspective** (`runParallel: true`, no image, both `parallelModel1` and `parallelModel2` set): streams two models concurrently, each SSE chunk tagged with which model it came from (`{ model, content, done }`), so the client can render both answers side by side as they arrive. Each combine slot independently resolves to Groq or Hugging Face depending on which map the model ID is found in.
- **Image input**: forces single-model mode; the image is passed as a `file` part (a `data:` URL) alongside the text query.

## Other Behavior

- Rate limiting (`ai-query` bucket) and full schema validation happen before any model call — see [SECURITY.md](./SECURITY.md) §1–2.
- A content-moderation pass (`app/lib/prompts.ts`) checks the query before it's sent to a model, and the response before it's returned.
- `outputLength` (`small`/`medium`/`large`) maps to a `maxOutputTokens` cap (800/2000/4000).
- Conversation history is capped at 50 messages and only `user`/`assistant` roles are accepted from the client (a client-supplied `system` role is dropped) to prevent prompt injection via `conversationHistory`.
- The route has `maxDuration = 60` (Vercel function timeout) and runs on the Node.js runtime (not Edge), since it depends on `@ai-sdk/groq`.

## Related Endpoints

- `/api/huggingface` — single-model Hugging Face requests (non-parallel).
- `/api/huggingface-image` — Hugging Face image generation.
- `/api/openrouter` — OpenRouter multi-provider model picker (requires `OPENROUTER_API_KEY`).

## Testing Locally

```bash
curl -X POST http://localhost:3000/api/query-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello, how are you?",
    "model": "ooverta"
  }'
```

## Troubleshooting

**Response is a generic "temporarily unable to process" message:**
- `GROQ_API_KEY` is missing or invalid — check server logs (the real error is logged server-side via `console.error`, never sent to the client).

**`400` with a validation error:**
- The model ID isn't in the allowlist above, or another field failed the schema check in `app/lib/security/validation.ts` — the error message names the offending field.

**`429` Too Many Requests:**
- The `ai-query` rate limit bucket (10 requests/minute) was hit. See [SECURITY.md](./SECURITY.md) §1.
