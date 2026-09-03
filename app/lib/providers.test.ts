import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_PROVIDERS,
  parseCustomProviders,
  getAllProviders,
  getAvailableProviders,
  getAvailableProviderModels,
  findAvailableProviderModel,
  flattenedModelId,
} from './providers';

const ENV_KEYS = ['CEREBRAS_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'DEEPSEEK_API_KEY', 'TOGETHER_API_KEY', 'CUSTOM_PROVIDERS'] as const;
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
  vi.restoreAllMocks();
});

describe('BUILTIN_PROVIDERS', () => {
  it('includes Cerebras, Gemini, Mistral, DeepSeek, and Together AI', () => {
    const ids = BUILTIN_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['cerebras', 'gemini', 'mistral', 'deepseek', 'together']));
  });

  it('has a unique id for every provider', () => {
    const ids = BUILTIN_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every provider a parseable baseURL and a non-empty apiKeyEnvVar', () => {
    for (const provider of BUILTIN_PROVIDERS) {
      expect(() => new URL(provider.baseURL)).not.toThrow();
      expect(provider.apiKeyEnvVar.length).toBeGreaterThan(0);
    }
  });

  it('gives every provider at least one model, each with a unique id within that provider and a non-empty apiId', () => {
    for (const provider of BUILTIN_PROVIDERS) {
      expect(provider.models.length).toBeGreaterThan(0);
      const modelIds = provider.models.map((m) => m.id);
      expect(new Set(modelIds).size).toBe(modelIds.length);
      for (const model of provider.models) {
        expect(model.apiId.length).toBeGreaterThan(0);
        expect(model.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('produces globally-unique flattened ids across every built-in provider', () => {
    const flatIds = BUILTIN_PROVIDERS.flatMap((p) => p.models.map((m) => flattenedModelId(p, m)));
    expect(new Set(flatIds).size).toBe(flatIds.length);
  });
});

describe('parseCustomProviders', () => {
  it('returns [] when the env var is undefined or empty', () => {
    expect(parseCustomProviders(undefined)).toEqual([]);
    expect(parseCustomProviders('')).toEqual([]);
    expect(parseCustomProviders('   ')).toEqual([]);
  });

  it('returns [] and logs an error for malformed JSON, instead of throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => parseCustomProviders('{not valid json')).not.toThrow();
    expect(parseCustomProviders('{not valid json')).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns [] and logs an error when the JSON is valid but not an array', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseCustomProviders(JSON.stringify({ id: 'oops' }))).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('parses a well-formed custom provider entry', () => {
    const raw = JSON.stringify([
      {
        id: 'ollama',
        name: 'My Ollama',
        baseURL: 'http://localhost:11434/v1/chat/completions',
        apiKeyEnvVar: 'OLLAMA_API_KEY',
        models: [
          { id: 'llama3', name: 'Llama 3 (local)', apiId: 'llama3', category: 'Self-hosted', description: 'Local model.' },
        ],
      },
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'ollama', name: 'My Ollama', apiKeyEnvVar: 'OLLAMA_API_KEY' });
    expect(result[0].models).toHaveLength(1);
  });

  it('skips an entry missing a required field but keeps the others', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      { id: 'bad', name: 'Missing baseURL', apiKeyEnvVar: 'X_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
      { id: 'good', name: 'Good', baseURL: 'http://localhost:8000/v1/chat/completions', apiKeyEnvVar: 'GOOD_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
    ]);
    const result = parseCustomProviders(raw);
    expect(result.map((p) => p.id)).toEqual(['good']);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('skips an entry with an invalid baseURL', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      { id: 'bad-url', name: 'Bad URL', baseURL: 'not a url', apiKeyEnvVar: 'X_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
    ]);
    expect(parseCustomProviders(raw)).toEqual([]);
  });

  it('skips an entry with no models array, and one with an empty models array', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      { id: 'no-models', name: 'No models', baseURL: 'http://localhost:8000/v1/chat/completions', apiKeyEnvVar: 'X_KEY' },
      { id: 'empty-models', name: 'Empty models', baseURL: 'http://localhost:8001/v1/chat/completions', apiKeyEnvVar: 'X_KEY', models: [] },
    ]);
    expect(parseCustomProviders(raw)).toEqual([]);
  });

  it('drops an individual malformed model entry but keeps the valid ones in the same provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'mixed',
        name: 'Mixed',
        baseURL: 'http://localhost:8000/v1/chat/completions',
        apiKeyEnvVar: 'X_KEY',
        models: [
          { id: 'good', name: 'Good', apiId: 'good', category: 'c', description: 'd' },
          { id: 'bad', name: 'Bad' /* missing apiId/category/description */ },
        ],
      },
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(1);
    expect(result[0].models.map((m) => m.id)).toEqual(['good']);
  });

  it('rejects a custom provider id that collides with a built-in provider id', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'cerebras', // collides with the built-in
        name: 'Fake Cerebras',
        baseURL: 'http://localhost:9999/v1/chat/completions',
        apiKeyEnvVar: 'FAKE_KEY',
        models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
      },
    ]);
    expect(parseCustomProviders(raw)).toEqual([]);
  });

  it('rejects a second custom provider entry that collides with an earlier custom entry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const entry = {
      name: 'Dup',
      baseURL: 'http://localhost:9999/v1/chat/completions',
      apiKeyEnvVar: 'DUP_KEY',
      models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
    };
    const raw = JSON.stringify([
      { ...entry, id: 'dup' },
      { ...entry, id: 'dup' },
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(1);
  });
});

