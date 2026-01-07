import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate real-time stats (replace with actual data source)
  const stats = {
    queriesProcessed: Math.floor(Math.random() * 1000000) + 500000,
    activeUsers: Math.floor(Math.random() * 10000) + 5000,
    accuracy: (95 + Math.random() * 4).toFixed(2),
    uptime: '99.9%',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(stats);
}

