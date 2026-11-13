/**
 * Notebook math recognition — pure functions, no React.
 *
 * Three independent, deliberately narrow recognizers (see
 * docs/design/NOTEBOOK_FEATURE_SPEC.md §1b/R3 and §3 for the full rationale):
 *
 *  1. `isArithmeticLine` / `evaluateArithmetic` — a strict allowlist regex plus
 *     a hand-written parser for bare arithmetic lines like `2 + 2 =`. This is
 *     NOT a "looks like math" heuristic: anything outside the allowlisted
 *     character set disqualifies the whole line, by design, to avoid firing on
 *     ordinary prose that happens to contain a stray `=` (see spec A3/A7/A9).
 *  2. `extractLatexSpans` — finds explicit `$...$` / `$$...$$` delimiters the
 *     user typed themselves. Nothing is ever inferred or auto-wrapped.
 *  3. `extractShorthandExponents` — finds bare `base^exponent` tokens (e.g.
 *     `x^2`, `n^-1`, `x^(n+1)`) with no `$` delimiters at all, so they can be
 *     rendered as real superscript live, the same way typing exponent
 *     notation looks in every tool this was researched against. Caret-only,
 *     deliberately: underscore would be the natural counterpart for
 *     subscript, but `_` already means italics in Markdown and appears
 *     constantly in snake_case identifiers (`my_variable`), so a bare-`_`
 *     shorthand would misfire far too often to meet this feature's own bar
 *     for avoiding false positives. `^` has no competing meaning in prose or
 *     code and is virtually unambiguous as exponentiation when it directly
 *     touches its base with no surrounding whitespace.
 *
 * `evaluateArithmetic` never uses JavaScript's `eval` or the `Function`
 * constructor to run anything — arbitrary
 * string evaluation of untrusted user text is a real code-injection surface,
 * not just a style preference (spec §3). It also never throws: malformed or
 * unevaluatable input always comes back as `{ error: string }`.
 */

// ---------------------------------------------------------------------------
// 1. isArithmeticLine
// ---------------------------------------------------------------------------

/**
 * Strict allowlist regex from spec §3/R3: after trimming, the ENTIRE line
 * must be made of digits, `+ - * / ^ % ( ) .`, whitespace, and must end in
 * `=` (optionally followed by trailing whitespace, which `.trim()` already
 * removes before this runs — the `\s*$` is kept so the regex is correct even
 * if called directly on untrimmed input).
 *
 * This is intentionally an allowlist, not a heuristic: a single stray letter
 * or piece of punctuation anywhere in the line disqualifies it entirely.
 */
const ARITHMETIC_LINE_PATTERN = /^[\d+\-*/^%().\s]+=\s*$/;

/**
 * Returns true only if `line`, after trimming, unambiguously looks like a
 * bare arithmetic expression followed by `=` (e.g. `2 + 2 =`). Any letter,
 * word, currency symbol, or other punctuation disqualifies the line — see
 * spec §1b/R3 for why this must stay this narrow (it is the direct fix for
 * Apple Math Notes' most-cited complaint: firing on ordinary prose).
 */
export function isArithmeticLine(line: string): boolean {
  if (typeof line !== 'string') {
    return false;
  }
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return ARITHMETIC_LINE_PATTERN.test(trimmed);
}

// ---------------------------------------------------------------------------
// 2. evaluateArithmetic — hand-written recursive-descent parser
// ---------------------------------------------------------------------------

export type ArithmeticResult = { value: number } | { error: string };

type TokenType = 'number' | 'operator' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string;
}

/** A single legal numeric literal: `123`, `123.45`, or `.45` — never `1.2.3`. */
const NUMBER_LITERAL_PATTERN = /^(\d+(\.\d+)?|\.\d+)$/;

