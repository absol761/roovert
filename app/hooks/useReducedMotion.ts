'use client';

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

// Thin re-export of framer-motion's own hook, kept as a project-local import
// so call sites read as "this app's reduced-motion signal" rather than a
// framer-motion implementation detail, and so it's the one place that would
// need to change if the underlying library ever did.
//
// This exists specifically to catch what the CSS `prefers-reduced-motion`
// media query in globals.css cannot: framer-motion's spring/keyframe
// animations write directly to inline styles via JS on every animation
// frame rather than going through CSS `transition`/`animation` properties,
// so the blanket CSS rule (which only zeroes `transition-duration` /
// `animation-duration`) never touches them. Continuous or large-motion
// framer-motion animations should check this and drop to an instant/no-op
// transition when it's true.
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}
