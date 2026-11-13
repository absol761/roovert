'use client';

import { useEffect, useRef } from 'react';
import { EditorState, StateField, StateEffect, type Extension } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, WidgetType, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
// Owned by a parallel worktree (see NOTEBOOK_FEATURE_SPEC.md §8 row 3) -
// not present in THIS worktree, so this file cannot be typechecked/built in
// isolation. Written against the exact, agreed signatures:
//   isArithmeticLine(line: string): boolean
//   evaluateArithmetic(expression: string): { value: number } | { error: string }
//   extractLatexSpans(text: string): Array<{ type: 'inline' | 'block'; raw: string; start: number; end: number }>
//   extractShorthandExponents(text: string, excludeRanges?): Array<{ raw: string; start: number; end: number }>
import { evaluateArithmetic, extractLatexSpans, extractShorthandExponents, isArithmeticLine } from '../../lib/notebook/mathRecognition';
// Owned by a parallel worktree (see NOTEBOOK_FEATURE_SPEC.md §8 row 13) -
// not installed in THIS worktree. Standard, stable API:
// katex.renderToString(latex, { throwOnError, displayMode }).
import katex from 'katex';
// KaTeX's generated markup needs its own stylesheet to render correctly -
// without it, the HTML it produces (which includes both the visible glyph
// tree and a normally visually-hidden MathML accessibility tree) shows up
// as plain, unstyled, visibly duplicated text instead of a real
// superscript/equation. Imported here (not globally in app/layout.tsx) so
// it only ever ships to a visitor's bundle as part of this already
// dynamically-imported, off-by-default feature's own chunk.
import 'katex/dist/katex.min.css';
import type { PaperStyleId } from '../../lib/notebook/storage';

export interface NotebookPageProps {
  /** The note's literal, full text - sacred per R1. External changes to this prop (e.g. an Ask AI "Insert") are synced into the editor; the editor's own edits are the only thing `onContentChange` ever reports back. */
  content: string;
  /** Called with the new literal text on every keystroke (a standard controlled-textarea-style callback) - debouncing the actual localStorage write, if any, is the caller's concern (see `createDebouncedNotesSaver` in app/lib/notebook/storage.ts), not this component's. */
  onContentChange: (content: string) => void;
  /** Which paper style's CSS tokens this page renders with - sets `data-notebook-paper` on this component's own root, per spec §5b/§7a. Scoped to this element only, never `documentElement`. */
  paperStyle: PaperStyleId;
  /** R5 master switch (owned/toggled by the Notebook's toolbar, outside this component). false hides every ghost-result/LaTeX-render layer immediately and reversibly, without touching `content` or `dismissedMathLines`. */
  showMathResults: boolean;
  /** R4: 0-based line indices (by line number, matching `content.split('\n')`) whose arithmetic annotation has been dismissed for the session. A flag, never a deletion - see the Note type's doc comment in storage.ts for the one known limitation (index drift across structural edits). */
  dismissedMathLines: number[];
  /** Called with the next `dismissedMathLines` array whenever the user dismisses a line's annotation (Esc while that line is focused, or the dismiss button inside its rendered annotation). Dismissal is one-way in v1 - there is no UI to re-show a dismissed line; R5's master switch is the reversible, all-or-nothing control. */
  onDismissedMathLinesChange: (lines: number[]) => void;
  /** Opt-in per-note ruled lines (spec §5c), off by default. No toolbar control ships with this component - the prop exists so one can be wired up later (e.g. from NotebookModal) without changing this file. */
  ruled?: boolean;
  /** Placeholder shown on an empty note. */
  placeholder?: string;
}

// Keeps floating-point noise (0.1 + 0.2 -> 0.30000000000000004) out of the
// ghost result without rounding so aggressively that legitimately precise
// results lose meaningful digits.
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return 'undefined';
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1e9) / 1e9);
}

