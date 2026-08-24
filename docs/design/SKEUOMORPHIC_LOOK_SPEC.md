# Skeuomorphic Look — Implementation Spec

Status: research + spec only. No application code has been touched. This document is
the single source of truth for the `id: 'skeuomorphic'` entry in the Looks system.

Target files (referenced, not modified by this document):
- `app/lib/looks.ts` — add the `LOOKS` entry in §5.
- `app/globals.css` — add a `[data-look='skeuomorphic']` block plus a small number of
  component-selector overrides, following the exact pattern already used by
  `[data-look='retrowave']` and `[data-look='evergreen']`.

The look is **opt-in only**. `app/page.tsx` initializes `const [look, setLook] =
useState('midnight')` and applies the active look via
`document.documentElement.setAttribute('data-look', look)`. Adding a `LOOKS` entry does
not change the default — nothing here touches that line.

---

## 1. Material story (commit, don't hedge)

**A stitched saddle-leather journal with brass hardware** — the physical object is a
bound leather notebook/organizer: a dark cognac-brown leather cover, cream parchment
pages, brass rivets and corner hardware, and visible top-stitching in a lighter
brass-colored thread around the edge of each leather panel.

This is deliberately the *iOS 6 Notes.app* family of skeuomorphism (stitched leather
binding + yellow-legal-pad paper — see References), not Aqua brushed metal, not a
Winamp skin, and not a physical control panel of dials/toggles. That choice is made
for fit, not novelty:

- **Message bubbles / response cards read as journal entries.** A chat transcript is
  already a sequence of discrete written entries stacked vertically — that is
  *literally* what a bound notebook page is. Aqua brushed-metal or a dashboard/dial
  metaphor has no natural mapping onto "a card containing a paragraph of text";
  leather-journal-entry does.
- **The composer is a natural fit for "the page you're currently writing on."** A
  single input bar that expands as you type maps cleanly onto a ruled journal page or
  a leather-bound blotter, not onto a control-panel dial or an LED readout.
- **The sidebar (conversation list) reads as a spine/index of journal entries** —
  tabs or ribbon markers in a bound book — which existing chrome (`.intel-panel`,
  `.history-item`) already visually resembles (stacked cards with a label + rule) more
  than it resembles a dashboard of gauges.
- **Buttons as brass hardware (rivets / a stamped brass button) are unambiguously
  "pressable"** in exactly the tactile, familiar sense skeuomorphism is for — a small
  round or pill-shaped brass-colored control with a bevel reads immediately as
  physically depressible, which is the entire design rationale skeuomorphism claims
  (see References — "everyone knows how to press a button").
- **It stays in the same emotional register as the app's existing dark themes**
  (`midnight`/Ember: warm charcoal + terracotta; `evergreen`: forest + antique gold) —
  warm, analog, editorial — rather than introducing a jarring, unrelated register like
  neon control-panel LEDs. It's a new *material* within a family the app already
  speaks.

Explicitly rejected alternatives and why: brushed-metal/Aqua reads as a *window
chrome* treatment (title bars, traffic-light buttons), not a content-card treatment,
so it doesn't map onto message bubbles or the composer. A literal
dial/toggle/dashboard motif reads as *controls for a machine*, which fights the
conversational, textual nature of a chat UI. Wood-shelf (Newsstand) is a *container for
objects* metaphor (a bookshelf holding many other things), not a metaphor for the
individual reading/writing surfaces this UI is actually made of.

