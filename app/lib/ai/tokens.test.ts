import { describe, it, expect } from 'vitest';
import { OUTPUT_LENGTH_TOKENS, resolveMaxTokens } from './tokens';

describe('resolveMaxTokens', () => {
  it('resolves "small" to its configured token count', () => {
    expect(resolveMaxTokens('small')).toBe(OUTPUT_LENGTH_TOKENS.small);
    expect(resolveMaxTokens('small')).toBe(800);
  });

  it('resolves "medium" to its configured token count', () => {
    expect(resolveMaxTokens('medium')).toBe(OUTPUT_LENGTH_TOKENS.medium);
    expect(resolveMaxTokens('medium')).toBe(2000);
  });

  it('resolves "large" to its configured token count', () => {
    expect(resolveMaxTokens('large')).toBe(OUTPUT_LENGTH_TOKENS.large);
    expect(resolveMaxTokens('large')).toBe(4000);
  });

  it('falls back to the medium default for an unrecognized string', () => {
    expect(resolveMaxTokens('extra-large')).toBe(2000);
  });

  it('falls back to the medium default for undefined', () => {
    expect(resolveMaxTokens(undefined)).toBe(2000);
  });

  it('falls back to the medium default for null', () => {
    expect(resolveMaxTokens(null)).toBe(2000);
  });

  it('falls back to the medium default for a number', () => {
    expect(resolveMaxTokens(800)).toBe(2000);
  });

  it('falls back to the medium default for an empty string', () => {
    expect(resolveMaxTokens('')).toBe(2000);
  });

  it('never throws and never returns undefined or NaN for arbitrary input', () => {
    const inputs: unknown[] = ['small', 'medium', 'large', 'bogus', undefined, null, 0, 42, '', {}, [], true];
    for (const input of inputs) {
      let result: number | undefined;
      expect(() => {
        result = resolveMaxTokens(input);
      }).not.toThrow();
      expect(result).not.toBeUndefined();
      expect(Number.isNaN(result)).toBe(false);
    }
  });
});
