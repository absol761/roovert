'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { NotebookPen, X, Plus, Trash2, Sparkles } from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { MODAL_TRANSITION } from '../../lib/motion';
import NotebookPage from './NotebookPage';
import { AskAIPanel } from './AskAIPanel';
import { PAPER_STYLES, DEFAULT_PAPER_STYLE_ID } from '../../lib/notebook/paper';
import {
  type Note,
  type PaperStyleId,
  loadNotes,
  createNote,
  updateNote,
  deleteNote as removeNote,
  upsertNote,
  createDebouncedNotesSaver,
} from '../../lib/notebook/storage';

export interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Passed straight through to AskAIPanel as `modelId` (spec §4) - the same model the user has active elsewhere in the app. */
  modelId: string;
}

function byMostRecent(a: Note, b: Note): number {
  return b.updatedAt - a.updatedAt;
}

/**
 * The Notebook's near-fullscreen modal shell (NOTEBOOK_FEATURE_SPEC.md §7b,
 * §8 row 5). Owns the notes list (create/switch/delete), the paper-style and
 * "Show math results" (R5) controls, and the Ask AI entry point - mounting
 * NotebookPage and AskAIPanel underneath. Notebook state persistence is
 * handled entirely via app/lib/notebook/storage.ts; this component never
 * touches localStorage directly.
 *
 * Known v1 scope trim: AskAIPanel supports a `selectedText` prop for a
 * selection-driven "Replace selection" flow, but NotebookPage does not
 * currently report the textarea's live selection up to this component, so
 * Ask AI here always runs in "whole note" mode. Wiring selection tracking
 * through is a reasonable v2 follow-up, not a safety concern - the panel's
 * own R6 guarantees hold either way.
 */
