/**
 * Input Validation & Sanitization System
 * Provides schema-based validation, type checks, length limits, and sanitization
 * Follows OWASP best practices for input validation
 */

// Maximum length constants (OWASP recommended limits)
export const MAX_LENGTHS = {
  QUERY: 10000, // 10KB for user queries
  SYSTEM_PROMPT: 2000, // 2KB for system prompts
  MODEL_ID: 100, // Model identifiers
  MESSAGE_CONTENT: 50000, // 50KB for individual messages
  CONVERSATION_HISTORY_MESSAGES: 50, // Maximum conversation history length
  VISITOR_ID: 200,
  FINGERPRINT: 500,
  IMAGE_BASE64: 10 * 1024 * 1024, // 10MB for base64 images
  IMAGE_PROMPT: 1000, // Text-to-image prompts are short by nature
};

/**
 * Sanitize string input - remove dangerous characters and trim
 */
export function sanitizeString(input: string, maxLength: number): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Enforce length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate string input
 */
export function validateString(
  input: unknown,
  fieldName: string,
  maxLength: number,
  required: boolean = true
): { valid: boolean; error?: string; sanitized?: string } {
  if (required && (input === undefined || input === null)) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (input === undefined || input === null) {
    return { valid: true, sanitized: '' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const sanitized = sanitizeString(input, maxLength);

  if (required && sanitized.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
  }

  return { valid: true, sanitized };
}

/**
 * Validate model ID against allowlist
 */
export function validateModelId(
  modelId: unknown,
  allowedModels: Set<string>
): { valid: boolean; error?: string; sanitized?: string } {
  if (typeof modelId !== 'string') {
    return { valid: false, error: 'Model ID must be a string' };
  }

  const sanitized = sanitizeString(modelId, MAX_LENGTHS.MODEL_ID);

  if (!allowedModels.has(sanitized)) {
    return { valid: false, error: `Invalid model ID: ${sanitized}` };
  }

  return { valid: true, sanitized };
}

/**
 * A single content part of a multimodal (text + image) message.
 */
interface MessageTextContent {
  type: 'text';
  text: string;
}

export interface MessageImageContent {
  type: 'image_url';
  image_url: { url: string };
}

export type MessageContentItem = MessageTextContent | MessageImageContent;

/**
 * A single validated/sanitized conversation history entry.
 */
export interface ConversationMessage {
  role: string;
  content: string | Array<MessageContentItem>;
}

/**
 * Validate conversation history array
 */
export function validateConversationHistory(
  history: unknown
): { valid: boolean; error?: string; sanitized?: Array<ConversationMessage> } {
  if (!Array.isArray(history)) {
    return { valid: false, error: 'Conversation history must be an array' };
  }

  if (history.length > MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES) {
    return { valid: false, error: `Conversation history cannot exceed ${MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES} messages` };
  }

  const sanitized: Array<ConversationMessage> = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];

    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: `Message ${i} is invalid` };
    }

    const msgRecord = msg as Record<string, unknown>;

    // Security: only 'user'/'assistant' are accepted - a client-supplied
    // 'system' role would otherwise let conversationHistory smuggle in a
    // fake system-level instruction (prompt injection). The real system
    // prompt is always set separately by the server, never from history.
    const roleValue = msgRecord.role;
    if (roleValue !== 'user' && roleValue !== 'assistant') {
      return { valid: false, error: `Message ${i} has invalid role: ${String(roleValue)}` };
    }
    const role = roleValue;

    const content = msgRecord.content;
    if (typeof content === 'string') {
      const contentValidation = validateString(content, 'message content', MAX_LENGTHS.MESSAGE_CONTENT, true);
      if (!contentValidation.valid) {
        return { valid: false, error: `Message ${i} content: ${contentValidation.error}` };
      }
      sanitized.push({ role, content: contentValidation.sanitized! });
    } else if (Array.isArray(content)) {
      // Multimodal content (text + image)
      const validatedContent: Array<MessageContentItem> = [];
      for (const rawItem of content as unknown[]) {
        if (!rawItem || typeof rawItem !== 'object') {
          return { valid: false, error: `Message ${i} has invalid content item` };
        }
        const item = rawItem as Record<string, unknown>;
        const imageUrl = item.image_url && typeof item.image_url === 'object'
          ? (item.image_url as Record<string, unknown>)
          : undefined;

        if (item.type === 'text' && typeof item.text === 'string') {
          const textValidation = validateString(item.text, 'text content', MAX_LENGTHS.MESSAGE_CONTENT, true);
          if (!textValidation.valid) {
            return { valid: false, error: `Message ${i} text content: ${textValidation.error}` };
          }
          validatedContent.push({ type: 'text', text: textValidation.sanitized! });
        } else if (item.type === 'image_url' && imageUrl && typeof imageUrl.url === 'string') {
          // Validate image URL (base64 or http/https)
          const urlValidation = validateString(imageUrl.url, 'image URL', MAX_LENGTHS.IMAGE_BASE64, true);
          if (!urlValidation.valid) {
            return { valid: false, error: `Message ${i} image URL: ${urlValidation.error}` };
          }
          validatedContent.push({ type: 'image_url', image_url: { url: urlValidation.sanitized! } });
        } else {
          return { valid: false, error: `Message ${i} has invalid content item` };
        }
      }
      sanitized.push({ role, content: validatedContent });
    } else {
      return { valid: false, error: `Message ${i} has invalid content type` };
    }
  }

  return { valid: true, sanitized };
}