describe('parseCustomProviders - adversarial CUSTOM_PROVIDERS payloads', () => {
  it('treats a JSON array of only totally-malformed entries (null/number/string/array) as producing no providers, without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([null, 42, 'oops', ['nested', 'array'], true]);
    expect(() => parseCustomProviders(raw)).not.toThrow();
    expect(parseCustomProviders(raw)).toEqual([]);
  });

  it('keeps every valid entry in a large array mixing several valid and several invalid/malformed entries, in original order', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const validEntry = (id: string) => ({
      id,
      name: `Provider ${id}`,
      baseURL: `http://localhost:9000/${id}/v1/chat/completions`,
      apiKeyEnvVar: `${id.toUpperCase()}_KEY`,
      models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
    });
    const raw = JSON.stringify([
      validEntry('alpha'),
      null, // totally malformed
      { id: 'no-base-url', name: 'x', apiKeyEnvVar: 'X_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
      validEntry('beta'),
      { id: 'bad-url', name: 'x', baseURL: 'not a url', apiKeyEnvVar: 'X_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
      42, // totally malformed
      validEntry('gamma'),
    ]);
    const result = parseCustomProviders(raw);
    expect(result.map((p) => p.id)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('rejects a custom provider id colliding with any built-in provider id, not just the first one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const builtinId of BUILTIN_PROVIDERS.map((p) => p.id)) {
      const raw = JSON.stringify([
        {
          id: builtinId,
          name: 'Impersonator',
          baseURL: 'http://localhost:9999/v1/chat/completions',
          apiKeyEnvVar: 'FAKE_KEY',
          models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
        },
      ]);
      expect(parseCustomProviders(raw)).toEqual([]);
    }
  });

  it('treats an explicit empty array the same as an unset env var: no custom providers, no error needed', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseCustomProviders('[]')).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('parses a large CUSTOM_PROVIDERS payload (1000 unique providers) without throwing, dropping entries, or colliding flattened ids', () => {
    const N = 1000;
    const entries = Array.from({ length: N }, (_, i) => ({
      id: `provider-${i}`,
      name: `Provider ${i}`,
      baseURL: `http://localhost:9000/${i}/v1/chat/completions`,
      apiKeyEnvVar: `PROVIDER_${i}_KEY`,
      models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
    }));
    const raw = JSON.stringify(entries);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(N);

    const flatIds = result.flatMap((p) => p.models.map((m) => flattenedModelId(p, m)));
    expect(new Set(flatIds).size).toBe(flatIds.length);
  });

  it('accepts (rather than crashes on) a very large single string field, since these are deployer-supplied values with no enforced length cap', () => {
    const hugeDescription = 'x'.repeat(2_000_000); // 2MB
    const raw = JSON.stringify([
      {
        id: 'big',
        name: 'Big',
        baseURL: 'http://localhost:9000/v1/chat/completions',
        apiKeyEnvVar: 'BIG_KEY',
        models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: hugeDescription }],
      },
    ]);
    expect(() => parseCustomProviders(raw)).not.toThrow();
    const result = parseCustomProviders(raw);
    expect(result[0]?.models[0]?.description.length).toBe(2_000_000);
  });

  it('does not let a "__proto__" key in a CUSTOM_PROVIDERS entry pollute Object.prototype, and ignores it as just another unrecognized field', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = `[{"__proto__": {"polluted": "yes"}, "id": "good", "name": "Good", "baseURL": "http://localhost:9000/v1/chat/completions", "apiKeyEnvVar": "GOOD_KEY", "models": [{"id": "m", "name": "M", "apiId": "m", "category": "c", "description": "d"}]}]`;
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('good');
    // Object.prototype itself must never be mutated by parsing attacker/
    // deployer-controlled JSON - JSON.parse assigns "__proto__" as an own
    // property, not the actual prototype, but this pins that guarantee down
    // at this call site rather than trusting it silently.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
  });

  it('treats a provider id of the literal string "__proto__" as an ordinary string, still subject to normal collision detection', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const entry = {
      name: 'Proto',
      baseURL: 'http://localhost:9000/v1/chat/completions',
      apiKeyEnvVar: 'PROTO_KEY',
      models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
    };
    const raw = JSON.stringify([
      { ...entry, id: '__proto__' },
      { ...entry, id: '__proto__' }, // duplicate - must still be rejected as a collision
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('__proto__');
  });

  it('accepts unicode in provider and model ids/names and still produces a correctly-namespaced, unique flattened id', () => {
    process.env.CUSTOM_PROVIDERS = JSON.stringify([
      {
        id: 'ollama-🦙',
        name: '日本語プロバイダー',
        baseURL: 'http://localhost:9000/v1/chat/completions',
        apiKeyEnvVar: 'UNICODE_KEY',
        models: [{ id: 'ラマ-3', name: 'Ünïcödé Model', apiId: 'llama3', category: 'c', description: 'd' }],
      },
    ]);
    process.env.UNICODE_KEY = 'set';
    try {
      const models = getAvailableProviderModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('ollama-🦙-ラマ-3');
    } finally {
      delete process.env.UNICODE_KEY;
    }
  });

  it('rejects a syntactically-valid-but-not-actually-http URL (missing "//") as a baseURL', () => {
    // "localhost:8000" parses successfully as a URL with scheme "localhost"
    // and opaque path "8000" - `new URL()` alone accepts it even though it's
    // not a usable http(s) endpoint, so validateCustomProvider also checks
    // the parsed protocol explicitly.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'schemeless',
        name: 'Schemeless',
        baseURL: 'localhost:8000',
        apiKeyEnvVar: 'X_KEY',
        models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
      },
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(0);
  });

  it('rejects a non-http(s) scheme baseURL (e.g. "file://")', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'fileproto',
        name: 'File',
        baseURL: 'file:///etc/passwd',
        apiKeyEnvVar: 'X_KEY',
        models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
      },
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(0);
  });

  it('drops a later custom provider\'s model whose flattened id collides with an earlier custom provider\'s, even though the provider ids themselves do not collide', () => {
    // flattenedModelId() joins provider id + model id with a plain "-",
    // which is ambiguous once ids themselves may contain hyphens:
    // "my" + "ollama-1" and "my-ollama" + "1" both flatten to
    // "my-ollama-1". Without a dedicated check, the second provider
    // registered would silently steal the first's flattened id, making
    // the first provider's model unreachable via findAvailableProviderModel
    // (or worse, resolving requests intended for one provider/key/baseURL
    // to the other's instead).
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'my',
        name: 'My',
        baseURL: 'http://localhost:9001/v1/chat/completions',
        apiKeyEnvVar: 'MY_KEY',
        models: [{ id: 'ollama-1', name: 'Ollama 1', apiId: 'ollama-1', category: 'c', description: 'd' }],
      },
      {
        id: 'my-ollama',
        name: 'My Ollama',
        baseURL: 'http://localhost:9002/v1/chat/completions',
        apiKeyEnvVar: 'MY_OLLAMA_KEY',
        models: [{ id: '1', name: 'One', apiId: 'one', category: 'c', description: 'd' }],
      },
    ]);
    const result = parseCustomProviders(raw);

    // The first provider survives with its model intact. The second
    // provider's `id` doesn't collide with the first's, but its only
    // model's *flattened* id does, so that model is dropped - leaving the
    // second provider with zero valid models, which drops the whole entry
    // (same "no valid models after validation" rule as any other
    // all-models-invalid custom provider).
    expect(result.map((p) => p.id)).toEqual(['my']);
    expect(result.find((p) => p.id === 'my')?.models.map((m) => m.id)).toEqual(['ollama-1']);

    // The flattened id resolves unambiguously back to the first provider.
    const flatIds = result.flatMap((p) => p.models.map((m) => flattenedModelId(p, m)));
    expect(flatIds).toEqual(['my-ollama-1']);
    expect(new Set(flatIds).size).toBe(flatIds.length);
  });

  it('drops a duplicate model id within the same custom provider\'s models array instead of registering two identical flattened ids', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'dupmodels',
        name: 'Dup Models',
        baseURL: 'http://localhost:9003/v1/chat/completions',
        apiKeyEnvVar: 'DUPMODELS_KEY',
        models: [
          { id: 'm', name: 'First', apiId: 'first-api-id', category: 'c', description: 'd' },
          { id: 'm', name: 'Second', apiId: 'second-api-id', category: 'c', description: 'd' },
        ],
      },
    ]);
    const result = parseCustomProviders(raw);
    expect(result).toHaveLength(1);
    // Only the first occurrence survives.
    expect(result[0].models).toHaveLength(1);
    expect(result[0].models[0].apiId).toBe('first-api-id');
  });

  it('drops a custom provider model whose flattened id collides with a built-in provider\'s model, even when the provider id itself is unique', () => {
    // Cerebras ships a built-in model flattened as "cerebras-llama-3.3-70b".
    // A custom provider "cerebras-llama" with model id "3.3-70b" would
    // flatten to the exact same string if this weren't checked against the
    // built-ins too.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify([
      {
        id: 'cerebras-llama',
        name: 'Impersonating Cerebras Llama',
        baseURL: 'http://localhost:9004/v1/chat/completions',
        apiKeyEnvVar: 'IMPOSTER_KEY',
        models: [{ id: '3.3-70b', name: 'Fake', apiId: 'fake', category: 'c', description: 'd' }],
      },
    ]);
    const result = parseCustomProviders(raw);
    // The provider id itself ("cerebras-llama") doesn't collide with any
    // built-in id, so the entry survives, but its sole model does collide
    // once flattened, so it's dropped, leaving no valid models.
    expect(result).toHaveLength(0);
  });
});

