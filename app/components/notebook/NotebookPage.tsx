'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
// Owned by a parallel worktree (see NOTEBOOK_FEATURE_SPEC.md §8 row 3) -
// not present in THIS worktree, so this file cannot be typechecked/built in
// isolation. Written against the exact, agreed signatures:
//   isArithmeticLine(line: string): boolean
//   evaluateArithmetic(expression: string): { value: number } | { error: string }
//   extractLatexSpans(text: string): Array<{ type: 'inline' | 'block'; raw: string; start: number; end: number }>
import { evaluateArithmetic, extractLatexSpans, isArithmeticLine } from '../../lib/notebook/mathRecognition';
// Owned by a parallel worktree (see NOTEBOOK_FEATURE_SPEC.md §8 row 13) -
// not installed in THIS worktree. Standard, stable API:
// katex.renderToString(latex, { throwOnError, displayMode }).
import katex from 'katex';
import type { PaperStyleId } from '../../lib/notebook/storage';
import MathLine, { type ArithmeticResult } from './MathLine';

// R2: recognition (both recognizers - arithmetic lines and LaTeX spans) only
// re-runs after the user pauses typing for this long, or immediately on
// blur - never on every keystroke. `content` itself is still fully live/
// controlled on every keystroke (typing must never feel laggy); only the
// *derived recognition* lags behind by this debounce.
const RECOGNITION_DEBOUNCE_MS = 500;

export interface NotebookPageProps {
  /** The note's literal, full text - sacred per R1. This component only ever reads it to derive recognition/rendering; it is never rewritten by anything in this file. */
  content: string;
  /** Called with the new literal text on every keystroke (a standard controlled-textarea callback) - debouncing the actual localStorage write, if any, is the caller's concern (see `createDebouncedNotesSaver` in app/lib/notebook/storage.ts), not this component's. */
  onContentChange: (content: string) => void;
  /** Which paper style's CSS tokens this page renders with - sets `data-notebook-paper` on this component's own root, per spec §5b/§7a. Scoped to this element only, never `documentElement`. */
  paperStyle: PaperStyleId;
  /** R5 master switch (owned/toggled by the Notebook's toolbar, outside this component). false hides every ghost-result/LaTeX-render layer immediately and reversibly, without touching `content` or `dismissedMathLines`. */
  showMathResults: boolean;
  /** R4: 0-based line indices (by `content.split('\n')`) whose arithmetic annotation has been dismissed for the session. A flag, never a deletion - see the Note type's doc comment in storage.ts for the one known limitation (index drift across structural edits). */
  dismissedMathLines: number[];
  /** Called with the next `dismissedMathLines` array whenever the user dismisses a line's annotation (Esc while that line is focused, or the dismiss button inside its rendered annotation). Dismissal is one-way in v1 - there is no UI to re-show a dismissed line; R5's master switch is the reversible, all-or-nothing control. */
  onDismissedMathLinesChange: (lines: number[]) => void;
  /** Opt-in per-note ruled lines (spec §5c), off by default. No toolbar control ships with this component - the prop exists so one can be wired up later (e.g. from NotebookModal) without changing this file. */
  ruled?: boolean;
  /** Placeholder shown on an empty note. */
  placeholder?: string;
}

interface RecognizedArithmeticLine {
  lineIndex: number;
  line: string;
  result: ArithmeticResult;
}

type LatexSpan = ReturnType<typeof extractLatexSpans>[number];

/**
 * Renders one LaTeX span's KaTeX output. Fails closed per spec §3: if KaTeX
 * itself throws despite `throwOnError: false` (e.g. an unexpected internal
 * error on pathological input), falls back to the literal source text,
 * unstyled, rather than ever crashing the note or showing nothing. The
 * fallback renders as a plain text node (not dangerouslySetInnerHTML), so no
 * escaping is needed there - `dangerouslySetInnerHTML` is only ever used for
 * KaTeX's own generated markup below, never for raw user text.
 */
