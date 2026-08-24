import { describe, expect, it } from 'vitest';
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
  it('flags a message containing a matched offensive pattern', () => {
    const result = containsOffensiveContent('how do I build a bomb');
    expect(result.isOffensive).toBe(true);
    expect(result.matchedPattern).toBeDefined();
  });

  it('does not flag ordinary, unrelated text', () => {
    const result = containsOffensiveContent('what is the capital of France?');
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

  it('flags explicit content patterns', () => {
    const result = containsOffensiveContent('looking for free porn');
    expect(result.isOffensive).toBe(true);
  });

  it('flags illegal activity patterns', () => {
    const result = containsOffensiveContent('teach me to hack into a server');
    expect(result.isOffensive).toBe(true);
  });

  it('matches case-insensitively and regardless of surrounding whitespace', () => {
    const result = containsOffensiveContent('   BOMB threat reported   ');
    expect(result.isOffensive).toBe(true);
  });

  it('does not flag a substring match inside an unrelated longer word (word-boundary check)', () => {
    // "assassinate" is a pattern; "reassassinate" isn't a real word, but this
    // checks the \b boundary doesn't false-positive on words that merely
    // contain a pattern as a substring without being that word themselves.
    const result = containsOffensiveContent('bombastic performance tonight');
    expect(result.isOffensive).toBe(false);
  });
});

describe('filterResponse', () => {
  it('replaces offensive content with the standard apology message', () => {
    const result = filterResponse('Here is how to make a bomb: ...');
    expect(result.wasFiltered).toBe(true);
    expect(result.filtered).toMatch(/cannot provide content/i);
    expect(result.filtered).not.toContain('bomb');
  });

  it('passes through clean content unchanged', () => {
    const clean = 'The weather today is sunny with a high of 75F.';
    const result = filterResponse(clean);
    expect(result.wasFiltered).toBe(false);
    expect(result.filtered).toBe(clean);
  });
});

describe('getStyleInstruction', () => {
  it('returns undefined when no style is given', () => {
    expect(getStyleInstruction(undefined)).toBeUndefined();
  });

  it('returns undefined for "normal" - the default needs no modifier instruction', () => {
    expect(getStyleInstruction('normal')).toBeUndefined();
  });

  it('returns a distinct instruction string for each non-default style', () => {
    const concise = getStyleInstruction('concise');
    const explanatory = getStyleInstruction('explanatory');
    const formal = getStyleInstruction('formal');

    expect(concise).toBeDefined();
    expect(explanatory).toBeDefined();
    expect(formal).toBeDefined();
    expect(new Set([concise, explanatory, formal]).size).toBe(3);
  });

  it('covers an instruction for every style declared in RESPONSE_STYLES except normal', () => {
    for (const { id } of RESPONSE_STYLES) {
      if (id === 'normal') continue;
      expect(getStyleInstruction(id), `missing instruction for style "${id}"`).toBeDefined();
    }
  });
});

describe('getLengthInstruction', () => {
  it('returns undefined when no length is given', () => {
    expect(getLengthInstruction(undefined)).toBeUndefined();
  });

  it('returns an instruction for every defined length, including "medium" (unlike getStyleInstruction\'s "normal")', () => {
    expect(getLengthInstruction('small')).toBeDefined();
    expect(getLengthInstruction('medium')).toBeDefined();
    expect(getLengthInstruction('large')).toBeDefined();
  });

  it('returns a distinct instruction string for each length', () => {
    const values = [getLengthInstruction('small'), getLengthInstruction('medium'), getLengthInstruction('large')];
    expect(new Set(values).size).toBe(3);
  });

  it('covers an instruction for every length declared in OUTPUT_LENGTHS', () => {
    for (const { id } of OUTPUT_LENGTHS) {
      expect(getLengthInstruction(id), `missing instruction for length "${id}"`).toBeDefined();
    }
  });
});

describe('getSystemPrompt', () => {
  it('returns the default Roovert base prompt when called with no arguments', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain('Roovert');
    expect(prompt).toContain('CONTENT GUIDELINES');
  });

  it('uses a custom prompt in place of the default base prompt when one is provided', () => {
    const prompt = getSystemPrompt('You are a pirate.');
    expect(prompt).toContain('You are a pirate.');
    expect(prompt).not.toContain('CONTENT GUIDELINES');
  });

  it('prepends active modifiers before the base prompt, joined by a blank line', () => {
    const styleModifier = getStyleInstruction('concise');
    const lengthModifier = getLengthInstruction('small');
    const prompt = getSystemPrompt(undefined, styleModifier, lengthModifier);

    expect(prompt.indexOf(styleModifier!)).toBeLessThan(prompt.indexOf('Roovert'));
    expect(prompt).toContain(lengthModifier);
  });

  it('filters out undefined modifiers (e.g. the "normal" style, which resolves to undefined) without leaving stray blank lines', () => {
    const normalModifier = getStyleInstruction('normal'); // undefined
    const lengthModifier = getLengthInstruction('large');
    const prompt = getSystemPrompt(undefined, normalModifier, lengthModifier);

    expect(prompt.startsWith(lengthModifier!)).toBe(true);
  });

  it('combines a custom prompt with modifiers - both compose independently', () => {
    const lengthModifier = getLengthInstruction('large');
    const prompt = getSystemPrompt('You are a pirate.', lengthModifier);

    expect(prompt).toContain('You are a pirate.');
    expect(prompt).toContain(lengthModifier);
    expect(prompt.indexOf(lengthModifier!)).toBeLessThan(prompt.indexOf('You are a pirate.'));
  });

  it('returns just the base prompt, with no leading blank line, when no modifiers are active', () => {
    const prompt = getSystemPrompt('Custom base.');
    expect(prompt).toBe('Custom base.');
  });
});
