import { ImageResponse } from "next/og";

// Next.js's Open Graph image file convention: this file is discovered
// automatically and Next.js injects the correct <meta property="og:image">
// tags into <head> with zero manual wiring. See ./twitter-image.tsx, which
// reuses the same render function for the Twitter/X card.

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt = "Roovert: Rigorously Pursuing Truth";

// Shared render logic reused by twitter-image.tsx. Colors mirror the app's
// default (midnight/"Ember") theme from app/globals.css: warm charcoal
// background, terracotta accent, warm off-white foreground.
export function renderShareImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1c1917",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 84,
              height: 84,
              borderRadius: 20,
              backgroundColor: "#c1653d",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: -2,
              color: "#f5f1ea",
            }}
          >
            ROOVERT
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 34,
            color: "#c1653d",
            fontWeight: 600,
          }}
        >
          Query multiple AI models at once
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 24,
            color: "rgba(245, 241, 234, 0.62)",
          }}
        >
          Rigorously Pursuing Truth. An AI Engine of Truth.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

export default function Image() {
  return renderShareImage();
}
