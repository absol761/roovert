import type { MetadataRoute } from "next";

// Next.js's typed robots file convention: this is discovered automatically
// and served at /robots.txt with the correct content-type - no layout.tsx
// changes needed.
//
// Canonical production URL per README.md ("Website: https://roovert.com").
const BASE_URL = "https://roovert.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/api/admin/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
