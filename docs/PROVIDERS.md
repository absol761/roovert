# Bring Your Own Model Provider (`/api/provider`)

This document describes Roovert's generic OpenAI-compatible provider system: how to turn on a built-in provider, how to point Roovert at your own OpenAI-compatible endpoint (including a self-hosted Ollama/vLLM/LM Studio instance), and the one rule that system is built around.

## What it is

A "provider" here is any backend that speaks the OpenAI `/chat/completions` wire format — Cerebras, Google Gemini, and Mistral all do, and so does effectively every self-hosted inference server (Ollama, vLLM, LM Studio, ...). Instead of hand-writing a new route file per backend (the way `/api/openrouter` and `/api/huggingface` work), Roovert keeps a declarative registry of providers in `app/lib/providers.ts`, and a single route, `/api/provider`, serves all of them.

**Location:** `app/lib/providers.ts` (registry), `app/api/provider/route.ts` (route).

A provider only becomes usable once its API key environment variable is set. With none of the variables below set, `/api/provider` has nothing to serve — this system is a no-op by default.

## Built-in providers

Set the corresponding environment variable and the provider activates automatically — no other configuration or code change needed.

| Variable | Provider | Notes |
|---|---|---|
| `CEREBRAS_API_KEY` | [Cerebras](https://cloud.cerebras.ai) | Llama 3.3 70B, Llama 3.1 8B, GPT-OSS 120B. Free tier as of writing is 1M tokens/day. |
| `GEMINI_API_KEY` | [Google Gemini](https://aistudio.google.com/apikey) | Gemini 2.5 Flash, Flash-Lite, and Pro. Generous free tier. |
| `MISTRAL_API_KEY` | [Mistral](https://console.mistral.ai) | Mistral Large, Mistral Small, Mistral Nemo (open-weight). Free tier as of writing is ~1B tokens/month. |
| `DEEPSEEK_API_KEY` | [DeepSeek](https://platform.deepseek.com) | DeepSeek V4 Flash and V4 Pro. Pay-as-you-go, no free tier, but low per-token cost. |
| `TOGETHER_API_KEY` | [Together AI](https://api.together.ai) | Llama 3.3 70B Turbo and DeepSeek V4 Pro, served from Together's hosted infrastructure. |

These five ship pre-configured in `BUILTIN_PROVIDERS` (`app/lib/providers.ts`). Each provider's models, base URL, and env var name are hardcoded there — see that file's comments for exact model IDs and where they were verified against the provider's own docs. Note that DeepSeek's V4 Pro model is deliberately listed under both `deepseek` and `together` as two independent registry entries (flattened ids `deepseek-v4-pro` and `together-deepseek-v4-pro`) — they hit different upstream endpoints with different pricing/rate limits, so enabling one has no effect on the other.

## Adding a custom provider

To point Roovert at any other OpenAI-compatible endpoint — a different hosted provider, or your own self-hosted server — set the `CUSTOM_PROVIDERS` environment variable to a JSON array. Each entry has the same shape as a built-in provider (the `ProviderConfig` interface in `app/lib/providers.ts`):

```ts
interface ProviderConfig {
  id: string;            // stable id, e.g. 'ollama' — must not collide with an existing provider id
  name: string;           // display name, e.g. 'My Ollama'
  baseURL: string;        // FULL chat-completions endpoint URL, not just a root path
  apiKeyEnvVar: string;   // name of ANOTHER env var holding the key — never the key itself
  models: {
    id: string;           // slug, unique within this provider's models array
    name: string;         // display name shown in the model picker
    apiId: string;        // the literal string sent as "model" to this provider
    category: string;
    description: string;
  }[];
}
```

Worked example — a local [Ollama](https://ollama.com) instance serving Llama 3, set in `.env.local`:

```bash
CUSTOM_PROVIDERS=[{"id":"ollama","name":"My Ollama","baseURL":"http://localhost:11434/v1/chat/completions","apiKeyEnvVar":"OLLAMA_API_KEY","models":[{"id":"llama3","name":"Llama 3 (local)","apiId":"llama3","category":"Self-hosted","description":"Local Ollama model."}]}]

# apiKeyEnvVar above points at this variable, not at the key itself. Ollama
# doesn't check auth by default, but the field is still required — any
# non-empty placeholder value works.
OLLAMA_API_KEY=local-placeholder
```

Points worth double-checking when writing your own entry:

- **`baseURL` must be the full endpoint URL**, ending in `/chat/completions` (e.g. `.../v1/chat/completions`), not a root/base path — the route fetches it directly with no path-joining.
- **`apiKeyEnvVar` names another env var**, which you must also set. This lets you reuse an existing key across multiple entries, or use a placeholder for a server that doesn't check auth. Never put the literal key inside the `CUSTOM_PROVIDERS` JSON itself.
- **`id` must not collide** with `cerebras`, `gemini`, `mistral`, or another `CUSTOM_PROVIDERS` entry's `id` — a colliding entry is skipped, not merged.
- Malformed entries never break the deployment: an invalid `CUSTOM_PROVIDERS` value (bad JSON, wrong shape, colliding id, empty `models` array, one bad model in an otherwise-valid array) is logged server-side (`console.error`, prefixed `[providers]`) and skipped — the rest of the registry still loads. Check your deployment logs if an entry you added doesn't show up.

## The one hard rule: deploy-time only, never end-user-configurable

There is deliberately **no UI** for a visitor to a hosted Roovert instance to add their own provider, endpoint, or API key. Every `baseURL` a request can ever reach comes from `app/lib/providers.ts` or the `CUSTOM_PROVIDERS` env var — both set by whoever deploys the app, before it goes live. A running instance never reads a base URL, host, or API key out of a request body or query string.

This isn't an oversight to be fixed later — accepting an arbitrary, user-supplied fetch target in a public-facing app is a textbook [server-side request forgery (SSRF)](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery) vector (an attacker could point your server at internal infrastructure, cloud metadata endpoints, etc.). The `model` field a client sends in a request is only ever used to look up an entry in the server-side registry by id — never to construct a URL. If you're extending this system, keep it that way.

## Testing locally

Set at least one provider's key (e.g. `CEREBRAS_API_KEY`) in `.env.local`, start the dev server, then find the flattened model id and query it:

```bash
# Flattened ids are "<provider-id>-<model-id>", e.g. cerebras-llama-3.3-70b
curl -X POST http://localhost:3000/api/provider \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello, how are you?",
    "model": "cerebras-llama-3.3-70b"
  }'
```

A model id belonging to a provider whose key isn't set (or that doesn't exist) is rejected the same way an invalid id is — it's simply not in the allowlist built from currently-available providers.

## Related Endpoints

- `/api/query-gateway` — the default (Ooverta/Groq) chat endpoint, see [QUERY_GATEWAY.md](./QUERY_GATEWAY.md).
- `/api/openrouter` — OpenRouter multi-provider model picker (requires `OPENROUTER_API_KEY`).
- `/api/huggingface` — single-model Hugging Face requests.

## Troubleshooting

**A `CUSTOM_PROVIDERS` entry doesn't show up:**
- Check server logs for a `[providers]` error — malformed JSON, a missing required field, an invalid `baseURL`, a colliding `id`, or an empty/invalid `models` array are all logged with which entry and why, then skipped rather than failing the whole deployment.

**`400` "model is required" or a validation error:**
- Unlike `/api/query-gateway`, `/api/provider` has no default model across an open-ended set of providers — `model` must be sent, and must be one of the flattened ids (`<provider-id>-<model-id>`) from a currently-available provider.

**Response is a generic "temporarily unable to process" message:**
- The provider's own API key is missing or invalid, or the upstream endpoint returned an error — check server logs (the real upstream error is logged via `console.error`, never sent to the client).

**Environment variable changes don't seem to take effect:**
- Redeploy after adding or changing `CEREBRAS_API_KEY` / `GEMINI_API_KEY` / `MISTRAL_API_KEY` / `CUSTOM_PROVIDERS` — most platforms, including Vercel, don't hot-reload env vars into a running deployment.
