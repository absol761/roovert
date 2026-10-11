import { describe, it, expect } from 'vitest';
import { parseOpenAISSEStream } from './parseOpenAISSEStream';

/**
 * Builds a real ReadableStream<Uint8Array> that enqueues one chunk per
 * string argument (UTF-8 encoded), then closes. Using a genuine
 * ReadableStream (rather than a mocked reader) exercises the real
 * getReader()/TextDecoder code path that parseOpenAISSEStream relies on.
 */
function streamFromChunks(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/** Builds a stream from raw pre-encoded byte chunks (for split-codepoint tests). */
function streamFromBytes(...byteChunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const bytes of byteChunks) {
        controller.enqueue(bytes);
      }
      controller.close();
    },
  });
}

/** Drains the generator via a real `for await` loop, as real callers do. */
async function collect(stream: ReadableStream<Uint8Array>): Promise<Record<string, unknown>[]> {
  const deltas: Record<string, unknown>[] = [];
  for await (const delta of parseOpenAISSEStream(stream)) {
    deltas.push(delta);
  }
  return deltas;
}

describe('parseOpenAISSEStream', () => {
  it('yields the delta from a single complete data: line in one chunk', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'hello' }]);
  });

  it('yields multiple deltas from multiple data: lines in one chunk, in order', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"delta":{"content":"one"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"two"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"three"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([
      { content: 'one' },
      { content: 'two' },
      { content: 'three' },
    ]);
  });

  it('reassembles a single JSON line split across two read() chunks', async () => {
    // The line is split mid-JSON, well before any newline, so buffering
    // across reads is the only thing that can make this parse correctly.
    const stream = streamFromChunks(
      'data: {"choi',
      'ces":[{"delta":{"content":"hi"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'hi' }]);
  });

  it('reassembles a line split across more than two chunks', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"del',
      'ta":{"content":"ab',
      'c"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'abc' }]);
  });

  it('does not corrupt a multi-byte UTF-8 character split across a chunk boundary', async () => {
    // 🎉 (U+1F389) encodes to 4 UTF-8 bytes: F0 9F 8E 89. Split it in the
    // middle so neither chunk contains a valid, complete code point on its
    // own - only `decoder.decode(value, { stream: true })` buffering those
    // partial bytes internally keeps this from becoming mangled/replacement
    // characters.
    const full = 'data: {"choices":[{"delta":{"content":"party 🎉 time"}}]}\n';
    const fullBytes = new TextEncoder().encode(full);

    // Find the emoji's byte offset so we can split inside its 4-byte run.
    const emojiBytes = new TextEncoder().encode('🎉');
    const needle = Array.from(emojiBytes);
    let emojiStart = -1;
    outer: for (let i = 0; i <= fullBytes.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (fullBytes[i + j] !== needle[j]) continue outer;
      }
      emojiStart = i;
      break;
    }
    expect(emojiStart).toBeGreaterThan(-1);

    const splitPoint = emojiStart + 2; // inside the 4-byte emoji sequence
    const firstChunk = fullBytes.slice(0, splitPoint);
    const secondChunk = fullBytes.slice(splitPoint);

    const stream = streamFromBytes(firstChunk, secondChunk);
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'party 🎉 time' }]);
  });

  it('skips data: [DONE] without yielding a delta', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"delta":{"content":"before"}}]}\n' +
        'data: [DONE]\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'before' }]);
  });

  it('silently skips malformed/truncated JSON and keeps parsing subsequent valid lines', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"delta":{"content":"ok1"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"truncat\n' +
        'data: {"choices":[{"delta":{"content":"ok2"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'ok1' }, { content: 'ok2' }]);
  });

  it('skips a data: line whose JSON has no choices (empty array)', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[]}\n' +
        'data: {"choices":[{"delta":{"content":"after"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'after' }]);
  });

  it('skips a data: line whose choice has no delta', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{}]}\n' +
        'data: {"choices":[{"delta":{"content":"after"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'after' }]);
  });

  it('skips a data: line whose delta is falsy/empty-ish but present as null', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"delta":null}]}\n' +
        'data: {"choices":[{"delta":{"content":"after"}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'after' }]);
  });

  it('skips blank lines and non-data lines (SSE comments, event: lines)', async () => {
    const stream = streamFromChunks(
      ': this is a comment\n' +
        '\n' +
        'event: message\n' +
        'data: {"choices":[{"delta":{"content":"real"}}]}\n' +
        '\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ content: 'real' }]);
  });

  it('yields nothing and completes cleanly for an empty stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const deltas = await collect(stream);
    expect(deltas).toEqual([]);
  });

  it('yields realistic multi-field deltas (reasoning_content) exactly as produced', async () => {
    const stream = streamFromChunks(
      'data: {"choices":[{"delta":{"reasoning_content":"thinking...","content":null}}]}\n'
    );
    const deltas = await collect(stream);
    expect(deltas).toEqual([{ reasoning_content: 'thinking...', content: null }]);
  });
});
