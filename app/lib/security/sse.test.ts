import { describe, it, expect } from 'vitest';
import { sseError } from './sse';

describe('sseError', () => {
  it('sets the standard SSE headers', () => {
    const response = sseError('something went wrong');
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('produces a single SSE event with the given content and done: true', async () => {
    const response = sseError('something went wrong');
    const body = await response.text();
    expect(body).toBe('data: {"content":"something went wrong","done":true}\n\n');
  });

  it('defaults to status 200 when no status is given (native Response default)', () => {
    const response = sseError('oops');
    expect(response.status).toBe(200);
  });

  it('uses the given status when one is provided', () => {
    const response = sseError('server exploded', 500);
    expect(response.status).toBe(500);
  });

  it('JSON-escapes double quotes in content so the body round-trips through JSON.parse', async () => {
    const response = sseError('he said "hello"');
    const body = await response.text();
    expect(body).toBe('data: {"content":"he said \\"hello\\"","done":true}\n\n');

    const payload = JSON.parse(body.slice('data: '.length));
    expect(payload).toEqual({ content: 'he said "hello"', done: true });
  });

  it('JSON-escapes newlines in content so the SSE framing (blank-line-terminated) is preserved', async () => {
    const response = sseError('line one\nline two');
    const body = await response.text();
    expect(body).toBe('data: {"content":"line one\\nline two","done":true}\n\n');

    // Exactly one literal newline pair (\n\n) ends the event - the content's
    // own newline must be escaped, not literal, or it would split the event.
    expect(body.endsWith('\n\n')).toBe(true);
    expect(body.split('\n')).toHaveLength(3); // [event line, '', '']

    const payload = JSON.parse(body.slice('data: '.length));
    expect(payload).toEqual({ content: 'line one\nline two', done: true });
  });

  it('round-trips arbitrary special characters (backslashes, unicode) through JSON.parse', async () => {
    const content = 'back\\slash and emoji ☃ and tab\there';
    const response = sseError(content);
    const body = await response.text();
    const payload = JSON.parse(body.slice('data: '.length));
    expect(payload).toEqual({ content, done: true });
  });
});