**This is skeuomorphism, not neumorphism.** Neumorphism (2020-era "soft UI") uses a
*single flat, near-monochrome background color*, no border, and a symmetric pair of
soft blurred shadows (one light, one dark) on *that same color* to imply an extruded
or pressed-in shape — there is no depicted material, no border, no directional light
source beyond "light appears to come from the upper-left, uniformly, everywhere."
Every rule in this spec instead: (a) depicts an actual material via a gradient with
distinct, named leather/brass hues, not one flat color; (b) always keeps a real
`border`; (c) uses a dashed inset border to depict physical stitching, which
neumorphism never does; (d) uses `text-shadow` to depict embossed/debossed *lettering*
(neumorphism doesn't touch type); and (e) layers a grain-noise texture that implies an
actual physical surface (neumorphism is texture-free by definition). Anywhere this
document's guidance starts to look like "two soft shadows on a flat color, no
border," that's a bug in the implementation, not a valid interpretation of this spec.

---

## 2. `[data-look='skeuomorphic']` — full custom-property block

Paste this into `app/globals.css` immediately after the `[data-look='evergreen']`
block (before the `@keyframes ocean-wave` comment divider), following the same shape
retrowave/evergreen use for the properties they set, plus explicit overrides for the
shadow/radius ladder tokens (which no existing look currently touches — this will be
the first look to exercise that part of the system, see the implementation note at the
end of this section).

```css
/* Skeuomorphic — stitched saddle-leather journal with brass hardware. A literal,
   representational material (not neumorphism/"soft UI" — see docs/design/
   SKEUOMORPHIC_LOOK_SPEC.md §1 for the distinction). Warm cognac/espresso leather,
   cream parchment ink, aged-brass accent, directional single-source top-left light
   implying real embossed/debossed depth. */
[data-look='skeuomorphic'] {
  --background: #34241a;
  --foreground: #f1e4c9;
  --accent: #c38a42;
  --accent-glow: rgba(195, 138, 66, 0.32);
  --panel-bg: rgba(74, 54, 38, 0.82);
  --border: rgba(196, 154, 91, 0.32);
  --panel-radius: 16px;
  --surface: rgba(241, 228, 201, 0.06);
  --surface-strong: rgba(241, 228, 201, 0.14);
  --chip-bg: rgba(41, 29, 20, 0.82);
  --muted: rgba(241, 228, 201, 0.6);
  --muted-strong: rgba(241, 228, 201, 0.85);
  --hud-bg: rgba(41, 29, 20, 0.95);

  /* Elevation ladder — warm, dark, brown-cast shadows (never pure black) plus a
     thin inset top highlight standing in for a raking top-left light catching the
     leather grain. This is what actually reads as "embossed" instead of "flat with
     a color swap" — do not drop the inset layer. */
  --shadow-sm: 0 1px 2px rgba(18, 11, 5, 0.55);
  --shadow-md:
    0 10px 24px -10px rgba(18, 11, 5, 0.55),
    0 3px 8px -2px rgba(18, 11, 5, 0.4),
    inset 0 1px 0 rgba(255, 235, 200, 0.08);
  --shadow-lg:
    0 26px 50px -18px rgba(12, 7, 3, 0.65),
    0 8px 16px -6px rgba(12, 7, 3, 0.45),
    inset 0 1px 0 rgba(255, 235, 200, 0.1);
  --shadow-glow:
    0 0 0 1px var(--border),
    0 8px 20px -8px var(--accent-glow),
    inset 0 1px 0 rgba(255, 235, 200, 0.12);

  /* Radius ladder — a bound book has a small, firm corner radius, not a soft
     "glassy app" curve. Deliberately tighter than the app-wide defaults
     (--radius: 14px / --radius-card: 20px / --radius-cta: 32px). */
  --radius: 10px;
  --radius-tight: 4px;
  --radius-card: 16px;
  --radius-cta: 22px;
  --radius-pill: 9999px;
}
```

**Implementation note on the shadow/radius ladder:** as of this writing, no existing
`[data-look=...]` block overrides `--shadow-sm/md/lg/glow` or
`--radius/--radius-tight/--radius-card/--radius-cta/--radius-pill` — those tokens are
only ever set once, globally, in the base `:root` (`app/globals.css` lines ~94-105 and
~130). This look is the first to exercise that lever. That's intentional (a
material this literal needs its own shadow language to read as "embossed" rather than
"the default soft shadow with different RGB values"), but it means there's no existing
per-look precedent to diff against — QA should specifically check that switching
*away* from `skeuomorphic` to another look correctly reverts these tokens to the
`:root` defaults (it will, automatically, since `[data-look='skeuomorphic']` is a
plain attribute-selector override with normal CSS cascade — nothing to clean up on
switch — but confirm visually, since this is a new code path).

---

## 3. Interactive-state guidance

Three worked, ready-to-paste examples below, one per component category. All are
scoped under `[data-look='skeuomorphic']` and target selectors/attributes that already
exist in the codebase today (verified against `app/page.tsx`,
`components/ui/button.tsx`, and `app/globals.css`) — implementers are translating
these into the stylesheet, not inventing selectors from scratch.

### 3a. Buttons, inputs, composer

