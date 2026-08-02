import { describe, it, expect } from 'vitest';
import {
  MAX_LENGTHS,
  sanitizeString,
  validateString,
  validateModelId,
  validateConversationHistory,
  validateImage,
  validateAIQueryRequest,
  validateTrackingRequest,
  validateFeedbackRequest,
  validateBodySize,
} from './validation';

describe('sanitizeString', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeString('  hello  ', 100)).toBe('hello');
  });

  it('strips null bytes and control characters but keeps newlines and tabs', () => {
    expect(sanitizeString('a\x00b\x1Fc\nd\te', 100)).toBe('abc\nd\te');
  });

  it('truncates to the max length', () => {
    expect(sanitizeString('abcdef', 3)).toBe('abc');
  });

  it('returns an empty string for non-string input', () => {
    expect(sanitizeString(123 as unknown as string, 100)).toBe('');
  });
});

describe('validateString', () => {
  it('rejects missing required fields', () => {
    const result = validateString(undefined, 'query', 100, true);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  it('allows missing optional fields and returns empty sanitized value', () => {
    const result = validateString(undefined, 'systemPrompt', 100, false);
    expect(result).toEqual({ valid: true, sanitized: '' });
  });

  it('rejects non-string input', () => {
    const result = validateString(42, 'query', 100, true);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must be a string/);
  });

  it('rejects a required field that sanitizes down to empty', () => {
    const result = validateString('   ', 'query', 100, true);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot be empty/);
  });

  it('silently truncates input over the max length rather than rejecting it', () => {
    // sanitizeString() truncates before validateString()'s length check ever
    // runs, so the "exceeds maximum length" error path is unreachable from
    // here - documenting the actual (truncate, not reject) behavior.
    const result = validateString('a'.repeat(101), 'query', 100, true);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toHaveLength(100);
  });

  it('accepts and sanitizes valid input', () => {
    const result = validateString('  hello world  ', 'query', 100, true);
    expect(result).toEqual({ valid: true, sanitized: 'hello world' });
  });
});

describe('validateModelId', () => {
  const allowed = new Set(['ooverta', 'llama-3.3-70b']);

  it('accepts a model id in the allowlist', () => {
    const result = validateModelId('ooverta', allowed);
    expect(result).toEqual({ valid: true, sanitized: 'ooverta' });
  });

  it('rejects a model id not in the allowlist', () => {
    const result = validateModelId('made-up-model', allowed);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid model ID/);
  });

  it('rejects non-string input', () => {
    const result = validateModelId(123, allowed);
    expect(result.valid).toBe(false);
  });
});

describe('validateConversationHistory', () => {
  it('accepts an empty array', () => {
    expect(validateConversationHistory([])).toEqual({ valid: true, sanitized: [] });
  });

  it('rejects non-array input', () => {
    const result = validateConversationHistory('not an array');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must be an array/);
  });

  it('rejects a history longer than the max allowed messages', () => {
    const tooLong = Array.from({ length: MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES + 1 }, () => ({
      role: 'user',
      content: 'hi',
    }));
    const result = validateConversationHistory(tooLong);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/);
  });

  it('rejects a message with an invalid role', () => {
    const result = validateConversationHistory([{ role: 'admin', content: 'hi' }]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid role/);
  });

  it('accepts plain string content', () => {
    const result = validateConversationHistory([{ role: 'user', content: 'hello' }]);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('accepts multimodal text + image content', () => {
    const result = validateConversationHistory([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        ],
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.sanitized?.[0].content).toEqual([
      { type: 'text', text: 'what is this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
    ]);
  });

  it('rejects a content item with an unrecognized shape', () => {
    const result = validateConversationHistory([{ role: 'user', content: [{ type: 'video', foo: 'bar' }] }]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid content item/);
  });

  it('rejects a message that is not an object', () => {
    const result = validateConversationHistory([null]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/is invalid/);
  });
});

describe('validateImage', () => {
  it('treats a missing image as valid (optional field)', () => {
    expect(validateImage(undefined)).toEqual({ valid: true });
  });

  it('accepts a valid base64 data URL', () => {
    const result = validateImage('data:image/png;base64,iVBORw0KGgo=');
    expect(result.valid).toBe(true);
  });

  it('rejects non-string input', () => {
    const result = validateImage(12345);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must be a string/);
  });

  it('rejects a string that is neither a data URL nor plain base64', () => {
    const result = validateImage('not-an-image!!!');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/valid base64/);
  });

  it('rejects an image over the max size', () => {
    const huge = 'data:image/png;base64,' + 'a'.repeat(MAX_LENGTHS.IMAGE_BASE64 + 1);
    const result = validateImage(huge);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceeds maximum size/);
  });
});