describe('registry stability under concurrent/racing calls', () => {
  it('returns identical results across many concurrent getAvailableProviderModels() calls in the same process tick', async () => {
    process.env.CEREBRAS_API_KEY = 'test-key';
    process.env.CUSTOM_PROVIDERS = JSON.stringify([
      {
        id: 'concurrent',
        name: 'Concurrent',
        baseURL: 'http://localhost:9000/v1/chat/completions',
        apiKeyEnvVar: 'CONCURRENT_KEY',
        models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }],
      },
    ]);
    process.env.CONCURRENT_KEY = 'set';

    try {
      const results = await Promise.all(Array.from({ length: 50 }, () => Promise.resolve(getAvailableProviderModels())));
      const first = results[0];
      for (const result of results) {
        expect(result).toEqual(first);
      }
      expect(first.some((m) => m.id.startsWith('cerebras-'))).toBe(true);
      expect(first.some((m) => m.id.startsWith('concurrent-'))).toBe(true);
    } finally {
      delete process.env.CONCURRENT_KEY;
    }
  });

  it('runs multiple parseCustomProviders calls with different payloads concurrently without leaking state between them (no shared mutable module state)', async () => {
    const rawA = JSON.stringify([
      { id: 'race-a', name: 'A', baseURL: 'http://localhost:9001/v1/chat/completions', apiKeyEnvVar: 'A_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
    ]);
    const rawB = JSON.stringify([
      { id: 'race-b', name: 'B', baseURL: 'http://localhost:9002/v1/chat/completions', apiKeyEnvVar: 'B_KEY', models: [{ id: 'm', name: 'M', apiId: 'm', category: 'c', description: 'd' }] },
    ]);

    const [resultsA, resultsB] = await Promise.all([
      Promise.all(Array.from({ length: 25 }, () => Promise.resolve(parseCustomProviders(rawA)))),
      Promise.all(Array.from({ length: 25 }, () => Promise.resolve(parseCustomProviders(rawB)))),
    ]);

    for (const r of resultsA) expect(r.map((p) => p.id)).toEqual(['race-a']);
    for (const r of resultsB) expect(r.map((p) => p.id)).toEqual(['race-b']);
  });
});