// ---------------------------------------------------------------------------
// Live-preview architecture (CodeMirror 6)
//
// DESIGN DECISION, replacing this file's previous plain-<textarea> approach:
// a <textarea> can only ever show monospace plain text - it has no way to
// render a mixed glyph like a real superscript or a KaTeX equation inline,
// so the first version of this component rendered recognized math in a
// separate "Recognized" section below the text instead of inline. That was
// a real, disclosed compromise, not the intended design.
//
// This version uses the same technique Obsidian's "Live Preview" editor
// uses (built on the same library, CodeMirror 6): the document's plain text
// is the one and only source of truth (CodeMirror's EditorState.doc), and
// recognized math is rendered by *replacing* its text range with a widget
// - live, inline, exactly where it was typed - for as long as the cursor
// isn't inside that range. The moment the cursor enters a recognized span
// (click into it, or arrow-key through it), the replacement drops and the
// raw source becomes visible and editable again, then re-renders once the
// cursor leaves. R1 ("select-all + copy is byte-identical to what was
// typed") holds *more* robustly here than it did with the textarea:
// CodeMirror's copy/cut/undo/redo/find-replace all operate on the
// underlying document text, never on a decoration's rendered DOM, by
// construction - there is no code path in this file that ever rewrites
// `state.doc` itself to a transformed value.
//
// Three recognizers feed the decoration layer, all pure functions from
// mathRecognition.ts: `isArithmeticLine`/`evaluateArithmetic` (ghost result
// widget placed right after a line's trailing `=`), `extractLatexSpans`
// (full `$...$`/`$$...$$` KaTeX rendering), and `extractShorthandExponents`
// (bare `x^2`-style tokens, also rendered via KaTeX, with no delimiters
// required - this is the direct fix for the "x^2 should look like x^2"
// feedback that prompted this rewrite).
// ---------------------------------------------------------------------------

interface EditorFacts {
  showMathResults: boolean;
  dismissedMathLines: number[];
}

const setFactsEffect = StateEffect.define<EditorFacts>();
const dismissLineEffect = StateEffect.define<number>();

const factsField = StateField.define<EditorFacts>({
  create: () => ({ showMathResults: true, dismissedMathLines: [] }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFactsEffect)) return effect.value;
    }
    return value;
  },
});

/**
 * The ghost-result annotation after an arithmetic line's `=`, per spec §6
 * pitfall #2 (full-opacity `--paper-accent`, 14px+, never further-muted)
 * and pitfall #3 (dismissal removes it from layout entirely, not just a
 * color/opacity fade - handled here by the decoration simply not existing
 * once a line is in `dismissedMathLines`, same as before).
 */
class ArithmeticResultWidget extends WidgetType {
  constructor(
    private readonly lineIndex: number,
    private readonly sourceLine: string,
    private readonly result: ReturnType<typeof evaluateArithmetic>
  ) {
    super();
  }

  eq(other: ArithmeticResultWidget) {
    return (
      other.lineIndex === this.lineIndex &&
      other.sourceLine === this.sourceLine &&
      JSON.stringify(other.result) === JSON.stringify(this.result)
    );
  }

  toDOM(view: EditorView) {
    const isError = 'error' in this.result;
    const resultText = isError ? "can't evaluate" : formatValue((this.result as { value: number }).value);

    const wrap = document.createElement('span');
    wrap.className = 'notebook-math-ghost';

    const value = document.createElement('span');
    value.className = 'notebook-math-ghost-value';
    value.textContent = resultText;
    if (isError) value.title = `Can't evaluate: ${(this.result as { error: string }).error}`;
    wrap.appendChild(value);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'notebook-math-ghost-dismiss';
    dismiss.setAttribute('aria-label', `Dismiss ${isError ? "can't-evaluate" : 'result'} annotation for "${this.sourceLine.trim()}"`);
    dismiss.title = 'Dismiss (Esc)';
    dismiss.textContent = '×';
    dismiss.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ effects: dismissLineEffect.of(this.lineIndex) });
    });
    wrap.appendChild(dismiss);

    return wrap;
  }

  ignoreEvent(event: Event) {
    // Let our own click handler on the dismiss button run normally; for
    // anything else in the widget, let CodeMirror do its usual click-to-
    // place-cursor handling (so clicking near the end of the line still
    // works the way clicking anywhere else in the text does).
    return event.target instanceof HTMLElement && event.target.closest('.notebook-math-ghost-dismiss') !== null;
  }
}

