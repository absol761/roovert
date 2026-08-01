// Create a public, read-only share link for a conversation. Accepts the
// same conversation-history shape query-gateway validates
// (validateConversationHistory), stores it keyed by an unguessable
// crypto.randomUUID() (see app/lib/share.ts for the KV/SQLite storage), and
// returns a shareable /share/{id} path.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { applyRateLimit } from '../../lib/security/rateLimit';
import {
  validateConversationHistory,
  validateBodySize,
  createValidationErrorResponse,
  type ConversationMessage,
  type MessageContentItem,
} from '../../lib/security/validation';
import { containsOffensiveContent } from '../../lib/prompts';
import { saveSharedConversation } from '../../lib/share';

// better-sqlite3 (the local storage fallback) isn't Edge-compatible.
export const runtime = 'nodejs';

function messageTextParts(message: ConversationMessage): string[] {
  if (typeof message.content === 'string') {
    return [message.content];
  }
  return message.content
    .filter((item): item is Extract<MessageContentItem, { type: 'text' }> => item.type === 'text')
    .map((item) => item.text);
}

export async function POST(request: NextRequest) {
  try {
    // Security: rate limiting - creating share links writes publicly
    // readable content, so this is throttled before anything else runs.
    const rateLimitResponse = await applyRateLimit(request, 'share');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Security: validate request body size before parsing.
    const contentLength = request.headers.get('content-length');
    const bodySizeErrors = validateBodySize(contentLength, 2 * 1024 * 1024); // 2MB max
    if (bodySizeErrors.length > 0) {
      return createValidationErrorResponse(bodySizeErrors);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return createValidationErrorResponse(['Invalid JSON payload']);
    }

    // Security: reject unexpected fields (prevent mass assignment).
    const allowedFields = ['conversationHistory'];
    const unexpectedFields = Object.keys(payload).filter((key) => !allowedFields.includes(key));
    if (unexpectedFields.length > 0) {
      return createValidationErrorResponse([`Unexpected fields: ${unexpectedFields.join(', ')}`]);
    }

    // Security: strict schema validation, same helper query-gateway uses.
    const historyValidation = validateConversationHistory(payload.conversationHistory);
    if (!historyValidation.valid) {
      return createValidationErrorResponse([historyValidation.error!]);
    }

    const messages = historyValidation.sanitized!;
    if (messages.length === 0) {
      return createValidationErrorResponse(['conversationHistory cannot be empty']);
    }

    // Security: content moderation - a share link republishes content
    // publicly and unauthenticated, so nothing offensive gets stored.
    for (let i = 0; i < messages.length; i++) {
      for (const text of messageTextParts(messages[i])) {
        if (containsOffensiveContent(text).isOffensive) {
          return createValidationErrorResponse(['Conversation contains content that cannot be shared']);
        }
      }
    }

    // Security: unguessable, non-enumerable id - never an incrementing int.
    const id = randomUUID();

    await saveSharedConversation(id, messages);

    return NextResponse.json({ success: true, id, url: `/share/${id}` });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