export function NotebookModal({ isOpen, onClose, modelId }: NotebookModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const saverRef = useRef(createDebouncedNotesSaver());

  // Loads the persisted notes list fresh every time the modal mounts (it's
  // only ever mounted while open, per the gating pattern every other modal
  // in this app uses), auto-creating a first note when there are none yet
  // so the writing surface is never shown with nothing to write into.
  // Computed once via a lazy useState initializer (not an effect) so the
  // very first render already has a valid activeNoteId pointing at a note
  // that's actually in `notes` - two independent effects/initializers each
  // calling createNote() would otherwise mint two different ids. The new
  // note isn't persisted until it has content (see applyUpdate) - there's
  // nothing worth saving about an empty, untouched note.
  const [noteState, setNoteState] = useState<{ notes: Note[]; activeNoteId: string | null }>(() => {
    const loaded = loadNotes();
    if (loaded.length === 0) {
      const first = createNote(DEFAULT_PAPER_STYLE_ID as PaperStyleId);
      return { notes: [first], activeNoteId: first.id };
    }
    return { notes: loaded, activeNoteId: loaded.slice().sort(byMostRecent)[0].id };
  });
  const { notes, activeNoteId } = noteState;
  const [showMathResults, setShowMathResults] = useState(true);
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);

  useFocusTrap(isOpen, containerRef);

  const handleClose = () => {
    saverRef.current.flush(notes);
    onClose();
  };

  useModalDismiss(isOpen, handleClose);

  if (!isOpen) return null;

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const applyUpdate = (patch: Parameters<typeof updateNote>[2]) => {
    if (!activeNoteId) return;
    const next = updateNote(notes, activeNoteId, patch);
    setNoteState({ notes: next, activeNoteId });
    saverRef.current.save(next);
  };

  const handleNewNote = () => {
    const note = createNote(activeNote?.paperStyle ?? (DEFAULT_PAPER_STYLE_ID as PaperStyleId));
    const next = upsertNote(notes, note);
    setNoteState({ notes: next, activeNoteId: note.id });
    setIsAskAIOpen(false);
    saverRef.current.save(next);
  };

  const handleDeleteNote = (id: string) => {
    const next = removeNote(notes, id);
    if (id === activeNoteId) {
      const fallback = next.slice().sort(byMostRecent)[0];
      if (fallback) {
        setNoteState({ notes: next, activeNoteId: fallback.id });
        saverRef.current.save(next);
      } else {
        const fresh = createNote(DEFAULT_PAPER_STYLE_ID as PaperStyleId);
        setNoteState({ notes: [fresh], activeNoteId: fresh.id });
        saverRef.current.save([fresh]);
      }
    } else {
      setNoteState({ notes: next, activeNoteId });
      saverRef.current.save(next);
    }
    setIsAskAIOpen(false);
  };

  const handleAIInsert = (text: string) => {
    if (!activeNote) return;
    const separator = activeNote.content.trim() ? '\n\n' : '';
    applyUpdate({ content: activeNote.content + separator + text });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-[var(--foreground)]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MODAL_TRANSITION}
        className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md"
        onClick={handleClose}
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notebook-modal-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={MODAL_TRANSITION}
        className="relative inset-4 w-full max-w-[96vw] h-[94vh] max-h-[94vh] bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Note list rail */}
        <div className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col">
          <div className="p-3 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={handleNewNote}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New note
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notes.slice().sort(byMostRecent).map((note) => (
              <div
                key={note.id}
                className={`group flex items-center gap-1 rounded-lg ${note.id === activeNoteId ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--surface)]'
                  }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setNoteState((s) => ({ ...s, activeNoteId: note.id }));
                    setIsAskAIOpen(false);
                  }}
                  className={`flex-1 min-w-0 text-left px-2.5 py-2 text-sm truncate ${note.id === activeNoteId ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                    }`}
                  aria-current={note.id === activeNoteId}
                >
                  {note.title}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  aria-label={`Delete "${note.title}"`}
                  className="shrink-0 p-1.5 mr-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Writing surface + toolbar */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
            <h2 id="notebook-modal-title" className="serif-display text-lg flex items-center gap-2 shrink-0">
              <NotebookPen className="w-5 h-5 text-[var(--accent)]" />
              Notebook
            </h2>

            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Paper style">
                {PAPER_STYLES.map((style) => {
                  const selected = activeNote?.paperStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      data-notebook-root
                      data-notebook-paper={style.id}
                      onClick={() => applyUpdate({ paperStyle: style.id as PaperStyleId })}
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${style.name} paper`}
                      title={style.name}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${selected ? 'scale-110 border-[var(--accent)]' : 'border-[var(--border)]'
                        }`}
                      style={{ backgroundColor: 'var(--paper-bg)' }}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowMathResults((v) => !v)}
                className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${showMathResults ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'
                  }`}
                aria-pressed={showMathResults}
                aria-label="Show math results"
                title="Show math results"
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showMathResults ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAskAIOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isAskAIOpen
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)]'
                    }`}
                  aria-pressed={isAskAIOpen}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask AI
                </button>
                {isAskAIOpen && activeNote && (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-10">
                    <AskAIPanel
                      noteText={activeNote.content}
                      modelId={modelId}
                      onInsert={handleAIInsert}
                      onReplaceSelection={handleAIInsert}
                      onClose={() => setIsAskAIOpen(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleClose}
              aria-label="Close Notebook"
              className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)] shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-4">
            {activeNote && (
              <NotebookPage
                // Keyed by note id so switching notes remounts a fresh
                // instance instead of reusing one whose internal debounced
                // recognition state (useSettledText in NotebookPage.tsx)
                // would otherwise keep showing the PREVIOUS note's
                // recognized math/LaTeX for up to 500ms after switching -
                // a real, visible bug caught in QA (the new note's
                // "Recognized" section briefly showed the old note's
                // results). Remounting makes the new instance's settled
                // text start out equal to the new note's actual content,
                // with no stale carryover.
                key={activeNote.id}
                content={activeNote.content}
                onContentChange={(content) => applyUpdate({ content })}
                paperStyle={activeNote.paperStyle}
                showMathResults={showMathResults}
                dismissedMathLines={activeNote.dismissedMathLines}
                onDismissedMathLinesChange={(lines) => applyUpdate({ dismissedMathLines: lines })}
              />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
