import type { MetadataRoute } from "next";

// Next.js's typed sitemap file convention: this is discovered automatically
// and served at /sitemap.xml with the correct content-type - no layout.tsx
// changes needed.
//
// Canonical production URL per README.md ("Website: https://roovert.com")
// and the fallback used throughout the codebase (e.g. app/api/openrouter/route.ts).
const BASE_URL = "https://roovert.com";

// A fixed build-time date is fine here - we don't read git history for this.
const LAST_MODIFIED = new Date("2026-07-29");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/careers`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