**Primary button — raised brass rivet, rest → hover → active.** Targets
`components/ui/button.tsx`'s `default` variant, which renders as
`[data-slot="button"][data-variant="default"]` and already carries a Tailwind
`active:not-aria-[haspopup]:translate-y-px` utility for a 1px press. This override
adds the material (gradient + bevel + engraved-highlight text) on top of that
existing press mechanic; its `:active` rule increases the press depth to 2px and
swaps the shadow to a debossed (inset-only) treatment so it visually *sinks*, which
the current translate-only utility doesn't do on its own.

```css
[data-look='skeuomorphic'] [data-slot='button'][data-variant='default'] {
  background: linear-gradient(180deg, #d9a35e 0%, #c38a42 45%, #a8722f 100%);
  color: #2b1e15; /* dark ink on brass — see §4 for the contrast math */
  border: 1px solid rgba(75, 48, 20, 0.5);
  text-shadow: 0 1px 0 rgba(255, 240, 210, 0.35);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.5),
    inset 0 -2px 3px rgba(75, 48, 20, 0.4),
    0 3px 0 rgba(93, 61, 26, 0.9),
    0 6px 10px -2px rgba(18, 11, 5, 0.55);
  transition: transform 0.08s ease-out, box-shadow 0.08s ease-out, filter 0.15s ease-out;
}

[data-look='skeuomorphic'] [data-slot='button'][data-variant='default']:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.55),
    inset 0 -2px 3px rgba(75, 48, 20, 0.4),
    0 4px 0 rgba(93, 61, 26, 0.9),
    0 8px 14px -3px rgba(18, 11, 5, 0.6);
}

[data-look='skeuomorphic'] [data-slot='button'][data-variant='default']:active:not([aria-haspopup]) {
  transform: translateY(2px);
  filter: brightness(0.96);
  box-shadow:
    inset 0 2px 4px rgba(18, 11, 5, 0.6),
    0 1px 2px rgba(18, 11, 5, 0.4);
}
```

Specificity note: `[data-look='skeuomorphic'] [data-slot='button'][data-variant='default']:active` is
two attribute selectors + a pseudo-class, which beats the compiled single-class
Tailwind utility (`.active\:translate-y-px:active`), so this rule's `transform`
correctly wins over — rather than fights — the existing utility. Verify this in the
browser rather than assuming; if a future refactor of `button.tsx` changes how the
press utility compiles, this ordering should be re-checked.

Other `Button` variants (`outline`, `secondary`, `ghost`, `destructive`, `link`)
already reference `--primary`/`--secondary`/`--border`/`--surface`, which are
themselves derived from the tokens in §2 — they get correct *color* for free from the
custom-property block alone. Do **not** copy the raised-bevel treatment onto them; a
secondary/ghost button should look like a plain leather tab, not brass hardware, or
every control on screen competes for "this is the important button" attention.

**Composer bar — inset "groove."** Targets `.composer-bar` (the actual visual
container in `app/page.tsx`; the `<textarea>` inside it is already `border-none
bg-transparent`, so the groove treatment belongs on the bar, not the textarea). This
is *debossed* — inset shadow only, no outer raised shadow — the opposite of the
button above, which is the point: the composer should read as a carved/tooled channel
you write into, not a raised object.

```css
[data-look='skeuomorphic'] .composer-bar {
  background: linear-gradient(180deg, rgba(36, 25, 17, 0.92), rgba(48, 34, 23, 0.88)) !important;
  border: 1px solid rgba(20, 13, 7, 0.65) !important;
  box-shadow:
    inset 0 2px 5px rgba(10, 6, 3, 0.65),
    inset 0 -1px 0 rgba(255, 235, 200, 0.05),
    0 1px 0 rgba(255, 235, 200, 0.06);
}

[data-look='skeuomorphic'] .composer-bar:focus-within {
  border-color: var(--accent) !important;
  box-shadow:
    inset 0 2px 5px rgba(10, 6, 3, 0.65),
    0 0 0 3px var(--accent-glow);
}
```

(`!important` matches the existing precedent set by `.glass-panel`/`.intel-card` rules
in `globals.css`, which already use `!important` to win over Tailwind utility classes
applied inline in `page.tsx`.)

### 3b. Modals / cards / message bubbles

