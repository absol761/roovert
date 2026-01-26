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
 * Validate conversation history array
 */
export function validateConversationHistory(
  history: unknown
): { valid: boolean; error?: string; sanitized?: Array<{ role: string; content: string | Array<any> }> } {
  if (!Array.isArray(history)) {
    return { valid: false, error: 'Conversation history must be an array' };
  }
  
  if (history.length > MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES) {
    return { valid: false, error: `Conversation history cannot exceed ${MAX_LENGTHS.CONVERSATION_HISTORY_MESSAGES} messages` };
  }
  
  const sanitized: Array<{ role: string; content: string | Array<any> }> = [];
  
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: `Message ${i} is invalid` };
    }
    
    const role = msg.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      return { valid: false, error: `Message ${i} has invalid role: ${role}` };
    }
    
    const content = msg.content;
    if (typeof content === 'string') {
      const contentValidation = validateString(content, 'message content', MAX_LENGTHS.MESSAGE_CONTENT, true);
      if (!contentValidation.valid) {
        return { valid: false, error: `Message ${i} content: ${contentValidation.error}` };
      }
      sanitized.push({ role, content: contentValidation.sanitized! });
    } else if (Array.isArray(content)) {
      // Multimodal content (text + image)
      const validatedContent: Array<any> = [];
      for (const item of content) {
        if (item.type === 'text' && typeof item.text === 'string') {
          const textValidation = validateString(item.text, 'text content', MAX_LENGTHS.MESSAGE_CONTENT, true);
          if (!textValidation.valid) {
            return { valid: false, error: `Message ${i} text content: ${textValidation.error}` };
          }
          validatedContent.push({ type: 'text', text: textValidation.sanitized! });
        } else if (item.type === 'image_url' && typeof item.image_url === 'object' && typeof item.image_url.url === 'string') {
          // Validate image URL (base64 or http/https)
          const urlValidation = validateString(item.image_url.url, 'image URL', MAX_LENGTHS.IMAGE_BASE64, true);
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
 * Validate AI query request payload
 */
export function validateAIQueryRequest(
  payload: any,
  allowedModels: Set<string>
): { valid: boolean; errors: string[]; sanitized?: any } {
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
  let conversationHistory: Array<any> | undefined;
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
  
  // Reject unexpected fields (prevent mass assignment)
  const allowedFields = ['query', 'model', 'systemPrompt', 'conversationHistory', 'image'];
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
    },
  };
}

/**
 * Validate tracking request payload
 */
export function validateTrackingRequest(
  payload: any
): { valid: boolean; errors: string[]; sanitized?: any } {
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
