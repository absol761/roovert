// Read a shared conversation by id. Public and unauthenticated by design
// (that's the point of a share link) but still rate-limited to deter
// scraping/abuse, same as every other endpoint in this codebase.
import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '../../../lib/security/rateLimit';
import { getSharedConversation } from '../../../lib/share';

// better-sqlite3 (the local storage fallback) isn't Edge-compatible.
export const runtime = 'nodejs';

// crypto.randomUUID() shape - reject anything else before even attempting a
// lookup, so junk/scanning traffic doesn't reach storage.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Security: rate limiting - prevents scraping every share id in a loop.
    const rateLimitResponse = await applyRateLimit(request, 'share-read');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id } = await params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const conversation = await getSharedConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
    });
  } catch (error) {
    console.error('Share fetch error:', error);
    return NextResponse.json({ error: 'Failed to load shared conversation' }, { status: 500 });
  }
}