/**
 * Renders a KaTeX body (already delimiter-stripped by the caller) inline.
 * Fails closed per spec §3: if KaTeX itself throws despite
 * `throwOnError: false`, falls back to the literal raw source as a plain
 * text node (never `dangerouslySetInnerHTML`/`innerHTML` for anything but
 * KaTeX's own generated markup).
 */
class KatexWidget extends WidgetType {
  constructor(
    private readonly latexBody: string,
    private readonly isBlock: boolean,
    private readonly rawFallback: string
  ) {
    super();
  }

  eq(other: KatexWidget) {
    return other.latexBody === this.latexBody && other.isBlock === this.isBlock;
  }

  toDOM() {
    const container = document.createElement(this.isBlock ? 'div' : 'span');
    try {
      // KaTeX's own generated markup for literal text the user typed
      // themselves, never raw/attacker-controlled HTML - the only place
      // this file sets innerHTML, and deliberately the only place it needs
      // to.
      container.innerHTML = katex.renderToString(this.latexBody, { throwOnError: false, displayMode: this.isBlock });
      container.className = this.isBlock ? 'notebook-latex-render-block' : 'notebook-latex-render';
    } catch {
      container.textContent = this.rawFallback;
      container.className = 'notebook-latex-fallback';
    }
    return container;
  }

  ignoreEvent() {
    // Let CodeMirror handle clicks normally so the cursor can land at/near
    // this span and the user can arrow into it to reveal and edit the raw
    // source - the same click-then-arrow-in interaction CodeMirror-based
    // live-preview editors (e.g. Obsidian) use for the same reason.
    return false;
  }
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function buildDecorations(state: EditorState): DecorationSet {
  const facts = state.field(factsField);
  const text = state.doc.toString();
  const sel = state.selection.main;

  const widgets: { from: number; to: number; deco: Decoration }[] = [];

  // Arithmetic ghost results - one widget placed at the end of each
  // recognized line (right after its trailing `=`), never replacing any
  // text.
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber);
    const lineIndex = lineNumber - 1;
    if (!isArithmeticLine(line.text)) continue;
    if (!facts.showMathResults) continue;
    if (facts.dismissedMathLines.includes(lineIndex)) continue;

    // isArithmeticLine's own contract (spec §3 R3) is the trailing-`=`
    // line; evaluateArithmetic takes the bare expression.
    const expression = line.text.replace(/=\s*$/, '').trim();
    const result = evaluateArithmetic(expression);
    widgets.push({
      from: line.to,
      to: line.to,
      deco: Decoration.widget({ widget: new ArithmeticResultWidget(lineIndex, line.text, result), side: 1 }),
    });
  }

  if (facts.showMathResults) {
    const latexSpans = extractLatexSpans(text);

    for (const span of latexSpans) {
      if (rangesOverlap(sel.from, sel.to, span.start, span.end)) continue; // cursor inside - show raw source
      const isBlock = span.type === 'block';
      const body = isBlock ? span.raw.slice(2, -2) : span.raw.slice(1, -1);
      widgets.push({
        from: span.start,
        to: span.end,
        deco: Decoration.replace({ widget: new KatexWidget(body, isBlock, span.raw) }),
      });
    }

    const shorthandTokens = extractShorthandExponents(text, latexSpans);
    for (const token of shorthandTokens) {
      if (rangesOverlap(sel.from, sel.to, token.start, token.end)) continue;
      widgets.push({
        from: token.start,
        to: token.end,
        deco: Decoration.replace({ widget: new KatexWidget(token.raw, false, token.raw) }),
      });
    }
  }

  widgets.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    widgets.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

