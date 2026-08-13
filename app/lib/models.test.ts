import { describe, it, expect } from 'vitest';
import { MODELS, OPENROUTER_MODELS, HUGGINGFACE_MODELS, type Model } from './models';
import { HUGGINGFACE_MODEL_MAP } from './huggingface';

// models.ts is mostly config data, but the file's own comments document
// invariants other code relies on (unique ids across the flat model picker,
// HUGGINGFACE_MODELS' id/apiId matching HUGGINGFACE_MODEL_MAP's keys/values).
// These tests guard those invariants so a future edit to one side without
// the other fails fast instead of silently breaking model selection.

function assertWellFormed(models: Model[], label: string) {
  for (const model of models) {
    expect(model.id, `${label}: id`).toBeTruthy();
    expect(model.name, `${label}: name (${model.id})`).toBeTruthy();
    expect(model.apiId, `${label}: apiId (${model.id})`).toBeTruthy();
    expect(model.category, `${label}: category (${model.id})`).toBeTruthy();
    expect(model.description, `${label}: description (${model.id})`).toBeTruthy();
  }
}

describe('MODELS (Groq)', () => {
  it('is non-empty and every entry is well-formed', () => {
    expect(MODELS.length).toBeGreaterThan(0);
    assertWellFormed(MODELS, 'MODELS');
  });

  it('has unique ids', () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('OPENROUTER_MODELS', () => {
  it('is non-empty and every entry is well-formed', () => {
    expect(OPENROUTER_MODELS.length).toBeGreaterThan(0);
    assertWellFormed(OPENROUTER_MODELS, 'OPENROUTER_MODELS');
  });

  it('has unique ids', () => {
    const ids = OPENROUTER_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('HUGGINGFACE_MODELS', () => {
  it('is non-empty and every entry is well-formed', () => {
    expect(HUGGINGFACE_MODELS.length).toBeGreaterThan(0);
    assertWellFormed(HUGGINGFACE_MODELS, 'HUGGINGFACE_MODELS');
  });

  it('has unique ids', () => {
    const ids = HUGGINGFACE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every id has a matching entry in HUGGINGFACE_MODEL_MAP (app/lib/huggingface.ts)', () => {
    for (const model of HUGGINGFACE_MODELS) {
      expect(HUGGINGFACE_MODEL_MAP[model.id], `missing map entry for ${model.id}`).toBeDefined();
    }
  });

  it('has no HUGGINGFACE_MODEL_MAP entries orphaned from HUGGINGFACE_MODELS', () => {
    const modelIds = new Set(HUGGINGFACE_MODELS.map((m) => m.id));
    for (const key of Object.keys(HUGGINGFACE_MODEL_MAP)) {
      expect(modelIds.has(key), `HUGGINGFACE_MODEL_MAP has orphaned key ${key}`).toBe(true);
    }
  });
});

describe('model ids across all three pickers', () => {
  it('are globally unique (flat picker lists every provider together with no grouping)', () => {
    const allIds = [...MODELS, ...OPENROUTER_MODELS, ...HUGGINGFACE_MODELS].map((m) => m.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('have no duplicate display names (would be ambiguous in the undifferentiated picker list)', () => {
    const allNames = [...MODELS, ...OPENROUTER_MODELS, ...HUGGINGFACE_MODELS].map((m) => m.name);
    const dupes = allNames.filter((name, i) => allNames.indexOf(name) !== i);
    expect(dupes).toEqual([]);
  });
});
