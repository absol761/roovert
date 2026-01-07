// roovert/app/api/weather/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat') || '40.71'; // Default NYC
    const long = searchParams.get('long') || '-74.01';

    // Using Open-Meteo (Free, No Key)
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`
    );

    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();

    return NextResponse.json({
      temp: data.current.temperature_2m,
      wind: data.current.wind_speed_10m,
      unit: data.current_units.temperature_2m
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}

