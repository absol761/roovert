// roovert/app/api/visit/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST() {
  try {
    // If KV is connected, increment real counter
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const count = await kv.incr('unique_visitors');
      return NextResponse.json({ success: true, count });
    }
    
    // Fallback if no KV (silent success)
    return NextResponse.json({ success: true, mode: 'simulation' });
  } catch (error) {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