describe('getAvailableProviders / getAvailableProviderModels / findAvailableProviderModel', () => {
  it('returns nothing when no API keys and no CUSTOM_PROVIDERS are set (graceful no-op)', () => {
    expect(getAllProviders().length).toBeGreaterThan(0); // still registered...
    expect(getAvailableProviders()).toEqual([]); // ...but none available
    expect(getAvailableProviderModels()).toEqual([]);
  });

  it('exposes only the models of providers whose key is set', () => {
    process.env.CEREBRAS_API_KEY = 'test-cerebras-key';
    const available = getAvailableProviders();
    expect(available.map((p) => p.id)).toEqual(['cerebras']);

    const models = getAvailableProviderModels();
    expect(models.length).toBe(BUILTIN_PROVIDERS.find((p) => p.id === 'cerebras')!.models.length);
    for (const m of models) {
      expect(m.id.startsWith('cerebras-')).toBe(true);
    }
  });

  it('exposes DeepSeek and Together AI models once their keys are set, independently of each other', () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    let available = getAvailableProviders();
    expect(available.map((p) => p.id)).toEqual(['deepseek']);
    let models = getAvailableProviderModels();
    expect(models.length).toBe(BUILTIN_PROVIDERS.find((p) => p.id === 'deepseek')!.models.length);
    for (const m of models) {
      expect(m.id.startsWith('deepseek-')).toBe(true);
    }

    process.env.TOGETHER_API_KEY = 'test-together-key';
    available = getAvailableProviders();
    expect(available.map((p) => p.id).sort()).toEqual(['deepseek', 'together']);
    models = getAvailableProviderModels();
    const togetherModels = models.filter((m) => m.id.startsWith('together-'));
    expect(togetherModels.length).toBe(BUILTIN_PROVIDERS.find((p) => p.id === 'together')!.models.length);

    // Together AI happens to also serve a model called "DeepSeek V4 Pro" -
    // its flattened id must stay distinct from the direct DeepSeek
    // provider's own v4-pro entry despite the display-name overlap.
    expect(findAvailableProviderModel('together-deepseek-v4-pro')).toBeDefined();
    expect(findAvailableProviderModel('deepseek-v4-pro')).toBeDefined();
    expect(findAvailableProviderModel('together-deepseek-v4-pro')?.provider.id).toBe('together');
    expect(findAvailableProviderModel('deepseek-v4-pro')?.provider.id).toBe('deepseek');
  });

  it('includes an available custom provider from CUSTOM_PROVIDERS once its key is set', () => {
    process.env.CUSTOM_PROVIDERS = JSON.stringify([
      {
        id: 'lmstudio',
        name: 'LM Studio',
        baseURL: 'http://localhost:1234/v1/chat/completions',
        apiKeyEnvVar: 'LMSTUDIO_API_KEY',
        models: [{ id: 'local-model', name: 'Local Model', apiId: 'local-model', category: 'Self-hosted', description: 'Local.' }],
      },
    ]);
    expect(getAvailableProviders()).toEqual([]); // key not set yet

    process.env.LMSTUDIO_API_KEY = 'anything';
    const available = getAvailableProviders();
    expect(available.map((p) => p.id)).toEqual(['lmstudio']);
    expect(getAvailableProviderModels().map((m) => m.id)).toEqual(['lmstudio-local-model']);
  });

  it('finds a provider+model pair by its flattened id only when available', () => {
    expect(findAvailableProviderModel('mistral-large-latest')).toBeUndefined();

    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    const resolved = findAvailableProviderModel('mistral-large-latest');
    expect(resolved?.provider.id).toBe('mistral');
    expect(resolved?.model.apiId).toBe('mistral-large-latest');
  });

  it('returns undefined for an unrecognized model id even when providers are available', () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    expect(findAvailableProviderModel('not-a-real-model')).toBeUndefined();
  });
});
