// Notebook persistence - localStorage CRUD for the notes array.
//
// Mirrors the exact try/catch-wrapped, SSR-safe read/write shape app/page.tsx
// already uses for RESPONSE_STYLE_STORAGE_KEY / persistConversations: every
// localStorage call is wrapped so a disabled/full/private-mode storage layer
// degrades to "nothing persists this time" rather than crashing the app, and
// every read guards `typeof window === 'undefined'` so this module is safe to
// import from code that might run during SSR (it never will for a Notebook
// that only mounts client-side via next/dynamic, per spec §7c, but the guard
// costs nothing and keeps this module honestly SSR-safe on its own, without
// relying on callers to know that).
//
// See docs/design/NOTEBOOK_FEATURE_SPEC.md §7c and §8 (row 4) for the
// contract this file implements.

export type PaperStyleId = 'white' | 'black' | 'construction';

export const DEFAULT_PAPER_STYLE: PaperStyleId = 'white';

/**
 * A single Notebook note.
 *
 * `content` is the literal, byte-identical text the user typed - per spec
 * R1 ("the stored text is never rewritten by a background process"), NOTHING
 * in this codebase should ever write a transformed/annotated version of a
 * note's text back into this field. `title` is a derived display label
 * (see `deriveNoteTitle`), kept as a separate field rather than computed on
 * every read so a note list can render titles without re-deriving them from
 * potentially-large `content` strings on every render.
 *
 * `dismissedMathLines` implements R4: indices (0-based, by line number in
 * `content.split('\n')`) of arithmetic lines whose ghost-result annotation
 * the user has dismissed for the session. This is a per-line *flag*, never a
 * deletion - the line's literal text is completely unaffected, and the flag
 * only suppresses re-showing that one line's rendered annotation. Indices are
 * a deliberate simplification for v1: inserting/removing a line above a
 * dismissed one will shift which physical line the dismissal appears to
 * apply to. Spec R4 only requires session-scoped, per-line undoability, not
 * durability across structural edits, so this tradeoff is in-scope for v1 -
 * see NotebookPage.tsx's module comment for the integration-time note on
 * this.
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  paperStyle: PaperStyleId;
  dismissedMathLines: number[];
  createdAt: number;
  updatedAt: number;
}

const NOTES_STORAGE_KEY = 'roovert_notebook_notes';

// How long to wait after the last call to a debounced saver's `save()`
// before actually writing to localStorage - keeps every keystroke from
// hitting storage while still saving promptly once typing pauses.
const SAVE_DEBOUNCE_MS = 500;

const MAX_TITLE_LENGTH = 60;
const PAPER_STYLE_IDS: readonly PaperStyleId[] = ['white', 'black', 'construction'];

function generateNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (very old browsers) -
  // not cryptographically strong, but this is just a local list key, not a
  // security-sensitive identifier. Mirrors generateConversationId in
  // app/page.tsx.
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Cheap, zero-dependency auto-title: the first non-blank line of the note,
 * trimmed and length-capped. Deliberately simple (no LLM call) so a note's
 * title is available the instant it has any content, with no round trip and
 * no risk of an AI summarization step quietly editing/interpreting text the
 * user hasn't asked it to touch (R1's spirit applied to the title too).
 */
export function deriveNoteTitle(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  if (!firstLine) return 'Untitled note';
  if (firstLine.length <= MAX_TITLE_LENGTH) return firstLine;
  return `${firstLine.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`;
}

/** Creates a new, empty note with sensible defaults. Not persisted by itself - pass it to `saveNotes`/a debounced saver once it has an id in the caller's notes array. */
export function createNote(paperStyle: PaperStyleId = DEFAULT_PAPER_STYLE): Note {
  const now = Date.now();
  return {
    id: generateNoteId(),
    title: 'Untitled note',
    content: '',
    paperStyle,
    dismissedMathLines: [],
    createdAt: now,
    updatedAt: now,
  };
}

