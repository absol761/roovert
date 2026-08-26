/**
 * Small brand mark for the assistant's identity, replacing a generic
 * Sparkles icon wherever a response needs an avatar glyph. Deliberately
 * distinct from the lucide icon set used everywhere else in the app - like
 * Claude.ai's own sunburst mark, the assistant's turns get a real logo
 * rather than a generic "AI" icon, so it reads as an identity, not a
 * decoration. Ties back to the serif wordmark ("Roovert") used in the
 * sidebar/landing hero via the same font token.
 */
export function RoovertMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="18.5" height="18.5" rx="6" fill="currentColor" fillOpacity="0.12" />
      <rect x="0.75" y="0.75" width="18.5" height="18.5" rx="6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" fill="none" />
      <text
        x="10"
        y="14.25"
        textAnchor="middle"
        fontFamily="var(--font-serif), Georgia, serif"
        fontSize="10.5"
        fontWeight="600"
        fill="currentColor"
      >
        R
      </text>
    </svg>
  );
}
