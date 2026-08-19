/**
 * Generic OpenAI-compatible provider registry.
 *
 * WHY THIS FILE EXISTS
 * ---------------------
 * Roovert historically gained a new AI backend by hand-writing a whole new
 * route file (see app/api/query-gateway, app/api/openrouter,
 * app/api/huggingface). That doesn't scale, and it means every template
 * adopter who wants to plug in their own key/endpoint has to fork the repo.
 * Cerebras, Google Gemini, Mistral, and effectively every self-hosted
 * inference server (Ollama, vLLM, LM Studio, ...) all speak the exact same
 * OpenAI-compatible `/chat/completions` wire format that
 * app/api/openrouter/route.ts and app/api/huggingface/route.ts already
 * speak. So instead of another bespoke route, this file is a *declarative
 * registry* of provider entries - one route (app/api/provider/route.ts)
 * reads this registry and can serve all of them.
 *
 * ADDING A NEW BUILT-IN PROVIDER: append one ProviderConfig object to
 * BUILTIN_PROVIDERS below. That's the whole job - no new route file, no
 * changes anywhere else. Verify the baseURL and model apiIds against the
 * provider's own current docs before adding them; these move over time.
 *
 * ADDING A PROVIDER WITHOUT TOUCHING SOURCE (template adopters): set the
 * CUSTOM_PROVIDERS env var to a JSON array of objects with the same shape
 * as ProviderConfig (see parseCustomProviders below). This is how a
 * deployer points Roovert at their own self-hosted Ollama/vLLM/LM Studio
 * instance, or any other OpenAI-compatible endpoint, with zero code changes.
 *
 * SECURITY - READ BEFORE TOUCHING THIS FILE OR ITS ROUTE
 * --------------------------------------------------------
 * Every `baseURL` in this registry comes from a value the DEPLOYER set at
 * deploy time - either hardcoded below, or via the CUSTOM_PROVIDERS env
 * var. Neither of those is reachable by an end-user request. The `model`
 * field a client sends in a request body is NEVER used to construct a URL
 * or pick a host directly - it is only ever used to look up an entry in
 * this server-side registry by its id (see findAvailableProviderModel).
 * app/api/provider/route.ts must keep it that way: if you ever find
 * yourself tempted to read a base URL, host, or API key out of the
 * request body/query string, stop - this app is public-facing, and a
 * client-suppliable fetch target is a textbook SSRF vector. Model ids are
 * validated against this registry with the exact same
 * validateModelId()/allowlist pattern the other three routes already use
 * (see app/lib/security/validation.ts) - don't invent a looser one here.
 */

import type { Model } from './models';

/**
 * One model served by a provider. Deliberately the same shape as `Model`
 * in app/lib/models.ts (id/name/apiId/category/description) so a
 * flattened list of these can be dropped straight into the same model
 * picker UI that already renders MODELS/OPENROUTER_MODELS/HUGGINGFACE_MODELS.
 *
 * `id` only needs to be unique WITHIN this provider's `models` array - see
 * "flattened id" below for how global uniqueness is guaranteed regardless
 * of what a deployer's CUSTOM_PROVIDERS entries happen to pick.
 */
export interface ProviderRegistryModel {
  /** Short slug, unique within this provider only, e.g. 'llama-3.3-70b'. */
  id: string;
  /** Display name shown in the model picker. */
  name: string;
  /**
   * The literal string sent in the outgoing `model` field of the request
   * to this provider's /chat/completions endpoint. Frequently differs
   * from `id` (e.g. Cerebras's own API id for its 8B Llama model is the
   * unhyphenated `llama3.1-8b`, not `llama-3.1-8b`) - keep them separate
   * rather than assuming they always match.
   */
  apiId: string;
  category: string;
  description: string;
}

/**
 * One OpenAI-compatible provider. `baseURL` must be the full
 * `/chat/completions` endpoint URL (not just a root path) - the route
 * fetches it directly with no path-joining logic, which keeps both this
 * file and CUSTOM_PROVIDERS entries maximally simple and unambiguous.
 */
export interface ProviderConfig {
  /** Stable id, e.g. 'cerebras'. Used as the namespace prefix for this
   * provider's flattened model ids - see flattenedModelId(). */
  id: string;
  /** Display name, e.g. 'Cerebras'. */
  name: string;
  /** Full OpenAI-compatible chat-completions endpoint URL. */
  baseURL: string;
  /**
   * Name of the environment variable holding this provider's API key
   * (e.g. 'CEREBRAS_API_KEY') - NOT the key itself. The route sends
   * `Authorization: Bearer ${process.env[apiKeyEnvVar]}`, matching the
   * OpenAI SDK's own auth convention, which every provider here (and
   * every self-hosted OpenAI-compatible server worth naming) accepts.
   * A provider is only ever considered "available" (see
   * getAvailableProviders) when this env var is actually set and
   * non-empty - a self-hosted server that doesn't check auth at all can
   * still be wired up here by pointing this at any env var set to a
   * placeholder value, since the token is sent but not required to be
   * meaningful to the far end.
   */
  apiKeyEnvVar: string;
  models: ProviderRegistryModel[];
}

