import { describe, it, expect } from 'vitest';
import { extractThinkChunks, HUGGINGFACE_MODEL_MAP, type ThinkState } from './huggingface';

const freshState = (): ThinkState => ({ insideThink: false, pending: '' });

describe('HUGGINGFACE_MODEL_MAP', () => {
  it('maps every key to a non-empty provider/model id string', () => {
    const entries = Object.entries(HUGGINGFACE_MODEL_MAP);
    expect(entries.length).toBeGreaterThan(0);
    for (const [id, apiId] of entries) {
      expect(typeof id).toBe('string');
      expect(apiId).toMatch(/^[^/]+\/[^/]+$/);
    }
  });
});

describe('extractThinkChunks', () => {
  it('returns plain content unchanged when there are no think tags', () => {
    const { chunks, state } = extractThinkChunks('hello world', freshState());

    expect(chunks).toEqual([{ type: 'content', text: 'hello world' }]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });

  it('splits a single complete <think> block into reasoning then content', () => {
    const { chunks, state } = extractThinkChunks(
      '<think>because reasons</think>the answer',
      freshState()
    );

    expect(chunks).toEqual([
      { type: 'reasoning', text: 'because reasons' },
      { type: 'content', text: 'the answer' },
    ]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });

  it('handles content that starts inside a think block with nothing before it', () => {
    const { chunks, state } = extractThinkChunks('<think>reasoning only', freshState());

    expect(chunks).toEqual([{ type: 'reasoning', text: 'reasoning only' }]);
    expect(state.insideThink).toBe(true);
  });

  it('emits no chunk for an empty segment between adjacent markers', () => {
    const { chunks } = extractThinkChunks('<think></think>after', freshState());

    // "before" text is empty when open and close markers are adjacent, so
    // only the post-close content chunk should be emitted.
    expect(chunks).toEqual([{ type: 'content', text: 'after' }]);
  });

  it('carries state across a <think> tag split across two deltas', () => {
    const first = extractThinkChunks('prefix<thi', freshState());
    expect(first.chunks).toEqual([{ type: 'content', text: 'prefix' }]);
    expect(first.state.pending).toBe('<thi');
    expect(first.state.insideThink).toBe(false);

    const second = extractThinkChunks('nk>hidden</think>visible', first.state);
    expect(second.chunks).toEqual([
      { type: 'reasoning', text: 'hidden' },
      { type: 'content', text: 'visible' },
    ]);
    expect(second.state).toEqual({ insideThink: false, pending: '' });
  });

  it('carries state across a </think> closing tag split across two deltas', () => {
    const first = extractThinkChunks('<think>reasoning</thi', freshState());
    expect(first.chunks).toEqual([{ type: 'reasoning', text: 'reasoning' }]);
    expect(first.state.pending).toBe('</thi');
    expect(first.state.insideThink).toBe(true);

    const second = extractThinkChunks('nk>final', first.state);
    expect(second.chunks).toEqual([{ type: 'content', text: 'final' }]);
    expect(second.state).toEqual({ insideThink: false, pending: '' });
  });

  it('holds back a partial marker prefix even when it is only one character', () => {
    const { chunks, state } = extractThinkChunks('hello<', freshState());

    expect(chunks).toEqual([{ type: 'content', text: 'hello' }]);
    expect(state.pending).toBe('<');
  });

  it('does not hold back a character that cannot start the marker', () => {
    const { chunks, state } = extractThinkChunks('hello world!', freshState());

    expect(chunks).toEqual([{ type: 'content', text: 'hello world!' }]);
    expect(state.pending).toBe('');
  });

  it('flushes a false-alarm pending fragment once it fails to complete the marker', () => {
    const first = extractThinkChunks('abc<', freshState());
    expect(first.state.pending).toBe('<');

    // Next delta does not continue the "<think>" marker, so the held-back
    // "<" must be re-emitted as ordinary content, not silently dropped.
    const second = extractThinkChunks('xyz', first.state);
    expect(second.chunks).toEqual([{ type: 'content', text: '<xyz' }]);
    expect(second.state).toEqual({ insideThink: false, pending: '' });
  });

  it('handles multiple think blocks within a single chunk', () => {
    const { chunks, state } = extractThinkChunks(
      '<think>a</think>b<think>c</think>d',
      freshState()
    );

    expect(chunks).toEqual([
      { type: 'reasoning', text: 'a' },
      { type: 'content', text: 'b' },
      { type: 'reasoning', text: 'c' },
      { type: 'content', text: 'd' },
    ]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });

  it('returns empty chunks and unchanged state for an empty string input', () => {
    const { chunks, state } = extractThinkChunks('', freshState());

    expect(chunks).toEqual([]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });
});