const decorationsField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update(decorations, tr) {
    if (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(setFactsEffect) || e.is(dismissLineEffect))) {
      return buildDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function lineIndexAtPos(state: EditorState, pos: number): number {
  return state.doc.lineAt(pos).number - 1;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Always-current refs for values read from inside CodeMirror extensions,
  // which are constructed once on mount and must never close over a stale
  // render's props. Synced in an effect (runs after every render, with no
  // dependency array) rather than assigned directly during render, which
  // the React Compiler's lint rules disallow even for this exact "ref
  // mirrors the latest prop" pattern.
  const onContentChangeRef = useRef(onContentChange);
  const onDismissedMathLinesChangeRef = useRef(onDismissedMathLinesChange);
  const dismissedMathLinesRef = useRef(dismissedMathLines);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
    onDismissedMathLinesChangeRef.current = onDismissedMathLinesChange;
    dismissedMathLinesRef.current = dismissedMathLines;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onContentChangeRef.current(update.state.doc.toString());
      }
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(dismissLineEffect)) {
            const current = dismissedMathLinesRef.current;
            if (!current.includes(effect.value)) {
              onDismissedMathLinesChangeRef.current([...current, effect.value]);
            }
          }
        }
      }
    });

    // R4: Esc dismisses the *currently focused line's* annotation, if it
    // has one showing - handled as a raw DOM event (not a CodeMirror
    // keymap command, which has no access to the native event) so
    // `stopPropagation()` can actually suppress the Notebook modal's own
    // close-on-Escape behavior only when this did handle a dismissal.
    // Escape passes through untouched otherwise, so the modal still closes
    // normally when the current line has nothing to dismiss.
    const domEventHandlers = EditorView.domEventHandlers({
      keydown(event, view) {
        if (event.key !== 'Escape') return false;
        const lineIndex = lineIndexAtPos(view.state, view.state.selection.main.head);
        const line = view.state.doc.line(lineIndex + 1);
        const hasVisibleAnnotation =
          isArithmeticLine(line.text) &&
          view.state.field(factsField).showMathResults &&
          !dismissedMathLinesRef.current.includes(lineIndex);
        if (!hasVisibleAnnotation) return false;
        event.stopPropagation();
        view.dispatch({ effects: dismissLineEffect.of(lineIndex) });
        return true;
      },
    });

    const extensions: Extension[] = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'Note content', spellcheck: 'false' }),
      cmPlaceholder(placeholder),
      factsField.init(() => ({ showMathResults, dismissedMathLines })),
      decorationsField,
      updateListener,
      domEventHandlers,
      EditorView.theme({
        '&': { height: '100%', backgroundColor: 'transparent' },
        '.cm-content': {
          fontSize: '17px',
          lineHeight: '1.75',
          color: 'var(--paper-ink)',
          caretColor: 'var(--paper-accent)',
          padding: '0',
          fontFamily: 'inherit',
        },
        '.cm-scroller': { fontFamily: 'inherit', overflow: 'visible' },
        '.cm-gutters': { display: 'none' },
        '&.cm-focused': { outline: 'none' },
        '.cm-placeholder': { color: 'var(--paper-ink-muted)' },
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: content, extensions }),
      parent: container,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally created once per mount (NotebookModal keys this
    // component by note id, so switching notes remounts it fresh rather
    // than reconciling a live note-switch into the same instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Syncs an *external* content change (e.g. an Ask AI "Insert"/"Replace
  // selection", which updates the note's stored `content` directly) into
  // the already-mounted editor. Guarded so the editor's own edits - which
  // flow out via onContentChange and back in as this same prop - never
  // bounce back in as a redundant whole-document replace.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === content) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      selection: { anchor: content.length },
    });
  }, [content]);

  // Syncs the R5 master switch and the dismissed-lines list into the
  // editor's decoration layer whenever either prop changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setFactsEffect.of({ showMathResults, dismissedMathLines }) });
  }, [showMathResults, dismissedMathLines]);

  return (
    <div data-notebook-root data-notebook-paper={paperStyle} className="flex h-full w-full flex-col">
      <div
        className={`notebook-page relative flex-1 overflow-y-auto rounded-lg p-6 ${ruled ? 'notebook-page--ruled' : ''}`}
        style={{ backgroundColor: 'var(--paper-bg)', color: 'var(--paper-ink)' }}
      >
        <div ref={containerRef} className="notebook-editor-host h-full" />
      </div>
    </div>
  );
}
