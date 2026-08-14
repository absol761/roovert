import { describe, it, expect } from 'vitest';
import { extractThinkChunks, HUGGINGFACE_MODEL_MAP, type ThinkState } from './huggingface';

const freshState: ThinkState = { insideThink: false, pending: '' };

describe('HUGGINGFACE_MODEL_MAP', () => {
  it('maps every key to a non-empty HF repo id', () => {
    const entries = Object.entries(HUGGINGFACE_MODEL_MAP);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(key.length).toBeGreaterThan(0);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has unique repo ids (no two model ids resolve to the same backend model)', () => {
    const values = Object.values(HUGGINGFACE_MODEL_MAP);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('extractThinkChunks', () => {
  it('passes plain content through untouched when there are no think tags', () => {
    const { chunks, state } = extractThinkChunks('hello world', freshState);
    expect(chunks).toEqual([{ type: 'content', text: 'hello world' }]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });

  it('returns no chunks for empty input', () => {
    const { chunks, state } = extractThinkChunks('', freshState);
    expect(chunks).toEqual([]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });

  it('splits a single delta containing a full <think>...</think> block', () => {
    const { chunks, state } = extractThinkChunks(
      'before<think>reasoning here</think>after',
      freshState
    );
    expect(chunks).toEqual([
      { type: 'content', text: 'before' },
      { type: 'reasoning', text: 'reasoning here' },
      { type: 'content', text: 'after' },
    ]);
    expect(state).toEqual({ insideThink: false, pending: '' });
  });

  it('classifies content between an unclosed <think> and end-of-buffer as reasoning', () => {
    const { chunks, state } = extractThinkChunks('<think>still thinking', freshState);
    expect(chunks).toEqual([{ type: 'reasoning', text: 'still thinking' }]);
    expect(state.insideThink).toBe(true);
  });

  it('carries insideThink state across successive deltas', () => {
    const first = extractThinkChunks('<think>part one ', freshState);
    expect(first.chunks).toEqual([{ type: 'reasoning', text: 'part one ' }]);
    expect(first.state.insideThink).toBe(true);

    const second = extractThinkChunks('part two</think>answer', first.state);
    expect(second.chunks).toEqual([
      { type: 'reasoning', text: 'part two' },
      { type: 'content', text: 'answer' },
    ]);
    expect(second.state.insideThink).toBe(false);
  });

  it('holds back a partial opening tag split across deltas instead of emitting it as content', () => {
    const first = extractThinkChunks('hello <thi', freshState);
    // "<thi" could be the start of "<think>" - held back as pending, not
    // emitted yet.
    expect(first.chunks).toEqual([{ type: 'content', text: 'hello ' }]);
    expect(first.state.pending).toBe('<thi');
    expect(first.state.insideThink).toBe(false);

    const second = extractThinkChunks('nk>reasoning</think>done', first.state);
    expect(second.chunks).toEqual([
      { type: 'reasoning', text: 'reasoning' },
      { type: 'content', text: 'done' },
    ]);
  });

  it('holds back a partial closing tag split across deltas', () => {
    const first = extractThinkChunks('<think>reasoning</thi', freshState);
    expect(first.chunks).toEqual([{ type: 'reasoning', text: 'reasoning' }]);
    expect(first.state.pending).toBe('</thi');
    expect(first.state.insideThink).toBe(true);

    const second = extractThinkChunks('nk>rest', first.state);
    expect(second.chunks).toEqual([{ type: 'content', text: 'rest' }]);
    expect(second.state.insideThink).toBe(false);
  });

  it('handles multiple think blocks in sequence', () => {
    const { chunks } = extractThinkChunks(
      '<think>one</think>mid<think>two</think>end',
      freshState
    );
    expect(chunks).toEqual([
      { type: 'reasoning', text: 'one' },
      { type: 'content', text: 'mid' },
      { type: 'reasoning', text: 'two' },
      { type: 'content', text: 'end' },
    ]);
  });

  it('does not falsely hold back text that merely starts with "<" but cannot extend into a marker', () => {
    // "<x" cannot be a prefix of "<think>", so it should be emitted as
    // content immediately rather than held back as pending.
    const { chunks, state } = extractThinkChunks('a<x b', freshState);
    expect(chunks).toEqual([{ type: 'content', text: 'a<x b' }]);
    expect(state.pending).toBe('');
  });

  it('round-trips a full streamed response split into many arbitrary small deltas', () => {
    const full = 'Let me think. <think>I should check the facts</think>The answer is 42.';
    let state = freshState;
    let reasoning = '';
    let content = '';
    for (const ch of full) {
      const result = extractThinkChunks(ch, state);
      state = result.state;
      for (const chunk of result.chunks) {
        if (chunk.type === 'reasoning') reasoning += chunk.text;
        else content += chunk.text;
      }
    }
    expect(reasoning).toBe('I should check the facts');
    expect(content).toBe('Let me think. The answer is 42.');
    expect(state).toEqual({ insideThink: false, pending: '' });
  });
});
