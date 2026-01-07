import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date();
  
  return NextResponse.json({
    time: now.toLocaleTimeString('en-US', { hour12: false }),
    date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    iso: now.toISOString(),
    timestamp: now.getTime()
  });
}

