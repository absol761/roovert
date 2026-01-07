// roovert/app/api/visit/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { visitorId, fingerprint } = body;

    if (!visitorId) {
      return NextResponse.json({ error: 'Visitor ID required' }, { status: 400 });
    }

    // If KV is connected, track unique visitors properly
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        // Check if this visitor ID has been seen before
        const seenKey = `visitor:${visitorId}`;
        const isNew = await kv.set(seenKey, '1', { ex: 86400 * 365, nx: true }); // Expire after 1 year, only set if not exists

        if (isNew === 'OK' || isNew === 1) {
          // New visitor - increment counter
          const count = await kv.incr('unique_visitors');
          
          // Also store fingerprint for deduplication
          if (fingerprint) {
            const fpKey = `fp:${fingerprint}`;
            await kv.set(fpKey, visitorId, { ex: 86400 * 365 });
          }

          return NextResponse.json({ success: true, count, isNew: true });
        } else {
          // Returning visitor - just return current count
          const count = await kv.get('unique_visitors') || 0;
          return NextResponse.json({ success: true, count: Number(count), isNew: false });
        }
      } catch (kvError) {
        console.error('KV Error:', kvError);
        // Fall through to fallback
      }
    }
    
    // Fallback if no KV (silent success)
    return NextResponse.json({ success: true, mode: 'simulation' });
  } catch (error) {
    console.error('Visit tracking error:', error);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

