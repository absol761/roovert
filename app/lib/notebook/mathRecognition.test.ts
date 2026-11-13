import { describe, it, expect } from 'vitest';
import { isArithmeticLine, evaluateArithmetic, extractLatexSpans } from './mathRecognition';

describe('isArithmeticLine', () => {
  it('accepts simple arithmetic with no spaces', () => {
    expect(isArithmeticLine('2+2=')).toBe(true);
  });

  it('accepts arithmetic with spaces around operators', () => {
    expect(isArithmeticLine('2 + 2 =')).toBe(true);
  });

  it('accepts arithmetic with trailing whitespace after the =', () => {
    expect(isArithmeticLine('2 + 2 = ')).toBe(true);
  });

  it('accepts arithmetic with leading whitespace', () => {
    expect(isArithmeticLine('   12 * 3 =')).toBe(true);
  });

  it('accepts expressions using every allowlisted operator', () => {
    expect(isArithmeticLine('(1 + 2) * 3 / 4 - 5 % 6 ^ 7 =')).toBe(true);
  });

  it('accepts decimals', () => {
    expect(isArithmeticLine('1.5 + 2.25 =')).toBe(true);
  });

  it('rejects prose containing a stray = with a letter in it', () => {
    // The spec's canonical false-positive case: a line of homework prose
    // that happens to contain "=" must never be recognized as arithmetic.
    expect(isArithmeticLine('x + 1 =')).toBe(false);
  });

  it('rejects a full sentence ending coincidentally in an = sign', () => {
    expect(isArithmeticLine('the answer to this problem =')).toBe(false);
  });

  it('rejects a line with exactly one disqualifying character', () => {
    // Otherwise-valid arithmetic, but a single letter tucked in the middle
    // must disqualify the whole line per R3's strict allowlist.
    expect(isArithmeticLine('2 + 2x =')).toBe(false);
  });

  it('rejects a line with a disqualifying trailing character after =', () => {
    expect(isArithmeticLine('2 + 2 = 4')).toBe(false);
  });

  it('rejects a line with no trailing =', () => {
    expect(isArithmeticLine('2 + 2')).toBe(false);
  });

  it('rejects an empty line', () => {
    expect(isArithmeticLine('')).toBe(false);
  });

  it('rejects a whitespace-only line', () => {
    expect(isArithmeticLine('    ')).toBe(false);
  });

  it('rejects a bare = with nothing before it', () => {
    expect(isArithmeticLine('=')).toBe(false);
  });

  it('rejects a currency amount followed by =', () => {
    expect(isArithmeticLine('$5 + $10 =')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isArithmeticLine(undefined as unknown as string)).toBe(false);
  });
});

describe('evaluateArithmetic', () => {
  it('evaluates simple addition', () => {
    expect(evaluateArithmetic('2 + 2 =')).toEqual({ value: 4 });
  });

  it('strips the trailing = before evaluating', () => {
    expect(evaluateArithmetic('10 - 3 =')).toEqual({ value: 7 });
  });

  it('works without a trailing = too (callers may pass a bare expression)', () => {
    expect(evaluateArithmetic('10 - 3')).toEqual({ value: 7 });
  });

  it('respects standard operator precedence (* before +)', () => {
    expect(evaluateArithmetic('2 + 3 * 4 =')).toEqual({ value: 14 });
  });

  it('respects standard operator precedence (/ before -)', () => {
    expect(evaluateArithmetic('20 - 10 / 2 =')).toEqual({ value: 15 });
  });

  it('honors parentheses over default precedence', () => {
    expect(evaluateArithmetic('(2 + 3) * 4 =')).toEqual({ value: 20 });
  });

  it('handles nested parentheses', () => {
    expect(evaluateArithmetic('((1 + 2) * (3 + 4)) =')).toEqual({ value: 21 });
  });

  it('evaluates exponentiation', () => {
    expect(evaluateArithmetic('2 ^ 3 =')).toEqual({ value: 8 });
  });

  it('treats ^ as right-associative (2^3^2 = 2^(3^2) = 512)', () => {
    expect(evaluateArithmetic('2 ^ 3 ^ 2 =')).toEqual({ value: 512 });
  });

  it('gives exponentiation higher precedence than unary minus (-2^2 = -4)', () => {
    expect(evaluateArithmetic('-2 ^ 2 =')).toEqual({ value: -4 });
  });

  it('allows a negative exponent (2^-2 = 0.25)', () => {
    expect(evaluateArithmetic('2 ^ -2 =')).toEqual({ value: 0.25 });
  });

  it('evaluates modulo', () => {
    expect(evaluateArithmetic('10 % 3 =')).toEqual({ value: 1 });
  });

  it('handles unary minus on a parenthesized group', () => {
    expect(evaluateArithmetic('-(2 + 3) =')).toEqual({ value: -5 });
  });

  it('handles double negation', () => {
    expect(evaluateArithmetic('2 - -3 =')).toEqual({ value: 5 });
  });

  it('handles decimal operands', () => {
    expect(evaluateArithmetic('1.5 + 2.25 =')).toEqual({ value: 3.75 });
  });

  it('is never fooled into using JS bitwise XOR semantics for ^', () => {
    // In JS, 2 ^ 3 (bitwise XOR) is 1. Our calculator "^" means exponentiation.
    const result = evaluateArithmetic('2 ^ 3 =');
    expect(result).toEqual({ value: 8 });
    expect((result as { value: number }).value).not.toBe(2 ^ 3);
  });

  it('returns an error for division by zero', () => {
    const result = evaluateArithmetic('5 / 0 =');
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toMatch(/division by zero/i);
  });

  it('returns an error for modulo by zero', () => {
    const result = evaluateArithmetic('5 % 0 =');
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toMatch(/division by zero/i);
  });

  it('returns an error for unbalanced (missing closing) parentheses', () => {
    const result = evaluateArithmetic('(2 + 3 =');
    expect('error' in result).toBe(true);
  });

  it('returns an error for unbalanced (extra closing) parentheses', () => {
    const result = evaluateArithmetic('2 + 3) =');
    expect('error' in result).toBe(true);
  });

  it('returns an error for an empty expression', () => {
    expect(evaluateArithmetic('=')).toEqual({ error: expect.any(String) });
  });

  it('returns an error for an expression with no operand at all (just whitespace)', () => {
    expect(evaluateArithmetic('   =')).toEqual({ error: expect.any(String) });
  });

  it('returns an error for a malformed numeric literal (two decimal points)', () => {
    const result = evaluateArithmetic('1.2.3 + 1 =');
    expect('error' in result).toBe(true);
  });

  it('returns an error for a dangling operator', () => {
    const result = evaluateArithmetic('2 + =');
    expect('error' in result).toBe(true);
  });

  it('never throws, even on garbage input', () => {
    expect(() => evaluateArithmetic('((( =')).not.toThrow();
    expect(() => evaluateArithmetic('')).not.toThrow();
    expect(() => evaluateArithmetic(')()( =')).not.toThrow();
  });

  it('never uses eval or Function internally (sanity check on the source)', async () => {
    // Belt-and-suspenders static check: the implementation file must not
    // contain a call to eval() or the Function constructor anywhere.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const source = await fs.readFile(path.join(dir, 'mathRecognition.ts'), 'utf-8');
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
  });
});

