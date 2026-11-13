'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Wand2, BookOpen, Calculator, Loader2, X, Plus, Replace, TriangleAlert } from 'lucide-react';
import {
  NOTEBOOK_CLEANUP_PROMPT,
  NOTEBOOK_EXPLAIN_PROMPT,
  NOTEBOOK_CHECK_MATH_PROMPT,
} from '../../lib/prompts';

// ---------------------------------------------------------------------------
// AskAIPanel - the Notebook's "Ask AI" affordance (spec §4).
//
// This component is deliberately self-contained: it owns the three canned
// actions, the request to /api/query-gateway, the streaming parse, and the
// preview-card UI. It does NOT own the writing surface, text selection, or
// where it's anchored on screen - the parent (e.g. NotebookPage.tsx) decides
// when to mount it (as a selection popover positioned near the user's
// selection, or docked near a toolbar button when nothing is selected) and
// passes in the relevant text as props.
//
// R6 ("AI output is always a proposal, never a commit" - see
// docs/design/NOTEBOOK_FEATURE_SPEC.md §4/R6) is the one rule this file is
// built around: the streamed response is held ONLY in this component's own
// local state and rendered into a visibly separate preview card. There is
// no path - success, error, empty response, or the user closing the panel
// mid-stream - that calls `onInsert`/`onReplaceSelection` except the explicit
// "Insert"/"Replace selection" button click handlers below. Nothing in this
// file ever mutates the note directly; it only ever hands finished text back
// to the parent through those two callbacks, which the parent applies to the
// note however it sees fit.
// ---------------------------------------------------------------------------

export type NotebookAIActionId = 'cleanup' | 'explain' | 'check-math';

type PanelStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface AskAIPanelProps {
  /**
   * The full, current text of the note that's open. Used as the request's
   * `query` whenever there is no active text selection (toolbar-button
   * mode, operating on the whole note).
   */
  noteText: string;
  /**
   * The user's current text selection within the note's writing surface,
   * if any. When this is a non-empty (post-trim) string, the panel runs in
   * "selection mode": the selection (not the whole note) is sent as the
   * request's `query`, and "Replace selection" is offered on the result.
   * Pass `undefined` or `''` when nothing is selected.
   */
  selectedText?: string;
  /**
   * The id of the model the user currently has active elsewhere in the app
   * (e.g. `selectedModel.id` in app/page.tsx). Passed straight through as
   * `model` in the `/api/query-gateway` request body, unchanged.
   */
  modelId: string;
  /**
   * Called when the user clicks "Insert" on a finished preview, with the
   * AI's full response text. The caller is expected to append this text to
   * the note's stored content. This component never writes to the note
   * itself - this callback is the only way the text leaves the preview
   * card into anything persistent.
   */
  onInsert: (text: string) => void;
  /**
   * Called when the user clicks "Replace selection", with the AI's full
   * response text. Only ever rendered/enabled, and only ever called, when
   * the request that produced this result was driven by a non-empty
   * `selectedText` (i.e. "selection mode" - see above). The caller is
   * expected to replace that exact selection with this text. As with
   * `onInsert`, this is the only way this result can replace anything.
   */
  onReplaceSelection: (text: string) => void;
  /**
   * Called whenever the panel should be closed/unmounted by the parent:
   * the user clicked the close (X) button, clicked "Discard", or clicked
   * Insert/Replace selection (both close the panel after handing the text
   * back). Any in-flight request is aborted before this fires. The parent
   * owns actually hiding/unmounting the panel - this component does not
   * render a "closed" state of its own.
   */
  onClose: () => void;
}

interface CannedAction {
  id: NotebookAIActionId;
  label: string;
  icon: typeof Wand2;
  systemPrompt: string;
}