/**
 * Splits a bare-arithmetic source string into tokens. Throws a plain `Error`
 * (never evaluates anything) on any character or numeric literal it doesn't
 * recognize — callers are expected to catch this, which `evaluateArithmetic`
 * does.
 */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < len && /[0-9.]/.test(source[j])) {
        j++;
      }
      const literal = source.slice(i, j);
      if (!NUMBER_LITERAL_PATTERN.test(literal)) {
        throw new Error(`Invalid number: "${literal}"`);
      }
      tokens.push({ type: 'number', value: literal });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character: "${ch}"`);
  }

  return tokens;
}

/**
 * Recursive-descent parser over the token stream, with standard precedence
 * (low to high): `+ -` < `* / %` < unary `+ -` < `^` (right-associative, so
 * `2^-2` works and `-2^2` evaluates as `-(2^2)`, matching common calculator
 * convention — note this is JS's bitwise XOR for `^`, which is exactly why
 * this is hand-written rather than translated into a JS expression and
 * `eval`'d).
 *
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := unary (('*' | '/' | '%') unary)*
 *   unary  := ('-' | '+') unary | power
 *   power  := primary ('^' unary)?
 *   primary:= NUMBER | '(' expr ')'
 */
class ArithmeticParser {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new Error('Empty expression');
    }
    const value = this.parseExpr();
    if (!this.isAtEnd()) {
      const remaining = this.peek();
      throw new Error(`Unexpected token: "${remaining?.value ?? ''}"`);
    }
    return value;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    while (!this.isAtEnd() && this.peek()?.type === 'operator' && (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.advance().value;
      const rhs = this.parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (
      !this.isAtEnd() &&
      this.peek()?.type === 'operator' &&
      (this.peek()?.value === '*' || this.peek()?.value === '/' || this.peek()?.value === '%')
    ) {
      const op = this.advance().value;
      const rhs = this.parseUnary();
      if (op === '*') {
        value = value * rhs;
      } else if (op === '/') {
        if (rhs === 0) {
          throw new Error('Division by zero');
        }
        value = value / rhs;
      } else {
        if (rhs === 0) {
          throw new Error('Division by zero');
        }
        value = value % rhs;
      }
    }
    return value;
  }

  private parseUnary(): number {
    const next = this.peek();
    if (next?.type === 'operator' && (next.value === '-' || next.value === '+')) {
      this.advance();
      const operand = this.parseUnary();
      return next.value === '-' ? -operand : operand;
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePrimary();
    if (!this.isAtEnd() && this.peek()?.type === 'operator' && this.peek()?.value === '^') {
      this.advance();
      // Right-associative: the exponent itself may carry a unary sign, e.g. 2^-2.
      const exponent = this.parseUnary();
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    if (token.type === 'number') {
      this.advance();
      return parseFloat(token.value);
    }

    if (token.type === 'lparen') {
      this.advance();
      const value = this.parseExpr();
      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') {
        throw new Error('Unbalanced parentheses');
      }
      this.advance();
      return value;
    }

    throw new Error(`Unexpected token: "${token.value}"`);
  }
}

/**
 * Evaluates a bare arithmetic expression (typically the part of a line that
 * passed `isArithmeticLine`, with its trailing `=` still attached — this
 * strips it). Supports `+ - * / ^ %` with standard precedence and
 * parentheses, via a hand-written parser — never JS's `eval` or `Function`.
 *
 * Never throws: malformed input (unbalanced parens, empty expression, a bad
 * numeric literal) and division/modulo by zero both come back as
 * `{ error: string }` rather than an exception, per spec §3.
 */
export function evaluateArithmetic(expression: string): ArithmeticResult {
  try {
    if (typeof expression !== 'string') {
      return { error: 'Expression must be a string' };
    }

    let source = expression.trim();
    if (source.endsWith('=')) {
      source = source.slice(0, -1).trim();
    }

    if (source.length === 0) {
      return { error: 'Empty expression' };
    }

    const tokens = tokenize(source);
    const parser = new ArithmeticParser(tokens);
    const value = parser.parse();

    if (!Number.isFinite(value)) {
      return { error: 'Result is not a finite number' };
    }

    return { value };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid expression' };
  }
}

// ---------------------------------------------------------------------------
// 3. extractLatexSpans
// ---------------------------------------------------------------------------

export interface LatexSpan {
  /** 'block' for `$$...$$`, 'inline' for `$...$`. */
  type: 'inline' | 'block';
  /** The full matched substring, delimiters included (e.g. `"$x+1$"`). */
  raw: string;
  /** Index of the first character of `raw` in the original text (inclusive). */
  start: number;
  /** Index one past the last character of `raw` in the original text (exclusive). */
  end: number;
}

/** Counts consecutive backslashes immediately before `text[idx]`. */
function countPrecedingBackslashes(text: string, idx: number): number {
  let count = 0;
  let i = idx - 1;
  while (i >= 0 && text[i] === '\\') {
    count++;
    i--;
  }
  return count;
}

/** A `$` is escaped (literal, never a delimiter) if preceded by an odd number of backslashes. */
function isEscapedDollar(text: string, idx: number): boolean {
  return countPrecedingBackslashes(text, idx) % 2 === 1;
}

/**
 * Finds the index of the next unescaped `$$` pair starting at or after
 * `from`, or -1 if there isn't one. Used to locate a block span's closing
 * delimiter.
 */
function findUnescapedDoubleDollar(text: string, from: number): number {
  for (let j = from; j < text.length - 1; j++) {
    if (text[j] === '$' && text[j + 1] === '$' && !isEscapedDollar(text, j)) {
      return j;
    }
  }
  return -1;
}

/**
 * Finds the index of the closing `$` for an inline span opened at `openIdx`,
 * or -1 if there isn't a well-formed one. Mirrors the common Pandoc-style
 * convention for disambiguating inline math from plain prose containing `$`
 * (e.g. "$5 and $10"): the character right after the opening `$` and the
 * character right before the closing `$` must both be non-whitespace, and
 * the span may not cross a blank line (paragraph break). Both rules exist
 * purely to avoid false positives on ordinary text — they are not meant to
 * handle every possible LaTeX document.
 */
function findInlineClose(text: string, openIdx: number): number {
  const firstContentChar = text[openIdx + 1];
  // Opening $ must be followed by a real, non-space, non-$ character —
  // otherwise this isn't a well-formed inline span (an immediately
  // following `$` is handled as a block attempt by the caller instead).
  if (firstContentChar === undefined || /\s/.test(firstContentChar) || firstContentChar === '$') {
    return -1;
  }
  // A `$` immediately followed by a digit (e.g. "$5", "$30,000") reads as
  // currency, not the start of inline math, in the overwhelming majority of
  // real notes. Rejecting it outright — rather than trying to find *some*
  // later `$` to pair it with — matters here specifically because a single
  // stray currency `$` earlier in the same line can otherwise "steal" the
  // opening delimiter of an unrelated, genuinely well-formed `$...$` span
  // later in that line (e.g. "costs $5. Inline math $x^2$ here." would
  // otherwise wrongly match "$5. Inline math $x^2$" as one span, consuming
  // the real span's own opening `$`). Genuine LaTeX only rarely opens on a
  // bare digit, and when it does, a leading space (`$ 2+2$`) or switching to
  // block delimiters (`$$2+2$$`) both still work.
  if (/\d/.test(firstContentChar)) {
    return -1;
  }

  for (let j = openIdx + 1; j < text.length; j++) {
    // Inline math can't cross a blank line (paragraph break) — fail closed
    // rather than let a stray `$` swallow unrelated following paragraphs.
    if (text[j] === '\n' && text[j + 1] === '\n') {
      return -1;
    }

    if (text[j] === '$' && !isEscapedDollar(text, j)) {
      const prevChar = text[j - 1];
      if (prevChar !== undefined && !/\s/.test(prevChar)) {
        return j;
      }
      // Whitespace right before this `$` — not a valid close; keep scanning
      // for a later candidate (e.g. "$5 and $10" never resolves to a span).
    }
  }

  return -1;
}

/**
 * Finds every well-formed, non-overlapping `$...$` (inline) and `$$...$$`
 * (block) span in `text`, in left-to-right order. Block delimiters take
 * precedence when genuinely doubled (an unescaped `$` immediately followed
 * by another unescaped `$`); otherwise adjacent inline spans like
 * `"$a$$b$"` resolve as two separate inline spans, `"$a$"` and `"$b$"`.
 *
 * Fails closed: unclosed or otherwise malformed delimiters simply don't
 * produce a span (the `$` is left as ordinary text) rather than throwing or
 * matching something unintended. Never throws.
 */
export function extractLatexSpans(text: string): LatexSpan[] {
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }

  const spans: LatexSpan[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    if (text[i] !== '$' || isEscapedDollar(text, i)) {
      i++;
      continue;
    }

    // Genuinely doubled `$$` — try to resolve as a block span first.
    if (text[i + 1] === '$' && !isEscapedDollar(text, i + 1)) {
      const closeIdx = findUnescapedDoubleDollar(text, i + 2);
      if (closeIdx !== -1) {
        const end = closeIdx + 2;
        spans.push({ type: 'block', raw: text.slice(i, end), start: i, end });
        i = end;
        continue;
      }
      // No closing `$$` anywhere later in the text — not a valid block.
      // Fall through to the inline attempt below, which will itself reject
      // this position (next char is `$`), so this `$` is simply left as text.
    }

    const closeIdx = findInlineClose(text, i);
    if (closeIdx !== -1) {
      const end = closeIdx + 1;
      spans.push({ type: 'inline', raw: text.slice(i, end), start: i, end });
      i = end;
      continue;
    }

    // Unclosed / malformed — fail closed, leave this `$` as plain text.
    i++;
  }

  return spans;
}

// ---------------------------------------------------------------------------
// 4. extractShorthandExponents
// ---------------------------------------------------------------------------

export interface ShorthandExponentToken {
  /** The full matched text (e.g. `"x^2"`, `"n^-1"`, `"x^(n+1)"`) - itself valid, renderable LaTeX with no delimiters needed. */
  raw: string;
  /** Index of the first character of `raw` in the original text (inclusive). */
  start: number;
  /** Index one past the last character of `raw` in the original text (exclusive). */
  end: number;
}

// Base: a single letter or digit immediately before `^`, with no whitespace
// in between - this is what makes "a ^ b" (spaced, far more likely to be
// prose or a stray caret than exponentiation) not match, while "x^2" does.
// Exponent: a short signed alnum run (`2`, `-2`, `10`, `n`) or a single-level
// parenthesized group (`(n+1)`) - deliberately not full LaTeX, just enough
// to cover the shorthand this is meant for.
const SHORTHAND_EXPONENT_PATTERN = /[A-Za-z0-9]\^(-?[A-Za-z0-9]+|\([^()]*\))/g;

/**
 * Finds every bare `base^exponent` token in `text` with no `$`/`$$`
 * delimiters at all (see this file's module comment for why `^` only, never
 * `_`). Each match's `raw` text is itself valid LaTeX on its own (KaTeX
 * doesn't require delimiters to render a bare expression), so callers can
 * feed it straight into the same renderer `extractLatexSpans` results use.
 *
 * `excludeRanges` (typically the spans `extractLatexSpans` already found in
 * the same text) lets callers skip matches inside text that's already going
 * to render as a whole LaTeX span - a `^` inside `$x^2$` shouldn't also get
 * picked up as a second, independent shorthand match. A match is skipped if
 * it overlaps any excluded range at all, not just if fully contained.
 */
export function extractShorthandExponents(
  text: string,
  excludeRanges: Array<{ start: number; end: number }> = []
): ShorthandExponentToken[] {
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }

  const tokens: ShorthandExponentToken[] = [];
  SHORTHAND_EXPONENT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SHORTHAND_EXPONENT_PATTERN.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const overlapsExcluded = excludeRanges.some((r) => start < r.end && end > r.start);
    if (!overlapsExcluded) {
      tokens.push({ raw: match[0], start, end });
    }
    // Matches never overlap each other here (each one fully consumes its
    // base+exponent), so no manual lastIndex adjustment is needed beyond
    // what exec() already does on a `g` regex.
  }
  return tokens;
}