describe('extractLatexSpans', () => {
  it('finds a single inline span', () => {
    const spans = extractLatexSpans('The answer is $x + 1$ today.');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ type: 'inline', raw: '$x + 1$' });
    expect(spans[0].start).toBe(14);
    expect(spans[0].end).toBe(14 + '$x + 1$'.length);
  });

  it('finds a single block span', () => {
    const text = 'Before $$x^2 + y^2 = z^2$$ after';
    const spans = extractLatexSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ type: 'block', raw: '$$x^2 + y^2 = z^2$$' });
  });

  it('finds multiple spans in order with correct positions', () => {
    const text = 'a $x$ b $$y$$ c';
    const spans = extractLatexSpans(text);
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ type: 'inline', raw: '$x$' });
    expect(spans[1]).toMatchObject({ type: 'block', raw: '$$y$$' });
    for (const span of spans) {
      expect(text.slice(span.start, span.end)).toBe(span.raw);
    }
  });

  it('prefers a block interpretation when $$ is genuinely doubled', () => {
    const spans = extractLatexSpans('result: $$a + b$$ done');
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('block');
    expect(spans[0].raw).toBe('$$a + b$$');
  });

  it('resolves two adjacent inline spans ($a$$b$) as two inline spans, not one block', () => {
    const spans = extractLatexSpans('$a$$b$');
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ type: 'inline', raw: '$a$', start: 0, end: 3 });
    expect(spans[1]).toMatchObject({ type: 'inline', raw: '$b$', start: 3, end: 6 });
  });

  it('handles a block span spanning multiple lines', () => {
    const text = 'before\n$$\na + b\n$$\nafter';
    const spans = extractLatexSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('block');
    expect(spans[0].raw).toBe('$$\na + b\n$$');
  });

  it('does not produce a span for an unclosed inline delimiter (fails closed)', () => {
    const spans = extractLatexSpans('this costs $5 and that is all');
    expect(spans).toHaveLength(0);
  });

  it('does not produce a span for an unclosed block delimiter (fails closed)', () => {
    const spans = extractLatexSpans('this is $$ never closed');
    expect(spans).toHaveLength(0);
  });

  it('does not treat two separate dollar amounts in prose as a math span', () => {
    // "$5 and $10" — a closing $ must have a non-space character right
    // before it, so this must not be misread as an inline span.
    const spans = extractLatexSpans('I paid $5 and then $10 more.');
    expect(spans).toHaveLength(0);
  });

  it('does not let inline math cross a blank line / paragraph break', () => {
    const text = '$a\n\nb$ unrelated';
    const spans = extractLatexSpans(text);
    expect(spans).toHaveLength(0);
  });

  it('respects a backslash-escaped dollar sign as literal text', () => {
    const spans = extractLatexSpans('This costs \\$5, not math.');
    expect(spans).toHaveLength(0);
  });

  it('never throws on pathological input', () => {
    expect(() => extractLatexSpans('$$$$$$')).not.toThrow();
    expect(() => extractLatexSpans('$'.repeat(50))).not.toThrow();
    expect(() => extractLatexSpans('')).not.toThrow();
  });

  it('returns an empty array for text with no delimiters at all', () => {
    expect(extractLatexSpans('just plain prose, nothing to see here')).toEqual([]);
  });

  it('returns an empty array for non-string input', () => {
    expect(extractLatexSpans(undefined as unknown as string)).toEqual([]);
  });

  it('does not let spans overlap', () => {
    const text = '$$a$$ and $b$ and $$c$$';
    const spans = extractLatexSpans(text);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
    }
  });
});
