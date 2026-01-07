import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate real-time stats (replace with actual data source)
  // Base numbers that grow slightly over time
  const baseQueries = 1250000;
  const timeComponent = new Date().getMinutes() * 100; // Adds slow growth
  const randomComponent = Math.floor(Math.random() * 50);
  
  const stats = {
    queriesProcessed: baseQueries + timeComponent + randomComponent,
    activeUsers: Math.floor(Math.random() * 300) + 8500,
    accuracy: (99.1 + Math.random() * 0.8).toFixed(2),
    uptime: '99.99%',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(stats);
}