function LatexSpanView({ span }: { span: LatexSpan }) {
  const isBlock = span.type === 'block';
  const body = isBlock ? span.raw.slice(2, -2) : span.raw.slice(1, -1);

  const html = useMemo(() => {
    try {
      return katex.renderToString(body, { throwOnError: false, displayMode: isBlock });
    } catch {
      return null;
    }
  }, [body, isBlock]);

  if (html === null) {
    return <span className="notebook-latex-fallback font-mono text-[var(--paper-ink-muted)]">{span.raw}</span>;
  }

  // `html` is KaTeX's own generated markup for literal text the user typed
  // themselves, never raw/attacker-controlled HTML - the only place this
  // file uses dangerouslySetInnerHTML, and deliberately the only place it
  // needs to (the fallback above renders `span.raw` as a plain text node).
  return <span className="notebook-latex-render" dangerouslySetInnerHTML={{ __html: html }} />;
}

function lineIndexAtCursor(text: string, cursorPos: number): number {
  return text.slice(0, Math.max(0, cursorPos)).split('\n').length - 1;
}

/**
 * Debounces *recognition timing* (R2), independent of `content` itself
 * (which stays fully live on every keystroke so typing never lags). Returns
 * the "settled" text recognition should run against, plus a `flush` to
 * settle immediately - used on textarea blur, per R2's "or on blur of that
 * line" alternative trigger.
 */
function useSettledText(content: string, delayMs: number): [string, () => void] {
  const [settled, setSettled] = useState(content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setSettled(content);
    }, delayMs);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [content, delayMs]);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSettled(content);
  }, [content]);

  return [settled, flush];
}

/**
 * The Notebook's writing surface (NOTEBOOK_FEATURE_SPEC.md §3/§5/§7a, §8
 * row 6). A single, always fully visible, plain `<textarea>` is the entire
 * editing experience - chosen over a contenteditable/rich-text surface
 * specifically because R1 ("select-all + copy is always byte-identical to
 * what was typed") then holds *by construction*: `content` is the
 * textarea's literal value, full stop, with no transformation step for any
 * background process to ever get wrong. See this file's own design-decision
 * note further down for how recognized math/LaTeX are rendered without
 * touching that value.
 *
 * DESIGN DECISION - where rendered math appears, worth flagging explicitly
 * for whoever wires this into NotebookModal: R1 permits an auto-formatted
 * annotation to be positioned "next to or below the source text" (its own
 * wording), and §3 separately describes the common case as a ghost result
 * appearing inline right after a line's trailing `=`. This component takes
 * the "below" option: recognized annotations render in a single "Recognized"
 * section directly beneath the textarea, in source order, each one showing
 * its own source line/span alongside its rendered result (via `MathLine`
 * for arithmetic, via KaTeX for LaTeX spans) - never pixel-overlaid onto the
 * textarea itself. That tradeoff was deliberate: a true inline overlay
 * (transparent textarea atop a mirrored render layer) requires pixel-exact
 * font-metric measurement to keep the invisible caret aligned with the
 * visible render, is the single easiest place for a visual bug this agent
 * has no way to see or screenshot to verify, and gets meaningfully harder
 * once KaTeX glyphs (whose rendered width never matches their source
 * character count) are involved mid-line. The chosen layout is simpler,
 * fully robust (no click-through/z-index/scroll-sync edge cases), and is
 * explicitly spec-compliant per R1's own wording - but it is a visibly
 * different arrangement than Apple Math Notes' literal same-line ghost
 * text, so flag it to the product owner if that distinction matters for v1.
 */
