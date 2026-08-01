// Shared Framer Motion timing constants so components don't each invent
// their own one-off duration/easing values. These mirror the CSS custom
// properties in globals.css (--duration-base / --ease-out) so JS-driven
// and CSS-driven transitions read as the same restrained, no-overshoot
// motion language throughout the app.
//
// Framer Motion can't read CSS custom properties directly, so the values
// are duplicated here deliberately - keep this in sync with globals.css.

// Matches --ease-out: cubic-bezier(0.16, 1, 0.3, 1)
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Matches --duration-base: 250ms
export const DURATION_BASE = 0.25;

// A single tween used by overlay/modal enter-exit so every modal in the app
// animates with the same duration and curve instead of drifting between
// framer's built-in 'easeOut' string, ad-hoc numbers, or (if a `transition`
// prop is omitted entirely) framer's spring default, which overshoots.
export const MODAL_TRANSITION = { duration: DURATION_BASE, ease: EASE_OUT };