// ---------------------------------------------------------------------------
// Built-in providers
//
// Base URLs and model ids below were verified against each provider's own
// docs/changelog via web search on 2026-08-19 (WebFetch to the docs domains
// themselves was blocked by this environment's egress policy, so search-
// engine cross-referencing across multiple independent sources was used
// instead - see the session's research for citations). Provider model
// lineups change; if a model id here starts 404ing, check the provider's
// current docs and update the entry - that's a one-line fix, not a
// route-file rewrite.
// ---------------------------------------------------------------------------

const CEREBRAS_PROVIDER: ProviderConfig = {
  id: 'cerebras',
  name: 'Cerebras',
  // Confirmed 2026-08-19: https://api.cerebras.ai/v1 is Cerebras's
  // OpenAI-compatible base; /chat/completions is the standard suffix.
  baseURL: 'https://api.cerebras.ai/v1/chat/completions',
  apiKeyEnvVar: 'CEREBRAS_API_KEY',
  // Cerebras runs inference on its own wafer-scale hardware rather than
  // GPUs and offers a genuinely generous free tier (1M tokens/day as of
  // 2026-08-19) on these public-endpoint models specifically (its larger
  // catalog, e.g. GLM/Gemma/Mistral variants, is dedicated-endpoint/
  // enterprise-only and not reachable with a plain free API key).
  models: [
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B (Cerebras)', apiId: 'llama-3.3-70b', category: 'Cerebras', description: "Meta's 70B model, served at Cerebras's characteristic very high tokens/sec." },
    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B (Cerebras)', apiId: 'llama3.1-8b', category: 'Cerebras', description: 'Small, extremely fast Llama variant - note the apiId has no hyphen before "8b", matching Cerebras\'s own naming.' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Cerebras)', apiId: 'gpt-oss-120b', category: 'Cerebras', description: "OpenAI's open-weight model, via Cerebras's free public endpoint." },
  ],
};

const GEMINI_PROVIDER: ProviderConfig = {
  id: 'gemini',
  name: 'Google Gemini',
  // Confirmed 2026-08-19: Google's documented OpenAI-compatibility path.
  // The trailing slash before "chat/completions" matters - Google's own
  // docs warn that dropping it causes a 404.
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  apiKeyEnvVar: 'GEMINI_API_KEY',
  // The 2.5 family remains live on Gemini's free tier as of 2026-08-19
  // (Google's docs list an October 16, 2026 shutdown date for these three -
  // still months out at the time this registry was written). Newer
  // Gemini 3.x model ids were showing up in search results during
  // research but couldn't be independently confirmed against Google's own
  // docs (blocked by this environment's egress policy) with enough
  // confidence to hardcode - a wrong id here silently breaks the model
  // picker entry, so this deliberately stuck with the verified family.
  // Check https://ai.google.dev/gemini-api/docs/models when refreshing this.
  models: [
    { id: '2.5-flash', name: 'Gemini 2.5 Flash', apiId: 'gemini-2.5-flash', category: 'Gemini', description: "Google's best price/performance model, well-rounded for general use." },
    { id: '2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', apiId: 'gemini-2.5-flash-lite', category: 'Gemini', description: "Google's lowest-latency, most cost-effective Gemini model." },
    { id: '2.5-pro', name: 'Gemini 2.5 Pro', apiId: 'gemini-2.5-pro', category: 'Gemini', description: "Google's state-of-the-art thinking model for complex reasoning, code, and math." },
  ],
};

const MISTRAL_PROVIDER: ProviderConfig = {
  id: 'mistral',
  name: 'Mistral',
  // Confirmed 2026-08-19: Mistral's own documented OpenAI-compatible base.
  baseURL: 'https://api.mistral.ai/v1/chat/completions',
  apiKeyEnvVar: 'MISTRAL_API_KEY',
  // Mistral offers a very generous free tier (~1B tokens/month as of
  // 2026-08-19). The "-latest" aliases below are Mistral's own recommended
  // way to reference models - Mistral itself keeps them pointed at its
  // current flagship/small releases, so (unlike a dated snapshot id) they
  // shouldn't need updating here every time Mistral ships a new generation.
  models: [
    { id: 'large-latest', name: 'Mistral Large', apiId: 'mistral-large-latest', category: 'Mistral', description: "Mistral's flagship model - always resolves to their current largest release." },
    { id: 'small-latest', name: 'Mistral Small', apiId: 'mistral-small-latest', category: 'Mistral', description: "Mistral's fast, inexpensive model - always resolves to their current small release." },
    { id: 'open-nemo', name: 'Mistral Nemo', apiId: 'open-mistral-nemo', category: 'Mistral', description: 'Open-weight 12B model, a solid free-tier default for everyday queries.' },
  ],
};

