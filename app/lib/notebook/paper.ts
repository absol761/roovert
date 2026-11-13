// Notebook paper styles — reMarkable-inspired paper textures for the Notebook
// feature. Deliberately standalone from app/lib/looks.ts (see
// docs/design/NOTEBOOK_FEATURE_SPEC.md §7a): paper choice is a local,
// per-note concept applied via [data-notebook-paper] on the Notebook's own
// root element, never documentElement, so it never fights the app-wide
// Looks system.
export const PAPER_STYLES = [
  { id: 'white', name: 'White', description: 'Warm eggshell paper with near-black ink' },
  { id: 'black', name: 'Black', description: 'Warm near-black paper with a muted metallic gold pen' },
  { id: 'construction', name: 'Construction', description: 'Matte slate-blue construction paper with a warm amber-orange grease pencil accent' },
];

export const DEFAULT_PAPER_STYLE_ID = 'white';
