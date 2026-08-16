import { describe, it, expect } from 'vitest';
import { MODELS, OPENROUTER_MODELS, HUGGINGFACE_MODELS, type Model } from './models';

function expectWellFormed(models: Model[]) {
  for (const model of models) {
    expect(model.id.length).toBeGreaterThan(0);
    expect(model.name.length).toBeGreaterThan(0);
    expect(model.apiId.length).toBeGreaterThan(0);
    expect(model.category.length).toBeGreaterThan(0);
    expect(model.description.length).toBeGreaterThan(0);
  }
}

function expectUniqueIds(models: Model[]) {
  const ids = models.map(model => model.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe('MODELS', () => {
  it('gives every entry non-empty id, name, apiId, category, and description', () => {
    expectWellFormed(MODELS);
  });

  it('has a unique id for every entry', () => {
    expectUniqueIds(MODELS);
  });
});

describe('OPENROUTER_MODELS', () => {
  it('gives every entry non-empty id, name, apiId, category, and description', () => {
    expectWellFormed(OPENROUTER_MODELS);
  });

  it('has a unique id for every entry', () => {
    expectUniqueIds(OPENROUTER_MODELS);
  });

  it('tags every entry with the OpenRouter category', () => {
    for (const model of OPENROUTER_MODELS) {
      expect(model.category).toBe('OpenRouter');
    }
  });
});

describe('HUGGINGFACE_MODELS', () => {
  it('gives every entry non-empty id, name, apiId, category, and description', () => {
    expectWellFormed(HUGGINGFACE_MODELS);
  });

  it('has a unique id for every entry', () => {
    expectUniqueIds(HUGGINGFACE_MODELS);
  });

  it('tags every entry with the Hugging Face category', () => {
    for (const model of HUGGINGFACE_MODELS) {
      expect(model.category).toBe('Hugging Face');
    }
  });

  it('suffixes every display name with "(HF)" to disambiguate from same-named OpenRouter entries', () => {
    for (const model of HUGGINGFACE_MODELS) {
      expect(model.name).toMatch(/\(HF\)$/);
    }
  });
});

describe('combined model picker list', () => {
  // page.tsx's flat model picker lists MODELS, OPENROUTER_MODELS, and
  // HUGGINGFACE_MODELS together with no grouping, so ids must be globally
  // unique across all three arrays or React keys/selection would collide.
  it('has a globally unique id across MODELS, OPENROUTER_MODELS, and HUGGINGFACE_MODELS', () => {
    const allIds = [...MODELS, ...OPENROUTER_MODELS, ...HUGGINGFACE_MODELS].map(model => model.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
