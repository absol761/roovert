'use client';

import { X } from 'lucide-react';

/** The shape `evaluateArithmetic` (app/lib/notebook/mathRecognition.ts) returns. */
export type ArithmeticResult = { value: number } | { error: string };

export interface MathLineProps {
  /** The recognized line's literal source text, rendered completely untouched (R1) - this component never edits or re-formats it. */
  line: string;
  /** The evaluation outcome for `line`, from `evaluateArithmetic`. */
  result: ArithmeticResult;
  /** Whether this line's annotation has been dismissed for the session (R4). When true, nothing but the literal line renders - see the module comment below. */
  dismissed: boolean;
  /** Called when the user dismisses this line's annotation (click/Enter/Space on the dismiss button). Caller is responsible for recording this as a per-line flag (e.g. Note.dismissedMathLines), never as a text edit. */
  onDismiss: () => void;
}

// Keeps floating-point noise (0.1 + 0.2 -> 0.30000000000000004) out of the
// ghost result without rounding so aggressively that legitimately precise
// results lose meaningful digits.
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return 'undefined';
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1e9) / 1e9);
}

/**
 * Renders one recognized arithmetic line (NotebookPage.tsx, via
 * `isArithmeticLine`/`evaluateArithmetic`) as the user's literal line text
 * plus a non-editable "ghost" annotation after the trailing `=` - an
 * additional visual layer, never a rewrite of `line` itself (R1). Layout-
 * position-agnostic by design: NotebookPage decides whether this renders
 * inline, in a below-the-editor results list, etc.
 *
 * Per NOTEBOOK_FEATURE_SPEC.md §6 pitfall #2, the ghost result text itself
 * renders at **14px minimum, full-opacity `--paper-accent`** - deliberately
 * NOT `--paper-ink-muted` or any further-dimmed variant, even though ghost
 * annotations usually read as "secondary" UI. The spec's WCAG contrast table
 * (§6) was computed against full-opacity accent ink specifically because
 * this text is already small and inline by nature; muting it further would
 * drop it below the margin that table establishes.
 *
 * Per §6 pitfall #3, `dismissed` (R4) removes the annotation from layout
 * entirely rather than just fading it, so the "off" signal isn't color-only.
 */
export default function MathLine({ line, result, dismissed, onDismiss }: MathLineProps) {
  if (dismissed) {
    return <span className="notebook-math-line whitespace-pre-wrap">{line}</span>;
  }

  const isError = 'error' in result;
  const resultText = isError ? result.error : formatValue(result.value);

  return (
    <span className="notebook-math-line inline-flex flex-wrap items-baseline gap-2 whitespace-pre-wrap">
      <span className="whitespace-pre-wrap">{line}</span>
      <span
        className="inline-flex items-baseline gap-1 rounded px-1 text-[15px] font-medium text-[var(--paper-accent)]"
        data-state={isError ? 'error' : 'value'}
        title={isError ? `Can't evaluate: ${resultText}` : undefined}
      >
        {isError ? `can’t evaluate` : resultText}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 inline-flex items-center justify-center rounded p-0.5 text-[var(--paper-accent)] opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-accent)]"
          aria-label={`Dismiss ${isError ? "can't-evaluate" : 'result'} annotation for "${line.trim()}"`}
          title="Dismiss (Esc)"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </span>
    </span>
  );
}
