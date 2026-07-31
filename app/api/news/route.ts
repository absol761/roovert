// roovert/app/api/news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, incrementRateLimit } from '../../lib/security/rateLimit';

export async function GET(request: NextRequest) {
  // Security: Rate limiting - this fans out to 4 external fetches per
  // request (1 index + 3 story lookups), so an unrated endpoint here is an
  // amplification vector, not just a mild cost concern.
  const rateLimitResponse = await applyRateLimit(request, 'stats');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Fetch Tech/AI News from a public RSS-to-JSON service or free API
    // Using a reliable Hacker News or similar tech feed for "Truth" context
    const res = await fetch(
      'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty'
    );

    if (!res.ok) throw new Error('News fetch failed');

    const ids = await res.json();
    const top5Ids = ids.slice(0, 3); // Get top 3 stories

    const stories = await Promise.all(
      top5Ids.map(async (id: number) => {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`);
        return storyRes.json();
      })
    );

    await incrementRateLimit(request, 'stats');
    return NextResponse.json(stories);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