const CANNED_ACTIONS: CannedAction[] = [
  { id: 'cleanup', label: 'Clean up formatting', icon: Wand2, systemPrompt: NOTEBOOK_CLEANUP_PROMPT },
  { id: 'explain', label: 'Explain this', icon: BookOpen, systemPrompt: NOTEBOOK_EXPLAIN_PROMPT },
  { id: 'check-math', label: 'Check this math', icon: Calculator, systemPrompt: NOTEBOOK_CHECK_MATH_PROMPT },
];

export function AskAIPanel({ noteText, selectedText, modelId, onInsert, onReplaceSelection, onClose }: AskAIPanelProps) {
  const [status, setStatus] = useState<PanelStatus>('idle');
  const [activeActionId, setActiveActionId] = useState<NotebookAIActionId | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Captured at the moment a request starts (not read live from the
  // `selectedText` prop while the result is shown), so "Replace selection"
  // stays correctly enabled/disabled for the request that's actually on
  // screen even if the live selection changes while this is streaming.
  const [requestUsedSelection, setRequestUsedSelection] = useState(false);

  // Tracks the in-flight stream so it can be aborted if the panel is
  // closed (or a new action is started) mid-stream - mirrors the pattern
  // app/page.tsx and FloatingChatWindow.tsx both already use for their own
  // /api/query-gateway requests.
  const abortControllerRef = useRef<AbortController | null>(null);

  const trimmedSelection = selectedText?.trim() ?? '';
  const usingSelection = trimmedSelection.length > 0;
  const sourceText = usingSelection ? trimmedSelection : noteText.trim();

  // Belt-and-suspenders: if this component is ever unmounted directly by
  // the parent (instead of going through handleClose below - e.g. the
  // parent closes the whole Notebook modal while a stream is in flight),
  // the in-flight request is still aborted here so it can never finish
  // into a component that's no longer there to gate it behind a button
  // click.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const resetToIdle = () => {
    setStatus('idle');
    setActiveActionId(null);
    setPreviewText('');
    setErrorMessage(null);
  };

  const handleClose = () => {
    // Cancel cleanly first (R6: closing mid-stream must never let the
    // response land anywhere - abort it, then discard whatever had
    // streamed in so far by resetting local state before telling the
    // parent to unmount/hide us).
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetToIdle();
    onClose();
  };

  const runAction = async (action: CannedAction) => {
    if (!sourceText) {
      setStatus('error');
      setActiveActionId(action.id);
      setErrorMessage(usingSelection
        ? "There's no selected text to work with."
        : 'The note is empty - write something first.');
      return;
    }

    // Starting a new action always supersedes any previous in-flight one.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setActiveActionId(action.id);
    setRequestUsedSelection(usingSelection);
    setStatus('streaming');
    setErrorMessage(null);
    setPreviewText('');

    let fullResponse = '';

    try {
      const res = await fetch('/api/query-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: sourceText,
          model: modelId,
          systemPrompt: action.systemPrompt,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        if (res.status === 429) {
          throw new Error('You are sending requests too quickly. Please wait a moment and try again.');
        }
        throw new Error(`Request failed (status ${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      // Same SSE-chunk parsing as the main chat composer (app/page.tsx) and
      // FloatingChatWindow.tsx: `data: {"content": string, "done": boolean}`
      // lines, buffered across reads since a chunk boundary can split a
      // single `data: ...` line in two.
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (typeof data.content === 'string' && data.content) {
              fullResponse += data.content;
              // Only ever update the local preview buffer - never any
              // note/selection state. This is the one line in the whole
              // streaming loop that renders model output anywhere, and it
              // only ever reaches this component's own preview card.
              setPreviewText(fullResponse);
            }
            if (data.done) {
              streamDone = true;
              break;
            }
          } catch {
            // Skip invalid JSON, matching the main chat composer's parsing.
            continue;
          }
        }
      }

      // The panel may have been closed (and this request aborted) while
      // the loop above was still awaiting `reader.read()`. If so, don't
      // touch status/preview state on the way out - there's nothing to
      // show and nothing should be left in a "done" state for a request
      // the user already discarded.
      if (controller.signal.aborted) {
        return;
      }

      if (!fullResponse.trim()) {
        setStatus('error');
        setErrorMessage("The model didn't return anything. You can try again or try a different action.");
        return;
      }

      setStatus('done');
    } catch (caughtError) {
      // A deliberate abort (panel closed, or a different action started)
      // mid-stream is not an error to show the user - just stop silently.
      const isAbort =
        controller.signal.aborted ||
        (caughtError instanceof DOMException && caughtError.name === 'AbortError') ||
        (caughtError instanceof Error && caughtError.name === 'AbortError');
      if (isAbort) {
        return;
      }

      setStatus('error');
      setErrorMessage(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Couldn't reach the AI just now. Please try again."
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleInsert = () => {
    if (status !== 'done' || !previewText) return;
    onInsert(previewText);
    resetToIdle();
    onClose();
  };

  const handleReplaceSelection = () => {
    if (status !== 'done' || !previewText || !requestUsedSelection) return;
    onReplaceSelection(previewText);
    resetToIdle();
    onClose();
  };

  const handleDiscard = () => {
    // Same as the close button: abort anything in flight, wipe the
    // preview, tell the parent to unmount us. Nothing is written anywhere.
    handleClose();
  };

  const isStreaming = status === 'streaming';
  const activeAction = CANNED_ACTIONS.find(a => a.id === activeActionId) ?? null;

  return (
    <div
      role="dialog"
      aria-label="Ask AI"
      className="w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--hud-bg)] backdrop-blur-xl shadow-[var(--shadow-lg)] overflow-hidden text-[var(--foreground)]"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          <span className="text-xs font-medium truncate">Ask AI</span>
          <span className="text-[11px] text-[var(--muted)] truncate">
            {usingSelection ? '· selection' : '· whole note'}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-full hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Close Ask AI"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {status === 'idle' && (
          <>
            <p className="text-[11px] text-[var(--muted)]">
              {usingSelection
                ? `Runs on your selected text (${trimmedSelection.length} character${trimmedSelection.length === 1 ? '' : 's'}).`
                : 'Nothing is selected, so this runs on the whole note.'}
            </p>
            <div className="space-y-1">
              {CANNED_ACTIONS.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => runAction(action)}
                    disabled={!sourceText}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>
            {!sourceText && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-[11px]">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {usingSelection ? "There's no selected text to work with." : 'The note is empty - write something first.'}
                </span>
              </div>
            )}
          </>
        )}

        {(status === 'streaming' || status === 'done') && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
              {activeAction && <activeAction.icon className="w-3 h-3 shrink-0" />}
              <span className="truncate">{activeAction?.label ?? 'Ask AI'}</span>
              {isStreaming && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
            </div>

            {/* The preview card - a visibly separate surface from the note
                itself (own border/background), never the note's own
                editable area. This is the ONLY place streamed AI text is
                rendered; it is local component state only (previewText)
                and is never written into the note unless the user clicks
                Insert or Replace selection below. */}
            <div
              className="max-h-64 overflow-y-auto custom-scrollbar rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm whitespace-pre-wrap"
              aria-live="polite"
            >
              {previewText || (isStreaming ? 'Thinking…' : '')}
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={handleInsert}
                disabled={status !== 'done' || !previewText}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                Insert
              </button>
              <button
                onClick={handleReplaceSelection}
                disabled={status !== 'done' || !previewText || !requestUsedSelection}
                title={requestUsedSelection ? undefined : 'Only available when a selection drove this request'}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Replace className="w-3.5 h-3.5" />
                Replace selection
              </button>
              <button
                onClick={handleDiscard}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-strong)] transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{errorMessage ?? "Couldn't reach the AI just now. Please try again."}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {activeAction && (
                <button
                  onClick={() => runAction(activeAction)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-strong)] transition-colors"
                >
                  Try again
                </button>
              )}
              <button
                onClick={handleDiscard}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-strong)] transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