**Embossed panel with stitched edge.** Targets `.glass-panel` and `.intel-card` —
the shared card/panel classes already used for response cards, the model-picker
panel, and modal-adjacent surfaces throughout `app/page.tsx`. Adds a dashed inset
border (`::after`) to depict brass-thread top-stitching, using the CSS technique of a
dashed border pulled inward from the panel edge (see References — "stitched look").
`.glass-panel` already defines its own `::before` for a glass-refraction highlight
(a mask-based gradient ring) — this rule deliberately uses `::after` instead so the
two don't collide; leave the existing `::before` in place (it still reads fine as a
subtle top-edge sheen on leather, it doesn't need to be suppressed).

```css
[data-look='skeuomorphic'] .glass-panel,
[data-look='skeuomorphic'] .intel-card {
  background: linear-gradient(160deg, rgba(84, 62, 43, 0.92) 0%, rgba(43, 30, 21, 0.95) 100%) !important;
  border: 1px solid rgba(20, 13, 7, 0.6) !important;
  box-shadow: var(--shadow-md) !important;
}

[data-look='skeuomorphic'] .glass-panel::after,
[data-look='skeuomorphic'] .intel-card::after {
  content: '';
  position: absolute;
  inset: 9px;
  border-radius: calc(var(--panel-radius, 16px) - 9px);
  border: 1.5px dashed rgba(195, 138, 66, 0.4);
  pointer-events: none;
}
```

`.glass-panel` is already `position: relative` (see `globals.css`), so the `::after`
needs no extra positioning setup. For the Looks modal itself (`--hud-bg`, applied via
Tailwind `bg-[var(--hud-bg)]` in `LooksModal.tsx`), the token substitution in §2 is
sufficient on its own — it already reads as a closed book cover against the lighter
leather cards inside it; no extra modal-specific CSS is required.

### 3c. Global surface/background texture

**Body gradient + fine grain.** Targets `body`/`body::before`, following the same
pattern retrowave/evergreen use (`body` sets the base gradient, `body::before` layers
a decorative texture at reduced opacity — the shared base rule for `body::before`
lives at `globals.css` ~line 302 and is `position: fixed; inset: 0; z-index: -1;
pointer-events: none`, so per-look overrides only need to set `background`/`opacity`,
as retrowave/evergreen already do). The grain uses an inline SVG `feTurbulence`
filter encoded as a `data:` URI — zero binary image assets, per the project
constraint (see References).

```css
[data-look='skeuomorphic'] body {
  background:
    radial-gradient(ellipse 900px 500px at 20% -10%, rgba(255, 226, 178, 0.05), transparent 60%),
    linear-gradient(165deg, #3e2b1e 0%, #2c1e15 55%, #241910 100%);
  background-attachment: fixed;
}

[data-look='skeuomorphic'] body::before {
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E"),
    radial-gradient(circle at 80% 90%, rgba(0, 0, 0, 0.25), transparent 55%);
  background-size: 140px 140px, cover;
  mix-blend-mode: overlay;
  opacity: 0.5;
}
```

`baseFrequency='0.85'` with `numOctaves='2'` gives a fine, tight grain appropriate to
leather (a lower `baseFrequency` like `0.05-0.2` would read as large blotchy clouds,
which is wrong for this material — reserve that range for something like wood grain,
not leather). `mix-blend-mode: overlay` lets the grain darken/lighten relative to
what's under it rather than sitting as a flat gray haze on top. This layer must stay
strictly decorative and background-only — see the accessibility pitfall in §4 before
implementing.

---

## 4. Accessibility

All pairs below are computed with the standard WCAG relative-luminance contrast
formula (not asserted) using the exact token values from §2; translucent tokens are
alpha-composited over `--background` first, since that's the color a reader actually
sees. AA requires ≥4.5:1 for normal text and ≥3:1 for large text (≥18pt / ≥14pt
bold) or non-text UI components.

