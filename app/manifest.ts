import type { MetadataRoute } from "next";

// Next.js's typed manifest file convention: this is discovered automatically
// and served at /manifest.webmanifest with the correct content-type, and a
// <link rel="manifest"> tag is injected into <head> automatically - no
// layout.tsx changes needed.
//
// Colors mirror the app's actual default (midnight/"Ember") theme from
// app/globals.css :root - see the comment there explaining why the first
// paint always uses these values before client-side theme switching kicks in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roovert",
    short_name: "Roovert",
    description: "Rigorously Pursuing Truth. An AI Engine of Truth.",
    start_url: "/",
    display: "standalone",
    background_color: "#1c1917",
    theme_color: "#1c1917",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
