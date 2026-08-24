# Security

This document describes the security measures currently implemented in Roovert. It reflects the state of the codebase, not a point-in-time snapshot — when a control changes, update this doc alongside it.

For the historical audit that originally identified the gaps these measures address, see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) (2026-01-06, superseded).

## 1. Rate Limiting

**Location:** `app/lib/security/rateLimit.ts`, applied at the edge in `proxy.ts` and again per-route in individual API handlers.

- IP-based, fixed-window rate limiting.
- **Storage:** backed by Upstash Redis when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or the Vercel-KV-named `KV_REST_API_URL`/`KV_REST_API_TOKEN`) are configured, so limits are shared across serverless instances. Falls back to a per-instance in-memory store when neither is set — fine for local dev, **not** sufficient for a multi-instance production deployment (see [DEPLOYMENT.md](./DEPLOYMENT.md)).
- IP is read from `x-forwarded-for` (last hop only — the one Vercel's edge itself appended, since earlier hops are attacker-controlled), falling back to `x-real-ip`, then `cf-connecting-ip`.
- Graceful `429` responses with `Retry-After` and `X-RateLimit-*` headers.
- `proxy.ts` applies a general 30 req/min limit to every `/api/*` route (except `/api/stats`, which has its own more lenient limit) as a first pass at the edge. Individual routes layer a more specific limit on top.

### Per-endpoint-type limits

| Bucket | Window | Max Requests | Used by |
|---|---|---|---|
| `general` | 1 min | 30 | Edge proxy default; `/api/admin/visitors` uses a stricter 10/min override |
| `ai-query` | 1 min | 10 | `/api/query-gateway` |
| `huggingface` | 1 hour | 30 | Hugging Face chat models (`/api/huggingface`, HF legs of Multi-Perspective) |
| `huggingface-image` | 1 hour | 10 | `/api/huggingface-image` (image generation — much more expensive per request) |
| `openrouter` | 24 hours | 45 | `/api/openrouter` |
| `tracking` | 1 min | 60 | `/api/track`, `/api/track-initialize`, `/api/visit`, `/api/feedback` |
| `stats` | 1 min | 100 | `/api/stats` |
| `share` | 1 hour | 20 | Creating a share link (`/api/share` POST) |
| `share-read` | 1 min | 60 | Reading a share link (public, unauthenticated by design) |

## 2. Input Validation & Sanitization

**Location:** `app/lib/security/validation.ts`.

Schema-based validation with type checks, length limits, and rejection of unexpected fields. Applied to `/api/query-gateway`, `/api/openrouter`, `/api/huggingface`, `/api/huggingface-image`, `/api/visit`, `/api/track`, `/api/share`, and `/api/feedback`.

| Field | Max Length |
|---|---|
| Query | 10,000 chars |
| System prompt | 2,000 chars |
| Model ID | 100 chars, must be in an allowlist |
| Message content | 50,000 chars |
| Conversation history | 50 messages |
| Image (base64) | 10 MB |
| Image prompt (text-to-image) | 1,000 chars |
| Visitor ID | 200 chars |
| Fingerprint | 500 chars |

Sanitization strips null bytes and control characters, trims whitespace, and enforces the limits above. Request bodies are also size-checked (via `Content-Length`) before JSON parsing — 10MB for AI query endpoints, 1MB for tracking endpoints.

**Model allowlisting:** every route that accepts a `model` (or `parallelModel1`/`parallelModel2`) parameter validates it against a fixed allowlist (`MODEL_MAP` / `HUGGINGFACE_MODEL_MAP`) before use, preventing arbitrary model-ID injection.

**Client-side image upload:** `app/page.tsx` validates both file extension (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`) and MIME type, and enforces a 20MB client-side size cap, in addition to the 10MB server-side base64 limit above.

## 3. Admin Endpoint Authentication

**Location:** `app/api/admin/visitors/route.ts`.

- Requires an `x-admin-key` header matching the `ADMIN_API_KEY` environment variable (`AI_GATEWAY_API_KEY` is accepted as a legacy fallback name for the same variable).
- Comparison is constant-time (`crypto.timingSafeEqual` over SHA-256 digests of both sides) to avoid leaking key material via timing.
- Returns `503` if no key is configured server-side (rather than allowing unauthenticated access), and a generic `401` for any mismatch (never reveals whether a key was configured, to prevent enumeration).
- Also rate-limited (10 req/min, stricter than the general default) and requires the general edge rate limit to pass first.

## 4. API Key Handling

- All API keys and secrets live in environment variables only (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `HUGGINGFACE_API_KEY`, `ADMIN_API_KEY`, `KV_REST_API_*`, `UPSTASH_REDIS_REST_*`) — none are hardcoded in source.
- Keys are never sent to the client; all provider calls happen server-side in API routes.
- Missing required keys produce a generic error/graceful degradation rather than an exception that could leak internals (e.g. `/api/query-gateway` returns a user-friendly streamed error if `GROQ_API_KEY` is unset).

## 5. Content Moderation

**Location:** `app/lib/prompts.ts`.

Pattern-based detection of offensive content, applied to both the incoming query and the model's response, with a polite decline message substituted when triggered.

## 6. Markdown Rendering

**Location:** `app/components/MarkdownMessage.tsx`, shared by the live chat and the read-only shared-conversation view.

Uses `react-markdown` with `remark-gfm` and `rehype-highlight` only — notably, **`rehype-raw` is not used**, so raw HTML embedded in a message (e.g. from a model response) is not rendered as markup; `react-markdown`'s default behavior (escaping raw HTML) applies.

## 7. Security Headers

**Location:** `next.config.ts`.

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=()` |
| `Content-Security-Policy` | see below |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

Current CSP:
```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.segment.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://api.segment.io;
frame-ancestors 'self';
base-uri 'self';
form-action 'self';
```

`'unsafe-eval'` has been removed from `script-src`. **`'unsafe-inline'` is still present for both `script-src` and `style-src`** — this is a known remaining gap (tracked separately; check `next.config.ts` directly for the current value before assuming it's been tightened further, since it may change without this doc being updated in lockstep).

`poweredByHeader` is disabled (no `X-Powered-By` fingerprinting) and `productionBrowserSourceMaps` is disabled (no source maps shipped in production).

## 8. CORS

There is no explicit CORS configuration (no `Access-Control-Allow-Origin` or related headers set anywhere in the app). In practice this means the API is same-origin only from a browser's perspective — cross-origin `fetch`/XHR calls from other sites will be blocked by the browser's default same-origin policy, since no origin is ever allow-listed. If cross-origin API access is ever needed, explicit CORS handling would need to be added.

## 9. Database Security

- All SQL queries (SQLite, local-dev fallback for visitor tracking, feedback, and shared conversations) use parameterized statements — no string-concatenated SQL with user input.
- Production visitor tracking prefers Vercel KV (`kv.set`/`kv.incr`) over SQLite when `KV_REST_API_URL`/`TOKEN` are configured, since SQLite isn't available in Vercel's serverless environment. See [REAL_TRACKING_SETUP.md](./REAL_TRACKING_SETUP.md).

## 10. Error Handling

- Error messages returned to clients are generic and never expose stack traces, internal paths, or provider error details — see e.g. `getUserFriendlyErrorMessage()` in `/api/query-gateway`.
- Failures are logged server-side (`console.error`) with detail; only the generic message crosses the response boundary.
- Authentication failures return the same `401` regardless of *why* the key didn't match, to avoid enumeration.

## Known Gaps / Next Steps

- `'unsafe-inline'` remains in the CSP `script-src`/`style-src` (see §7). Removing it would require moving to nonces or hashes for inline scripts/styles.
- No structured request logging or alerting on rate-limit violations beyond the `console.error`/`console.warn` calls scattered through the route handlers.
- No explicit CORS policy (see §8) — acceptable today since there's no legitimate cross-origin caller, but worth being deliberate about if that changes.
- Rate limiting and validation are applied per-route rather than via a single shared middleware wrapper, so a new route can forget to opt in — worth double-checking new endpoints against the tables in §1/§2 before shipping them.

## Testing Security Locally

- Send rapid repeated requests to a rate-limited endpoint and confirm you get a `429` with `Retry-After` once the limit is hit.
- Send oversized or malformed payloads to a validated endpoint and confirm `400` with a descriptive error, not a `500`.
- Confirm `/api/admin/visitors` returns `401` without `x-admin-key`, `503` when `ADMIN_API_KEY` is unset, and real data only with the correct key.
- Check response headers (e.g. via browser devtools or `curl -I`) match §7.
