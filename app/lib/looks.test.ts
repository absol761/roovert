import { describe, it, expect } from 'vitest';
import { LOOKS, LOOK_CATEGORIES, LAYOUTS } from './looks';

describe('LOOKS', () => {
  it('has a unique id for every entry', () => {
    const ids = LOOKS.map(look => look.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty id, name, and description', () => {
    for (const look of LOOKS) {
      expect(look.id.length).toBeGreaterThan(0);
      expect(look.name.length).toBeGreaterThan(0);
      expect(look.description.length).toBeGreaterThan(0);
    }
  });

  it('assigns every entry a category listed in LOOK_CATEGORIES', () => {
    for (const look of LOOKS) {
      expect(LOOK_CATEGORIES).toContain(look.category);
    }
  });
});

describe('LOOK_CATEGORIES', () => {
  it('contains only unique category names', () => {
    expect(new Set(LOOK_CATEGORIES).size).toBe(LOOK_CATEGORIES.length);
  });

  it('includes every category actually used by LOOKS (no orphan categories)', () => {
    const usedCategories = new Set(LOOKS.map(look => look.category));
    for (const category of LOOK_CATEGORIES) {
      expect(usedCategories.has(category)).toBe(true);
    }
  });
});

describe('LAYOUTS', () => {
  it('has a unique id for every entry', () => {
    const ids = LAYOUTS.map(layout => layout.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty id and name', () => {
    for (const layout of LAYOUTS) {
      expect(layout.id.length).toBeGreaterThan(0);
      expect(layout.name.length).toBeGreaterThan(0);
    }
  });
});
