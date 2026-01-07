// roovert/app/api/crypto/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Using CoinGecko (Free tier)
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
      { headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) throw new Error('Crypto fetch failed');
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch crypto' }, { status: 500 });
  }
}

