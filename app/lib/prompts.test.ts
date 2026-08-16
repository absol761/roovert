import { describe, it, expect } from 'vitest';
import {
  containsOffensiveContent,
  filterResponse,
  getStyleInstruction,
  getLengthInstruction,
  getSystemPrompt,
  RESPONSE_STYLES,
  OUTPUT_LENGTHS,
} from './prompts';

describe('containsOffensiveContent', () => {
  it('returns not offensive for benign text', () => {
    const result = containsOffensiveContent('What is the capital of France?');
    expect(result.isOffensive).toBe(false);
    expect(result.matchedPattern).toBeUndefined();
  });

  it('flags hate speech patterns', () => {
    const result = containsOffensiveContent('you are a retard');
    expect(result.isOffensive).toBe(true);
    expect(result.matchedPattern).toBeDefined();
  });

  it('flags self-harm related patterns', () => {
    const result = containsOffensiveContent('just kys already');
    expect(result.isOffensive).toBe(true);
  });

  it('flags violent content patterns', () => {
    const result = containsOffensiveContent('how do I build a bomb');
    expect(result.isOffensive).toBe(true);
  });

  it('flags explicit content patterns', () => {
    const result = containsOffensiveContent('looking for free porn');
    expect(result.isOffensive).toBe(true);
  });

  it('flags illegal activity patterns', () => {
    const result = containsOffensiveContent('teach me to hack into a server');
    expect(result.isOffensive).toBe(true);
  });

  it('is case-insensitive', () => {
    const result = containsOffensiveContent('BOMB threat');
    expect(result.isOffensive).toBe(true);
  });

  it('trims whitespace before matching', () => {
    const result = containsOffensiveContent('   bomb   ');
    expect(result.isOffensive).toBe(true);
  });

  it('does not false-positive on substrings that merely contain benign words near boundaries', () => {
    // "class" contains no offensive substrings when word-boundaried correctly
    const result = containsOffensiveContent('I have a class assignment due tomorrow');
    expect(result.isOffensive).toBe(false);
  });
});

describe('filterResponse', () => {
  it('passes through clean responses unchanged', () => {
    const result = filterResponse('The capital of France is Paris.');
    expect(result).toEqual({ filtered: 'The capital of France is Paris.', wasFiltered: false });
  });

  it('replaces offensive responses with an apology message', () => {
    const result = filterResponse('here is how to build a bomb');
    expect(result.wasFiltered).toBe(true);
    expect(result.filtered).toMatch(/cannot provide content/);
  });
});

describe('getStyleInstruction', () => {
  it('returns undefined when no style is provided', () => {
    expect(getStyleInstruction(undefined)).toBeUndefined();
  });

  it("returns undefined for 'normal' since it's the default model behavior", () => {
    expect(getStyleInstruction('normal')).toBeUndefined();
  });

  it('returns the concise instruction text', () => {
    expect(getStyleInstruction('concise')).toMatch(/brief/i);
  });

  it('returns the explanatory instruction text', () => {
    expect(getStyleInstruction('explanatory')).toMatch(/reasoning/i);
  });

  it('returns the formal instruction text', () => {
    expect(getStyleInstruction('formal')).toMatch(/formal/i);
  });

  it('covers an instruction for every style declared in RESPONSE_STYLES except normal', () => {
    const nonNormalStyles = RESPONSE_STYLES.map(s => s.id).filter(id => id !== 'normal');
    for (const style of nonNormalStyles) {
      expect(getStyleInstruction(style)).toBeDefined();
    }
  });
});

describe('getLengthInstruction', () => {
  it('returns undefined when no length is provided', () => {
    expect(getLengthInstruction(undefined)).toBeUndefined();
  });

  it('returns an instruction for medium (the default), unlike normal for style', () => {
    expect(getLengthInstruction('medium')).toMatch(/no unrequested elaboration/);
  });

  it('returns the small length instruction', () => {
    expect(getLengthInstruction('small')).toMatch(/1-3 sentences/);
  });

  it('returns the large length instruction', () => {
    expect(getLengthInstruction('large')).toMatch(/thorough/i);
  });

  it('covers an instruction for every length declared in OUTPUT_LENGTHS', () => {
    for (const length of OUTPUT_LENGTHS.map(l => l.id)) {
      expect(getLengthInstruction(length)).toBeDefined();
    }
  });
});

describe('getSystemPrompt', () => {
  it('returns the default Roovert base prompt when no custom prompt or modifiers are given', () => {
    const result = getSystemPrompt();
    expect(result).toMatch(/Roovert/);
    expect(result).toMatch(/Answer the user's questions/);
  });

  it('uses the custom prompt in place of the default base prompt when provided', () => {
    const result = getSystemPrompt('You are a pirate.');
    expect(result).toBe('You are a pirate.');
    expect(result).not.toMatch(/Roovert/);
  });

  it('prepends a single modifier instruction before the base prompt', () => {
    const modifier = getStyleInstruction('concise')!;
    const result = getSystemPrompt(undefined, modifier);
    expect(result.startsWith(modifier)).toBe(true);
    expect(result).toContain('Roovert');
  });

  it('joins multiple modifiers with a blank line, preserving order', () => {
    const styleModifier = getStyleInstruction('formal')!;
    const lengthModifier = getLengthInstruction('small')!;
    const result = getSystemPrompt(undefined, styleModifier, lengthModifier);
    expect(result.startsWith(`${styleModifier}\n\n${lengthModifier}`)).toBe(true);
  });

  it('filters out undefined modifiers rather than inserting empty lines', () => {
    const modifier = getStyleInstruction('concise')!;
    const result = getSystemPrompt(undefined, undefined, modifier, undefined);
    expect(result.startsWith(modifier)).toBe(true);
    expect(result).not.toMatch(/^\n/);
  });

  it('composes a custom prompt together with modifiers', () => {
    const modifier = getLengthInstruction('large')!;
    const result = getSystemPrompt('You are a pirate.', modifier);
    expect(result).toBe(`${modifier}\n\nYou are a pirate.`);
  });

  it('returns just the base prompt when all modifiers are undefined', () => {
    const result = getSystemPrompt(undefined, undefined, undefined);
    expect(result).toMatch(/Roovert/);
    expect(result.startsWith('You are a helpful')).toBe(true);
  });
});