function isPaperStyleId(value: unknown): value is PaperStyleId {
  return typeof value === 'string' && (PAPER_STYLE_IDS as readonly string[]).includes(value);
}

// Defensive shape-check on anything read back from localStorage - storage
// can be hand-edited, shared across app versions, or simply corrupted, and
// a malformed note here must never crash the Notebook. Unrecognized entries
// are silently dropped by `loadNotes` rather than passed through half-typed.
function isValidNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.content === 'string' &&
    isPaperStyleId(candidate.paperStyle) &&
    Array.isArray(candidate.dismissedMathLines) &&
    candidate.dismissedMathLines.every((n) => typeof n === 'number') &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  );
}

/** Reads the full notes array from localStorage. Returns `[]` on first run, during SSR, or if storage is unavailable/corrupt - never throws. */
export function loadNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidNote);
  } catch {
    // Corrupt JSON or storage access denied (private browsing in some
    // browsers can throw on read, not just write) - start from an empty
    // list rather than crashing the Notebook.
    return [];
  }
}

/**
 * Immediately, synchronously persists the full notes array. Best-effort -
 * matches the "persistence is a nice-to-have, not a requirement" stance
 * `persistConversations` already takes in app/page.tsx: a quota-exceeded or
 * storage-disabled error is swallowed, never surfaced as a crash.
 */
export function saveNotes(notes: Note[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (notes.length === 0) {
      window.localStorage.removeItem(NOTES_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota exceeded or storage unavailable - best-effort only.
  }
}

/** Returns `notes` with `note` inserted (if its id is new) or replacing the existing entry with the same id. Pure - does not mutate `notes`. */
export function upsertNote(notes: Note[], note: Note): Note[] {
  const index = notes.findIndex((n) => n.id === note.id);
  if (index === -1) return [...notes, note];
  const next = notes.slice();
  next[index] = note;
  return next;
}

/** Returns `notes` with the note matching `id` removed. Pure - does not mutate `notes`. A no-op (returns an equal-length array) if no note has that id. */
export function deleteNote(notes: Note[], id: string): Note[] {
  return notes.filter((n) => n.id !== id);
}

/**
 * Applies a partial update to one note by id, stamping `updatedAt` and
 * (unless `patch` explicitly sets `title`) re-deriving the title from the
 * new content. This is the one function most UI call sites should reach
 * for instead of hand-assembling a new Note object, so "forgot to bump
 * updatedAt" / "forgot to re-derive the title" can't happen independently
 * at each call site.
 */
export function updateNote(notes: Note[], id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>): Note[] {
  const existing = notes.find((n) => n.id === id);
  if (!existing) return notes;
  const nextContent = patch.content ?? existing.content;
  const updated: Note = {
    ...existing,
    ...patch,
    title: patch.title ?? (patch.content !== undefined ? deriveNoteTitle(nextContent) : existing.title),
    updatedAt: Date.now(),
  };
  return upsertNote(notes, updated);
}

export interface DebouncedNotesSaver {
  /** Schedules a save `delayMs` after the most recent call; repeated calls keep pushing the save back, so only the last one in a burst actually writes. */
  save: (notes: Note[]) => void;
  /** Cancels any pending scheduled save and writes `notes` immediately. Call this before the Notebook unmounts/closes so a save scheduled a moment before close is never lost to a timer that never gets to fire. */
  flush: (notes: Note[]) => void;
  /** Cancels any pending scheduled save without writing. */
  cancel: () => void;
}

/**
 * Creates an independent debounced-save helper around `saveNotes`, per spec
 * §8 row 4 ("debounced save"). A factory rather than module-level singleton
 * state so each NotebookModal instance (and each test) gets its own timer,
 * with no risk of one instance's pending save bleeding into another's.
 */
export function createDebouncedNotesSaver(delayMs: number = SAVE_DEBOUNCE_MS): DebouncedNotesSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    save(notes: Note[]) {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        saveNotes(notes);
      }, delayMs);
    },
    flush(notes: Note[]) {
      cancel();
      saveNotes(notes);
    },
    cancel,
  };
}