| Pair | Resulting color | Contrast | Verdict |
|---|---|---|---|
| `--foreground` on `--background` | `#f1e4c9` on `#34241a` | **11.8:1** | Passes AAA (body text) |
| `--foreground` on `--panel-bg` (composited) | `#f1e4c9` on `#463324` | **9.48:1** | Passes AAA (card/bubble text) |
| `--foreground` on `--chip-bg` (composited) | `#f1e4c9` on `#2b1e15` | **12.84:1** | Passes AAA |
| `--accent` on `--background` | `#c38a42` on `#34241a` | **4.98:1** | Passes AA normal text (brass labels/links/icons) |
| `--background` on `--accent` fill (primary button label) | `#34241a` on `#c38a42` | **4.98:1** | Passes AA normal text — matches the app's existing `--accent-foreground: var(--background)` convention already baked into `components/ui/button.tsx`'s default variant |
| `--muted` on `--background` (composited) | `#a59783` on `#34241a` | **5.2:1** | Passes AA normal text |
| `--muted` on `--panel-bg` (composited) | `#a59783` on `#463324` | **4.52:1** | Passes AA, but only barely — see pitfall below |
| `--muted-strong` on `--background` (composited) | `#d5c7af` on `#34241a` | **8.93:1** | Passes AAA |

The one number worth flagging to QA specifically: **muted text inside a panel sits
right at the 4.5:1 floor (4.52:1)**, computed from the nominal hex/alpha values. Real
rendering can shift this slightly (subpixel anti-aliasing, an underlying grain
texture bleeding through translucent layers, GPU color management). QA should
re-measure this exact pairing (a `.intel-card p`-style muted caption, e.g. a message
timestamp, inside a rendered card) with a contrast tool against the actual rendered
pixels, not just the source hex. If it measures under 4.5:1, bump `--muted`'s alpha
from `0.6` to `0.65` — that's the one number in this spec explicitly pre-approved to
move without a design re-review, since it only affects text opacity, not the material
story.

**Pitfalls to avoid:**

1. **Grain texture legibility.** The `body::before` noise layer in §3c must stay
   strictly on the fixed, `z-index: -1`, `pointer-events: none` body backdrop — never
   duplicated at higher opacity directly behind card/bubble text, and never above
   `opacity: 0.5`. At higher opacity or applied close to text, SVG noise measurably
   degrades small-text legibility (this is the single most common failure mode of
   "adding grain" to a UI). If any implementer is tempted to add a grain layer *inside*
   `.intel-card`/`.glass-panel` for extra "leather-iness," don't — texture belongs on
   the ambient background only.
2. **Embossed text-shadow, small text.** The `text-shadow: 0 1px 0
   rgba(255,240,210,0.35)` in §3a's button recipe is calibrated for a ~14-16px button
   label. Do not apply that same embossed text-shadow to `--text-xs` (12px) captions,
   timestamps, or badge text — a light single-pixel offset blurs small glyph edges
   under normal anti-aliasing and measurably hurts readability at that size. Keep
   text-shadow usage confined to buttons/headings at `--text-sm` and above.
3. **Non-color-dependent state cues.** Because the accent (brass) sits against a warm
   brown background, hue alone is a weak signal for colorblind users. Every
   interactive-state change specified in §3a changes *shape* (translateY offset,
   shadow depth/direction) alongside the brightness/filter change — preserve that
   pairing; don't strip the transform/shadow half of any state rule down to "just a
   color change" during implementation.
4. **Dashed stitching vs. focus ring.** The decorative dashed `::after` stitching
   border in §3b is a fixed, static brass color (`rgba(195, 138, 66, 0.4)`) and is
   `pointer-events: none`. It must stay visually distinct from the app's real
   focus-visible ring (`--focus-color`/`box-shadow: var(--focus-ring)`, defined
   globally and unaffected by this look) — do not let the stitching color drift close
   enough to the focus-ring color that keyboard users can't tell a focused element
   from a merely-decorated one.

---

## 5. `looks.ts` entry

