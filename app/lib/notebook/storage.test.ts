import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDebouncedNotesSaver,
  createNote,
  deleteNote,
  deriveNoteTitle,
  loadNotes,
  saveNotes,
  updateNote,
  upsertNote,
  type Note,
} from './storage';

// This repo's vitest config runs in Node (no jsdom - see
// MarkdownMessage.test.tsx's note on the same constraint), so there is no
// real `window`/`localStorage` global to exercise storage.ts against. A
// minimal in-memory Storage polyfill, stubbed as `window.localStorage` for
// the duration of each test, is enough to exercise the real read/write/
// try-catch code paths without adding a jsdom dependency.
class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const STORAGE_KEY = 'roovert_notebook_notes';

function makeNote(overrides: Partial<Note> = {}): Note {
  return { ...createNote(), ...overrides };
}

let fakeLocalStorage: FakeLocalStorage;

beforeEach(() => {
  fakeLocalStorage = new FakeLocalStorage();
  vi.stubGlobal('window', { localStorage: fakeLocalStorage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deriveNoteTitle', () => {
  it('uses the first non-blank line, trimmed', () => {
    expect(deriveNoteTitle('\n  \nHello world\nmore text')).toBe('Hello world');
  });

  it('falls back to a placeholder for empty/whitespace-only content', () => {
    expect(deriveNoteTitle('')).toBe('Untitled note');
    expect(deriveNoteTitle('   \n  \n')).toBe('Untitled note');
  });

  it('truncates long first lines with an ellipsis', () => {
    const longLine = 'x'.repeat(100);
    const title = deriveNoteTitle(longLine);
    expect(title.length).toBeLessThan(longLine.length);
    expect(title.endsWith('…')).toBe(true);
  });

  it('does not truncate a first line at exactly the length cap', () => {
    const exact = 'x'.repeat(60);
    expect(deriveNoteTitle(exact)).toBe(exact);
  });
});

describe('createNote', () => {
  it('creates distinct ids for successive notes', () => {
    const a = createNote();
    const b = createNote();
    expect(a.id).not.toBe(b.id);
  });

  it('defaults to the white paper style and empty content', () => {
    const note = createNote();
    expect(note.paperStyle).toBe('white');
    expect(note.content).toBe('');
    expect(note.dismissedMathLines).toEqual([]);
  });

  it('accepts an explicit paper style', () => {
    expect(createNote('construction').paperStyle).toBe('construction');
  });
});

describe('loadNotes / saveNotes', () => {
  it('returns an empty array when nothing has been saved', () => {
    expect(loadNotes()).toEqual([]);
  });

  it('round-trips a saved notes array', () => {
    const notes = [makeNote({ content: 'a' }), makeNote({ content: 'b' })];
    saveNotes(notes);
    expect(loadNotes()).toEqual(notes);
  });

  it('removes the storage key entirely when saving an empty array', () => {
    saveNotes([makeNote()]);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).not.toBeNull();
    saveNotes([]);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('never throws and falls back to an empty list on corrupt JSON', () => {
    fakeLocalStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => loadNotes()).not.toThrow();
    expect(loadNotes()).toEqual([]);
  });

  it('drops malformed entries instead of returning them half-typed', () => {
    fakeLocalStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([makeNote({ id: 'good' }), { id: 'bad', title: 'missing fields' }, 'not-even-an-object'])
    );
    const loaded = loadNotes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });

  it('never throws even if localStorage.setItem throws (e.g. quota exceeded)', () => {
    const spy = vi.spyOn(fakeLocalStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveNotes([makeNote()])).not.toThrow();
    spy.mockRestore();
  });
});

describe('upsertNote', () => {
  it('appends a note with a new id', () => {
    const notes = [makeNote({ id: 'a' })];
    const next = upsertNote(notes, makeNote({ id: 'b' }));
    expect(next.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('replaces the existing note with the same id in place', () => {
    const notes = [makeNote({ id: 'a', content: 'old' }), makeNote({ id: 'b' })];
    const next = upsertNote(notes, makeNote({ id: 'a', content: 'new' }));
    expect(next).toHaveLength(2);
    expect(next[0].content).toBe('new');
  });

  it('does not mutate the input array', () => {
    const notes = [makeNote({ id: 'a' })];
    const frozen = Object.freeze(notes.slice());
    expect(() => upsertNote(frozen as Note[], makeNote({ id: 'b' }))).not.toThrow();
  });
});

describe('deleteNote', () => {
  it('removes the matching note', () => {
    const notes = [makeNote({ id: 'a' }), makeNote({ id: 'b' })];
    expect(deleteNote(notes, 'a').map((n) => n.id)).toEqual(['b']);
  });

  it('is a no-op when the id is not present', () => {
    const notes = [makeNote({ id: 'a' })];
    expect(deleteNote(notes, 'missing')).toEqual(notes);
  });
});

describe('updateNote', () => {
  it('bumps updatedAt and re-derives the title when content changes', () => {
    const note = makeNote({ id: 'a', content: 'First line', updatedAt: 0 });
    const next = updateNote([note], 'a', { content: 'New first line\nmore' });
    const updated = next.find((n) => n.id === 'a')!;
    expect(updated.content).toBe('New first line\nmore');
    expect(updated.title).toBe('New first line');
    expect(updated.updatedAt).toBeGreaterThan(0);
  });

  it('leaves the title alone when only an unrelated field changes', () => {
    const note = makeNote({ id: 'a', content: 'Keep me', title: 'Keep me' });
    const next = updateNote([note], 'a', { paperStyle: 'black' });
    const updated = next.find((n) => n.id === 'a')!;
    expect(updated.title).toBe('Keep me');
    expect(updated.paperStyle).toBe('black');
  });

  it('respects an explicit title override even when content also changes', () => {
    const note = makeNote({ id: 'a', content: 'Original' });
    const next = updateNote([note], 'a', { content: 'Changed', title: 'Custom title' });
    expect(next.find((n) => n.id === 'a')!.title).toBe('Custom title');
  });

  it('is a no-op when the id is not found', () => {
    const notes = [makeNote({ id: 'a' })];
    expect(updateNote(notes, 'missing', { content: 'x' })).toBe(notes);
  });
});

describe('createDebouncedNotesSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not write to storage until the delay elapses', () => {
    const saver = createDebouncedNotesSaver(500);
    saver.save([makeNote({ content: 'a' })]);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(499);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('collapses a burst of calls into a single write of the latest value', () => {
    const saver = createDebouncedNotesSaver(500);
    saver.save([makeNote({ content: 'a' })]);
    vi.advanceTimersByTime(200);
    saver.save([makeNote({ content: 'b' })]);
    vi.advanceTimersByTime(200);
    saver.save([makeNote({ content: 'c' })]);
    vi.advanceTimersByTime(500);
    expect(loadNotes()).toHaveLength(1);
    expect(loadNotes()[0].content).toBe('c');
  });

  it('flush writes immediately and cancels the pending timer', () => {
    const saver = createDebouncedNotesSaver(500);
    const notes = [makeNote({ content: 'final' })];
    saver.save(notes);
    saver.flush(notes);
    expect(loadNotes()).toHaveLength(1);
    expect(loadNotes()[0].content).toBe('final');
    // Advancing time after flush must not trigger a second (now-cancelled) write.
    const setItemSpy = vi.spyOn(fakeLocalStorage, 'setItem');
    vi.advanceTimersByTime(1000);
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('cancel discards a pending save without writing', () => {
    const saver = createDebouncedNotesSaver(500);
    saver.save([makeNote()]);
    saver.cancel();
    vi.advanceTimersByTime(1000);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