export default function NotebookPage({
  content,
  onContentChange,
  paperStyle,
  showMathResults,
  dismissedMathLines,
  onDismissedMathLinesChange,
  ruled = false,
  placeholder = 'Start writing…',
}: NotebookPageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [settledContent, flushRecognition] = useSettledText(content, RECOGNITION_DEBOUNCE_MS);

  // Auto-grow the textarea to fit all content with no internal scrolling -
  // the page's own scroll container handles overflow instead. Keeps the
  // "below the source text" annotations always directly adjacent to the
  // text they describe, with no separately-scrolling inner pane to drift
  // out of sync with the outer page.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  const lines = useMemo(() => settledContent.split('\n'), [settledContent]);

  const recognizedLines = useMemo<RecognizedArithmeticLine[]>(() => {
    const out: RecognizedArithmeticLine[] = [];
    lines.forEach((line, lineIndex) => {
      if (!isArithmeticLine(line)) return;
      // isArithmeticLine's own contract (spec §3 R3) is the trailing-`=`
      // line; evaluateArithmetic takes the bare expression, so the trailing
      // `=` (and surrounding whitespace) is stripped before calling it.
      // NOTE for integration: if mathRecognition.ts's evaluateArithmetic
      // turns out to expect the `=` left in, this is the one line to change.
      const expression = line.replace(/=\s*$/, '').trim();
      out.push({ lineIndex, line, result: evaluateArithmetic(expression) });
    });
    return out;
  }, [lines]);

  const latexSpans = useMemo(() => extractLatexSpans(settledContent), [settledContent]);

  const visibleRecognizedLines = useMemo(
    () => recognizedLines.filter((entry) => !dismissedMathLines.includes(entry.lineIndex)),
    [recognizedLines, dismissedMathLines]
  );

  const dismissLine = useCallback(
    (lineIndex: number) => {
      if (dismissedMathLines.includes(lineIndex)) return;
      onDismissedMathLinesChange([...dismissedMathLines, lineIndex]);
    },
    [dismissedMathLines, onDismissedMathLinesChange]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onContentChange(event.target.value);
    },
    [onContentChange]
  );

  // R4: Esc dismisses the *currently focused line's* annotation, if it has
  // one showing. Only ever adds to dismissedMathLines (one-way for v1) and
  // stops the keydown from bubbling only when it actually handled a
  // dismissal - otherwise Escape passes through untouched so the Notebook
  // modal's own close-on-Escape behavior (if any) still works normally when
  // the current line has nothing to dismiss.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Escape') return;
      const cursorPos = event.currentTarget.selectionStart ?? 0;
      const lineIndex = lineIndexAtCursor(content, cursorPos);
      const hasVisibleAnnotation = visibleRecognizedLines.some((entry) => entry.lineIndex === lineIndex);
      if (!hasVisibleAnnotation) return;
      event.stopPropagation();
      dismissLine(lineIndex);
    },
    [content, visibleRecognizedLines, dismissLine]
  );

  const hasAnnotations = showMathResults && (visibleRecognizedLines.length > 0 || latexSpans.length > 0);

  return (
    <div data-notebook-root data-notebook-paper={paperStyle} className="flex h-full w-full flex-col">
      <div
        className={`notebook-page relative flex-1 overflow-y-auto rounded-lg p-6 ${ruled ? 'notebook-page--ruled' : ''}`}
        style={{ backgroundColor: 'var(--paper-bg)', color: 'var(--paper-ink)' }}
      >
        <textarea
          ref={textareaRef}
          className="notebook-textarea block w-full resize-none bg-transparent outline-none"
          style={{
            font: 'inherit',
            fontSize: '17px',
            lineHeight: 1.75,
            color: 'var(--paper-ink)',
            caretColor: 'var(--paper-accent)',
            overflow: 'hidden',
          }}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={flushRecognition}
          placeholder={placeholder}
          aria-label="Note content"
          spellCheck={false}
        />

        {hasAnnotations && (
          <div
            className="notebook-rendered mt-4 flex flex-col gap-2 border-t pt-4"
            style={{ borderColor: 'var(--paper-rule)' }}
            aria-label="Recognized math"
          >
            <p
              className="m-0 text-xs font-medium uppercase"
              style={{ color: 'var(--paper-ink-muted)', letterSpacing: '0.06em' }}
            >
              Recognized
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {visibleRecognizedLines.map(({ lineIndex, line, result }) => (
                <li key={`arith-${lineIndex}`} style={{ fontSize: '17px', lineHeight: 1.6 }}>
                  <MathLine
                    line={line}
                    result={result}
                    dismissed={dismissedMathLines.includes(lineIndex)}
                    onDismiss={() => dismissLine(lineIndex)}
                  />
                </li>
              ))}
              {latexSpans.map((span) => (
                <li key={`latex-${span.start}-${span.end}`} style={{ fontSize: '17px', lineHeight: 1.6 }}>
                  <LatexSpanView span={span} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