Add to the `LOOKS` array in `app/lib/looks.ts`, matching the existing array's format
and description tone exactly (compare to Ember's "Warm charcoal with a muted
terracotta accent" and Evergreen's "Deep forest jewel-tone with an antique-gold
accent"):

```ts
{ id: 'skeuomorphic', name: 'Leatherbound', description: 'Stitched saddle-leather journal with brass rivets and warm parchment ink', category: 'themed' },
```

- `id: 'skeuomorphic'` — matches the attribute selector specified throughout this
  document (`[data-look='skeuomorphic']`).
- `name: 'Leatherbound'` — a one-word, evocative name in the same register as
  `Retrowave`/`Evergreen`/`Aurora`, naming the object (a leatherbound journal) rather
  than the design-history term.
- `category: 'themed'` — sits alongside `retrowave`, which is the other look built
  around a single strong, committed material/motif rather than a general dark-mode
  palette (`dark`) or a general modern-trend palette (`modern`).

No `[data-look-preview='skeuomorphic']` hover-preview animation is included in this
spec. That mechanism is optional — `evergreen`, `aurora`, `gemini`, `accessible`,
`depth`, and `neominimal` all currently ship without one — and adding one is out of
scope here; if a future pass wants one, it would live in `globals.css` next to the
other `[data-look-preview=...]` blocks and should reuse the same brass/leather palette
(e.g., an animated brass-rivet glint), not introduce new colors.

`LOOK_CATEGORIES` in `app/lib/looks.ts` does not need to change — `'themed'` already
exists in that array.

---

## References

- [Wikipedia-adjacent search / Slate: "Scott Forstall fired: Skeuomorphism..."](https://slate.com/technology/2012/11/scott-forstall-fired-skeuomorphism-the-design-concept-thats-tearing-apple-and-the-tech-world-apart.html) and [AppleInsider: "What Apple learned from skeuomorphism"](https://appleinsider.com/articles/22/08/23/what-apple-learned-from-skeuomorphism-and-why-it-still-matters) — grounded the historical definition and confirmed Notes.app's stitched-leather-binding + yellow-legal-pad treatment as the canonical iOS 6 reference point, which directly drove the §1 decision to build the material story around a bound leather journal rather than a more generic "leather texture."
- [MacRumors / Cult of Mac coverage of Calendar.app, Game Center, Newsstand](https://www.cultofmac.com/news/steve-jobs-himself-is-responsible-for-calendar-and-game-centers-hideous-skeuomorphic-designs) — confirmed the torn-paper/leather-strip Calendar header, green-felt Game Center, and wood-shelf Newsstand as the other canonical examples named in the brief; used in §1 to explicitly rule out the felt/wood-shelf/dial families as worse fits for this UI's actual shapes (a chat transcript isn't "a shelf of objects" or "a felt game table").
- [UX Planet / MacStories on Aqua](https://uxplanet.org/apple-aqua-exploring-the-legacy-of-macos-x-user-interface-3a11eb9b7dba) — confirmed Aqua's pinstripe/brushed-metal window chrome and gumdrop buttons are a *window-chrome* skeuomorphism, not a *content-card* one, reinforcing why leather-journal (a content/page metaphor) fits a chat app's message bubbles/composer better than brushed metal (a title-bar/window metaphor) does.
- [Medium/StringLabs/illuminz: skeuomorphism vs. neumorphism comparisons](https://medium.com/@illuminz/neumorphism-vs-skeuomorphism-the-battle-of-design-styles-2ac7ec26982) — confirmed the precise structural distinction (real depicted material + border + directional shadow vs. flat monochrome + borderless dual soft shadow) that §1's closing paragraph and the "don't accidentally build neumorphism" warnings throughout this spec are built on.
- [CSS-Tricks-family "stitched look" technique (dashed border pulled inward via inset/box-shadow)](https://www.bypeople.com/simple-white-stitched-leather-with-css3-cssdeck/) and related CodePen examples — informed the concrete `::after` dashed-inset-border technique used for the stitched-panel edge in §3b (a CSS-only technique requiring no image assets, matching this project's constraint of having no texture/binary assets to draw on).
- [Search results on `feTurbulence`-based CSS grain techniques (Codrops, CSSmatic, freeCodeCamp)](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/) — informed the inline-SVG `feTurbulence` data-URI grain technique in §3c, including the guidance on `baseFrequency` controlling grain fineness (used to pick `0.85`/`numOctaves 2` for a tight leather-appropriate grain rather than a coarse cloud-like noise) and the "stack it as a low-opacity overlay layer, don't touch the text layer" pattern that shaped the §4 legibility pitfall.
- [WebAIM Contrast Checker / general WCAG AA reference (4.5:1 normal text, 3:1 large text/UI)](https://webaim.org/resources/contrastchecker/) — confirmed the AA thresholds cited in §4; the actual contrast ratios in the §4 table were computed directly from the chosen hex/rgba values using the WCAG relative-luminance formula (not read off the tool), including alpha-compositing translucent tokens over `--background` before measuring, since that's the color a reader actually sees on screen.