export const BUILTIN_PROVIDERS: ProviderConfig[] = [CEREBRAS_PROVIDER, GEMINI_PROVIDER, MISTRAL_PROVIDER];

// ---------------------------------------------------------------------------
// CUSTOM_PROVIDERS parsing
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Validates and narrows one raw models[] entry from a CUSTOM_PROVIDERS
 * provider object. Returns null (after logging why) for anything that
 * doesn't match the required shape, rather than throwing - one malformed
 * model entry should not take down the whole custom provider, let alone
 * the whole route. */
function validateCustomModel(raw: unknown, providerId: string, index: number): ProviderRegistryModel | null {
  if (!raw || typeof raw !== 'object') {
    console.error(`[providers] CUSTOM_PROVIDERS: provider "${providerId}" models[${index}] is not an object - skipping it.`);
    return null;
  }
  const m = raw as Record<string, unknown>;
  if (!isNonEmptyString(m.id) || !isNonEmptyString(m.name) || !isNonEmptyString(m.apiId) || !isNonEmptyString(m.category) || !isNonEmptyString(m.description)) {
    console.error(`[providers] CUSTOM_PROVIDERS: provider "${providerId}" models[${index}] is missing a required non-empty string field (id/name/apiId/category/description) - skipping it.`);
    return null;
  }
  return { id: m.id, name: m.name, apiId: m.apiId, category: m.category, description: m.description };
}

/** Validates and narrows one raw entry from the CUSTOM_PROVIDERS JSON
 * array. `takenIds` is the set of provider ids already claimed (by a
 * built-in provider or an earlier custom entry) so collisions can be
 * rejected without silently letting a custom entry shadow/replace one of
 * the curated built-ins. Returns null (after logging why) for anything
 * invalid, so one bad entry never breaks the entries around it. */
function validateCustomProvider(raw: unknown, index: number, takenIds: Set<string>): ProviderConfig | null {
  if (!raw || typeof raw !== 'object') {
    console.error(`[providers] CUSTOM_PROVIDERS[${index}] is not an object - skipping it.`);
    return null;
  }
  const p = raw as Record<string, unknown>;

  if (!isNonEmptyString(p.id) || !isNonEmptyString(p.name) || !isNonEmptyString(p.baseURL) || !isNonEmptyString(p.apiKeyEnvVar)) {
    console.error(`[providers] CUSTOM_PROVIDERS[${index}] is missing a required non-empty string field (id/name/baseURL/apiKeyEnvVar) - skipping it.`);
    return null;
  }
  // Narrowed via isNonEmptyString above, but that narrowing doesn't persist
  // across further property reads off `p` - pin them to local consts so
  // TypeScript (and the reader) can see they're definitely strings from
  // here on.
  const id = p.id;
  const name = p.name;
  const baseURL = p.baseURL;
  const apiKeyEnvVar = p.apiKeyEnvVar;

  if (takenIds.has(id)) {
    console.error(`[providers] CUSTOM_PROVIDERS[${index}] has id "${id}", which collides with an existing provider id - skipping it.`);
    return null;
  }

  // Deployer-supplied but still worth catching a typo'd URL early rather
  // than failing obscurely on first request.
  try {
    void new URL(baseURL);
  } catch {
    console.error(`[providers] CUSTOM_PROVIDERS[${index}] ("${id}") has an invalid baseURL "${baseURL}" - skipping it.`);
    return null;
  }

  if (!Array.isArray(p.models) || p.models.length === 0) {
    console.error(`[providers] CUSTOM_PROVIDERS[${index}] ("${id}") has no models array (or an empty one) - skipping it.`);
    return null;
  }

  const models = p.models
    .map((m, i) => validateCustomModel(m, id, i))
    .filter((m): m is ProviderRegistryModel => m !== null);

  if (models.length === 0) {
    console.error(`[providers] CUSTOM_PROVIDERS[${index}] ("${id}") had no valid models after validation - skipping it.`);
    return null;
  }

  return { id, name, baseURL, apiKeyEnvVar, models };
}

