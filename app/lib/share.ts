// Storage for shared, read-only conversation links.
// Same KV-primary/SQLite-fallback pattern as app/api/track/route.ts: Vercel
// KV is used when configured (production/serverless, where SQLite can't
// write to disk), falling back to the local SQLite db (app/lib/db.ts) for
// local dev. Ids are crypto.randomUUID() - unguessable and non-enumerable,
// since these are publicly readable once created.
import { kv } from '@vercel/kv';
import { getDatabase } from './db';
import type { ConversationMessage } from './security/validation';

// How long a shared link stays alive before expiring - a share link is meant
// to be a temporary "here's what I asked" link, not permanent public
// storage. 60 days sits in the middle of the 30-90 day range that's
// reasonable for this.
export const SHARE_TTL_SECONDS = 60 * 24 * 60 * 60;

export interface SharedConversation {
  messages: ConversationMessage[];
  createdAt: number;
}

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function kvKey(id: string): string {
  return `share:${id}`;
}

/**
 * Persist a shared conversation. Throws if both KV (when configured) and the
 * SQLite fallback fail, so the route can report a real error to the caller
 * instead of silently pretending the link exists.
 */
export async function saveSharedConversation(id: string, messages: ConversationMessage[]): Promise<void> {
  const now = Date.now();
  const payload: SharedConversation = { messages, createdAt: now };

  if (isKvConfigured()) {
    try {
      await kv.set(kvKey(id), JSON.stringify(payload), { ex: SHARE_TTL_SECONDS });
      return;
    } catch (kvError) {
      console.error('KV share write error:', kvError);
      // Fall through to SQLite fallback below.
    }
  }

  const db = getDatabase();
  const expiresAt = now + SHARE_TTL_SECONDS * 1000;
  db.prepare(
    'INSERT OR REPLACE INTO shared_conversations (id, content, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(id, JSON.stringify(payload), now, expiresAt);
}

/**
 * Look up a shared conversation by id. Returns null if it doesn't exist,
 * has expired, or storage is unavailable - callers should treat all of
 * these as "not found" (404), never leak the distinction to the public.
 */
export async function getSharedConversation(id: string): Promise<SharedConversation | null> {
  if (isKvConfigured()) {
    try {
      const raw = await kv.get<string>(kvKey(id));
      if (!raw) return null;
      // @vercel/kv may already deserialize JSON-looking strings for us
      // depending on version/config, so accept either shape.
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed as SharedConversation;
    } catch (kvError) {
      console.error('KV share read error:', kvError);
      return null;
    }
  }

  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT content, expires_at FROM shared_conversations WHERE id = ?')
      .get(id) as { content: string; expires_at: number } | undefined;

    if (!row) return null;

    if (row.expires_at < Date.now()) {
      // Lazily clean up expired rows on read rather than running a
      // background sweep - matches the "no over-engineering" guidance,
      // this is the only place expiry is ever checked anyway.
      db.prepare('DELETE FROM shared_conversations WHERE id = ?').run(id);
      return null;
    }

    return JSON.parse(row.content) as SharedConversation;
  } catch (dbError) {
    console.error('SQLite share read error:', dbError);
    return null;
  }
}