describe('validateAIQueryRequest', () => {
  const allowedModels = new Set(['ooverta']);

  it('accepts a minimal valid payload', () => {
    const result = validateAIQueryRequest({ query: 'hello' }, allowedModels);
    expect(result.valid).toBe(true);
    expect(result.sanitized?.query).toBe('hello');
  });

  it('rejects a payload missing the required query field', () => {
    const result = validateAIQueryRequest({}, allowedModels);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /query/.test(e))).toBe(true);
  });

  it('rejects an unexpected field to prevent mass assignment', () => {
    const result = validateAIQueryRequest({ query: 'hi', isAdmin: true }, allowedModels);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /Unexpected fields/.test(e))).toBe(true);
  });

  it('rejects a model not in the allowlist', () => {
    const result = validateAIQueryRequest({ query: 'hi', model: 'not-real' }, allowedModels);
    expect(result.valid).toBe(false);
  });

  it('rejects an invalid outputLength value', () => {
    const result = validateAIQueryRequest({ query: 'hi', outputLength: 'huge' }, allowedModels);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /outputLength/.test(e))).toBe(true);
  });

  it('accepts a fully populated valid payload', () => {
    const result = validateAIQueryRequest(
      {
        query: 'hi',
        model: 'ooverta',
        systemPrompt: 'be nice',
        conversationHistory: [{ role: 'user', content: 'hey' }],
        runParallel: false,
        outputLength: 'medium',
      },
      allowedModels
    );
    expect(result.valid).toBe(true);
    expect(result.sanitized).toMatchObject({
      query: 'hi',
      model: 'ooverta',
      systemPrompt: 'be nice',
      runParallel: false,
      outputLength: 'medium',
    });
  });
});

describe('validateTrackingRequest', () => {
  it('accepts an empty payload (both fields optional)', () => {
    expect(validateTrackingRequest({})).toEqual({ valid: true, errors: [], sanitized: { visitorId: undefined, fingerprint: undefined } });
  });

  it('rejects unexpected fields', () => {
    const result = validateTrackingRequest({ visitorId: 'abc', secret: 'leak' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /Unexpected fields/.test(e))).toBe(true);
  });
});

describe('validateFeedbackRequest', () => {
  it('accepts a valid up rating', () => {
    const result = validateFeedbackRequest({ rating: 'up', modelId: 'ooverta' });
    expect(result).toEqual({ valid: true, errors: [], sanitized: { rating: 'up', modelId: 'ooverta' } });
  });

  it('rejects an invalid rating value', () => {
    const result = validateFeedbackRequest({ rating: 'sideways', modelId: 'ooverta' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /rating/.test(e))).toBe(true);
  });

  it('rejects a payload with message content (data minimization)', () => {
    const result = validateFeedbackRequest({ rating: 'up', modelId: 'ooverta', messageContent: 'leaked text' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /Unexpected fields/.test(e))).toBe(true);
  });
});

describe('validateBodySize', () => {
  it('returns no errors when content length is within the limit', () => {
    expect(validateBodySize('1000', 2000)).toEqual([]);
  });

  it('returns an error when content length exceeds the limit', () => {
    const errors = validateBodySize('3000', 2000);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/too large/);
  });

  it('returns an error for a non-numeric content length', () => {
    const errors = validateBodySize('not-a-number', 2000);
    expect(errors.length).toBe(1);
  });

  it('returns no errors when content length is absent', () => {
    expect(validateBodySize(null, 2000)).toEqual([]);
  });
});