/**
 * Parses the CUSTOM_PROVIDERS env var (a JSON array of ProviderConfig-
 * shaped objects) into ProviderConfig[]. This is how a template adopter
 * plugs in literally any OpenAI-compatible endpoint - including a
 * self-hosted Ollama/vLLM/LM Studio instance - without touching source
 * code.
 *
 * Deliberately forgiving: malformed JSON, a non-array top level, or any
 * individual malformed entry is logged and skipped rather than thrown -
 * a typo in this env var must never crash the route or the whole
 * deployment, it should just mean that one entry doesn't show up.
 */
export function parseCustomProviders(raw: string | undefined): ProviderConfig[] {
  if (!raw || raw.trim() === '') {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('[providers] CUSTOM_PROVIDERS is not valid JSON - ignoring it entirely.', err);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error('[providers] CUSTOM_PROVIDERS must be a JSON array - ignoring it entirely.');
    return [];
  }

  const takenIds = new Set(BUILTIN_PROVIDERS.map((p) => p.id));
  const result: ProviderConfig[] = [];

  parsed.forEach((entry, index) => {
    const config = validateCustomProvider(entry, index, takenIds);
    if (!config) return; // already logged why
    takenIds.add(config.id);
    result.push(config);
  });

  return result;
}

// ---------------------------------------------------------------------------
// Public registry API - what app/api/provider/route.ts (and later, a
// frontend model picker) should actually call. Every function here reads
// process.env fresh on each call rather than caching at module load, both
// so tests can toggle env vars per-case and so a deployment that adds an
// env var without a full redeploy (e.g. some serverless platforms) is
// picked up on the next request.
// ---------------------------------------------------------------------------

/** All configured providers - built-in plus whatever CUSTOM_PROVIDERS adds -
 * regardless of whether their API key is actually set. */
export function getAllProviders(): ProviderConfig[] {
  return [...BUILTIN_PROVIDERS, ...parseCustomProviders(process.env.CUSTOM_PROVIDERS)];
}

/** Providers whose API key env var is actually set (non-empty) in this
 * deployment. A provider with no key configured is invisible everywhere -
 * it contributes no models to getAvailableProviderModels and can't be
 * looked up by findAvailableProviderModel - mirroring how the openrouter/
 * huggingface routes already hide themselves when their key is absent.
 * This is also what makes the whole system a no-op by default: with none
 * of CEREBRAS_API_KEY/GEMINI_API_KEY/MISTRAL_API_KEY/CUSTOM_PROVIDERS set,
 * this returns []. */
export function getAvailableProviders(): ProviderConfig[] {
  return getAllProviders().filter((p) => !!process.env[p.apiKeyEnvVar]);
}

/** The globally-unique model id exposed outside this registry for one
 * provider's model - namespaced by the provider's id so that entries
 * across different providers (built-in or custom) can never collide,
 * without requiring whoever writes a CUSTOM_PROVIDERS entry to
 * coordinate ids with anyone else. This is the id a client sends as
 * `model` in a request, and the id findAvailableProviderModel looks up. */
export function flattenedModelId(provider: Pick<ProviderConfig, 'id'>, model: Pick<ProviderRegistryModel, 'id'>): string {
  return `${provider.id}-${model.id}`;
}

/**
 * Flattened Model[] list (same shape as app/lib/models.ts's Model) across
 * every currently-available provider - i.e. exactly the entries a model
 * picker should offer right now. Meant to be consumed by a small
 * server-side endpoint or Server Component (not bundled directly into a
 * client component the way MODELS/OPENROUTER_MODELS/HUGGINGFACE_MODELS
 * are) since which providers are "available" depends on server-only env
 * vars.
 */
export function getAvailableProviderModels(): Model[] {
  return getAvailableProviders().flatMap((provider) =>
    provider.models.map((model) => ({
      id: flattenedModelId(provider, model),
      name: model.name,
      apiId: model.apiId,
      category: model.category,
      description: model.description,
    }))
  );
}

/**
 * Looks up a provider+model pair by the flattened id a client sent as
 * `model`. Only ever searches *available* providers (key set) - an id
 * belonging to a configured-but-keyless provider, or to no provider at
 * all, returns undefined exactly like an unrecognized id would, so the
 * route has one uniform "not found" path to reject on instead of two.
 */
export function findAvailableProviderModel(flatModelId: string): { provider: ProviderConfig; model: ProviderRegistryModel } | undefined {
  for (const provider of getAvailableProviders()) {
    for (const model of provider.models) {
      if (flattenedModelId(provider, model) === flatModelId) {
        return { provider, model };
      }
    }
  }
  return undefined;
}
