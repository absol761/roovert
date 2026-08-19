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

const ENV_KEYS = ['CEREBRAS_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'CUSTOM_PROVIDERS'] as const;
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
  it('includes Cerebras, Gemini, and Mistral', () => {
    const ids = BUILTIN_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['cerebras', 'gemini', 'mistral']));
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