/**
 * Reduces a validated conversation-history message's content down to plain
 * text for forwarding to a model as chat history.
 *
 * Every API route re-sends the *current* turn's image as a proper multimodal
 * part, but resending every *past* turn's image on every subsequent request
 * would be expensive and is unnecessary once a model has already responded
 * to it once. Routes used to handle this by dropping any history message
 * whose content wasn't already a string - which silently deleted the user's
 * words along with the image, leaving an orphaned assistant reply with no
 * matching user turn. This degrades multimodal history entries to their text
 * portion instead, so the conversation stays coherent (including across a
 * model switch) even though the image itself isn't resent.
 *
 * Returns null for an entry with no text at all (e.g. an image with no
 * caption), which callers should treat as "drop this entry".
 */
export function historyContentToText(content: string | Array<MessageContentItem>): string | null {
  if (typeof content === 'string') {
    return content;
  }
  const text = content
    .filter((item): item is MessageTextContent => item.type === 'text')
    .map(item => item.text)
    .join(' ')
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Validate image data (base64)
 */
export function validateImage(image: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (image === undefined || image === null) {
    return { valid: true }; // Optional field
  }

  if (typeof image !== 'string') {
    return { valid: false, error: 'Image must be a string (base64 encoded)' };
  }

  // Check if it's a valid base64 data URL or base64 string
  const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i;
  const isDataUrl = base64Pattern.test(image);
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(image.replace(/\s/g, ''));

  if (!isDataUrl && !isBase64) {
    return { valid: false, error: 'Image must be a valid base64 encoded image' };
  }

  if (image.length > MAX_LENGTHS.IMAGE_BASE64) {
    return { valid: false, error: `Image exceeds maximum size of ${MAX_LENGTHS.IMAGE_BASE64 / 1024 / 1024}MB` };
  }

  return { valid: true, sanitized: image };
}

/**
 * Fields produced by validateAIQueryRequest once a payload has passed
 * validation - i.e. the shape consumers can rely on.
 */
interface SanitizedAIQueryRequest {
  query: string;
  model?: string;
  systemPrompt?: string;
  conversationHistory?: Array<ConversationMessage>;
  image?: string;
  runParallel?: boolean;
  outputLength?: 'small' | 'medium' | 'large';
  parallelModel1?: string;
  parallelModel2?: string;
}

/**
 * Validate AI query request payload
 */
export function validateAIQueryRequest(
  payload: Record<string, unknown>,
  allowedModels: Set<string>
): { valid: boolean; errors: string[]; sanitized?: SanitizedAIQueryRequest } {
  const errors: string[] = [];

  // Validate query (required)
  const queryValidation = validateString(payload.query, 'query', MAX_LENGTHS.QUERY, true);
  if (!queryValidation.valid) {
    errors.push(queryValidation.error!);
  }

  // Validate model (optional, but if provided must be in allowlist)
  let model: string | undefined;
  if (payload.model !== undefined) {
    const modelValidation = validateModelId(payload.model, allowedModels);
    if (!modelValidation.valid) {
      errors.push(modelValidation.error!);
    } else {
      model = modelValidation.sanitized;
    }
  }

  // Validate system prompt (optional)
  let systemPrompt: string | undefined;
  if (payload.systemPrompt !== undefined) {
    const systemPromptValidation = validateString(payload.systemPrompt, 'systemPrompt', MAX_LENGTHS.SYSTEM_PROMPT, false);
    if (!systemPromptValidation.valid) {
      errors.push(systemPromptValidation.error!);
    } else {
      systemPrompt = systemPromptValidation.sanitized;
    }
  }

  // Validate conversation history (optional)
  let conversationHistory: Array<ConversationMessage> | undefined;
  if (payload.conversationHistory !== undefined) {
    const historyValidation = validateConversationHistory(payload.conversationHistory);
    if (!historyValidation.valid) {
      errors.push(historyValidation.error!);
    } else {
      conversationHistory = historyValidation.sanitized;
    }
  }

  // Validate image (optional)
  let image: string | undefined;
  if (payload.image !== undefined) {
    const imageValidation = validateImage(payload.image);
    if (!imageValidation.valid) {
      errors.push(imageValidation.error!);
    } else {
      image = imageValidation.sanitized;
    }
  }

  // Validate runParallel (optional boolean)
  let runParallel: boolean | undefined;
  if (payload.runParallel !== undefined) {
    if (typeof payload.runParallel !== 'boolean') {
      errors.push('runParallel must be a boolean');
    } else {
      runParallel = payload.runParallel;
    }
  }

  // Validate outputLength (optional enum)
  let outputLength: 'small' | 'medium' | 'large' | undefined;
  if (payload.outputLength !== undefined) {
    const outputLengthValue = payload.outputLength;
    if (typeof outputLengthValue !== 'string' || !['small', 'medium', 'large'].includes(outputLengthValue)) {
      errors.push('outputLength must be one of: small, medium, large');
    } else {
      outputLength = outputLengthValue as 'small' | 'medium' | 'large';
    }
  }

  // Validate parallelModel1 (optional, only when runParallel is true)
  let parallelModel1: string | undefined;
  if (payload.parallelModel1 !== undefined) {
    const model1Validation = validateModelId(payload.parallelModel1, allowedModels);
    if (!model1Validation.valid) {
      errors.push(`parallelModel1: ${model1Validation.error}`);
    } else {
      parallelModel1 = model1Validation.sanitized;
    }
  }

  // Validate parallelModel2 (optional, only when runParallel is true)
  let parallelModel2: string | undefined;
  if (payload.parallelModel2 !== undefined) {
    const model2Validation = validateModelId(payload.parallelModel2, allowedModels);
    if (!model2Validation.valid) {
      errors.push(`parallelModel2: ${model2Validation.error}`);
    } else {
      parallelModel2 = model2Validation.sanitized;
    }
  }

  // Reject unexpected fields (prevent mass assignment)
  const allowedFields = ['query', 'model', 'systemPrompt', 'conversationHistory', 'image', 'runParallel', 'outputLength', 'parallelModel1', 'parallelModel2'];
  const unexpectedFields = Object.keys(payload).filter(key => !allowedFields.includes(key));
  if (unexpectedFields.length > 0) {
    errors.push(`Unexpected fields: ${unexpectedFields.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      query: queryValidation.sanitized!,
      model,
      systemPrompt,
      conversationHistory,
      image,
      runParallel,
      outputLength,
      parallelModel1,
      parallelModel2,
    },
  };
}

/**
 * Validate tracking request payload
 */
export function validateTrackingRequest(
  payload: Record<string, unknown>
): { valid: boolean; errors: string[]; sanitized?: { visitorId?: string; fingerprint?: string } } {
  const errors: string[] = [];

  // Validate visitorId (optional)
  let visitorId: string | undefined;
  if (payload.visitorId !== undefined) {
    const visitorIdValidation = validateString(payload.visitorId, 'visitorId', MAX_LENGTHS.VISITOR_ID, false);
    if (!visitorIdValidation.valid) {
      errors.push(visitorIdValidation.error!);
    } else {
      visitorId = visitorIdValidation.sanitized;
    }
  }

  // Validate fingerprint (optional)
  let fingerprint: string | undefined;
  if (payload.fingerprint !== undefined) {
    const fingerprintValidation = validateString(payload.fingerprint, 'fingerprint', MAX_LENGTHS.FINGERPRINT, false);
    if (!fingerprintValidation.valid) {
      errors.push(fingerprintValidation.error!);
    } else {
      fingerprint = fingerprintValidation.sanitized;
    }
  }

  // Reject unexpected fields
  const allowedFields = ['visitorId', 'fingerprint'];
  const unexpectedFields = Object.keys(payload).filter(key => !allowedFields.includes(key));
  if (unexpectedFields.length > 0) {
    errors.push(`Unexpected fields: ${unexpectedFields.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      visitorId,
      fingerprint,
    },
  };
}

/**
 * Fields produced by validateFeedbackRequest once a payload has passed
 * validation.
 */
interface SanitizedFeedbackRequest {
  rating: 'up' | 'down';
  modelId: string;
}

/**
 * Validate message feedback (thumbs up/down) request payload.
 * Deliberately narrow: only a rating and a model identifier are accepted -
 * no message content, excerpt, or visitor-identifying data.
 */
export function validateFeedbackRequest(
  payload: Record<string, unknown>
): { valid: boolean; errors: string[]; sanitized?: SanitizedFeedbackRequest } {
  const errors: string[] = [];

  const ratingValue = payload.rating;
  if (ratingValue !== 'up' && ratingValue !== 'down') {
    errors.push('rating must be "up" or "down"');
  }

  const modelIdValidation = validateString(payload.modelId, 'modelId', MAX_LENGTHS.MODEL_ID, true);
  if (!modelIdValidation.valid) {
    errors.push(modelIdValidation.error!);
  }

  // Reject unexpected fields (prevent mass assignment / accidental content leakage)
  const allowedFields = ['rating', 'modelId'];
  const unexpectedFields = Object.keys(payload).filter(key => !allowedFields.includes(key));
  if (unexpectedFields.length > 0) {
    errors.push(`Unexpected fields: ${unexpectedFields.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      rating: ratingValue as 'up' | 'down',
      modelId: modelIdValidation.sanitized!,
    },
  };
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(errors: string[]): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      errors,
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Validate request body size
 */
export function validateBodySize(
  contentLength: string | null,
  maxSizeBytes: number
): string[] {
  const errors: string[] = [];

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size) || size > maxSizeBytes) {
      errors.push(`Request body too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
    }
  }

  return errors;
}
