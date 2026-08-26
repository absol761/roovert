# Liquid Glass Look — Implementation Spec

Status: implemented. This document is the single source of truth for the `id: 'skeuomorphic'`
entry in the Looks system (displayed to users as "Liquid Glass").

This replaces an earlier version of this look ("Leatherbound" - a stitched saddle-leather
journal). The `id` was kept as `'skeuomorphic'` so any user's already-persisted look
preference doesn't silently break; only the material changed.

Target files:
- `app/lib/looks.ts` — the `LOOKS` entry (name/description only; `id` unchanged).
- `app/globals.css` — the `[data-look='skeuomorphic']` block (full material implementation).

The look is opt-in only, selected via the Looks modal, applied via
`document.documentElement.setAttribute('data-look', look)`. Nothing here touches the app's
default look.

---

## 1. Material story

**A pane of frosted, refractive glass floating above a deep, softly-lit canvas.** Every
surface — buttons, the composer, the sidebar, cards — reads as an actual physical sheet of
glass with real optical behavior: a specular highlight where a light source would catch its
top edge, a bright fresnel rim tracing its thickness at a grazing angle, and (where the
surface sits over live content, e.g. the sidebar) a backdrop blur that shows the content
moving softly beneath it.

This is deliberately grounded in the current (2025-2026) "Liquid Glass" material language —
the same family of design Apple's own visionOS/iOS use for system chrome — rather than an
older 2000s "glossy Web 2.0 button" pastiche. The differences that keep it from reading as
dated: no hard gloss/pinstripe highlights, no saturated candy colors, restrained near-neutral
tinting (cool white/blue, not rainbow), and highlights that are soft and directional rather
than a single centered "lozenge" shine.

**Why this material for THIS app, and where it's honestly weaker:**
- **Strong fit — chrome/frame elements.** The composer bar (a glass slab you type into), the
  sidebar rail (glass with live content scrolling behind it — the single best showcase of the
  effect, since blur/refraction needs something behind it to distort), buttons (a glass
  capsule with a specular sweep on hover reads as an obviously current, premium primary CTA),
  and modals (glass is *literally* what overlays are for) are all strong, honest uses of the
  material.
- **Honest weak spot — dense message/response text.** Glass's whole appeal is seeing through
  it to something behind; in a scrolling chat transcript, what's "behind" one message card is
  usually just more message cards or plain background, so a fully translucent card degrades
  into "slightly blurred flat panel" and loses the thing that makes glass glass. Translucency
  under long-form text is also a real legibility risk. **Resolution, matching how Apple's own
  HIG actually handles this same tension:** message/response cards get a much higher-opacity
  (~88%) fill — still glass-styled at the edges (fresnel rim, top highlight, backdrop blur
  contributing softly at the border) — while the "true," more translucent glass treatment is
  reserved for chrome. This is not a compromise bolted on after the fact; it is the documented
  real-world pattern for text-bearing glass surfaces.

**Explicitly rejected for message cards:** full low-opacity glass over paragraph text. Every
implementation reference found during research converges on the same two-layer approach used
here (near-opaque scrim for text, full optical treatment for chrome) — a design that ignored
this and forced true translucency under long text would fail its own accessibility bar.

---

## 2. `[data-look='skeuomorphic']` — token block

```css
[data-look='skeuomorphic'] {
  --background: #0a0d13;
  --foreground: #eef2f7;
  --accent: #5ac8fa;
  --accent-glow: rgba(90, 200, 250, 0.35);
  --panel-bg: rgba(255, 255, 255, 0.07);
  --border: rgba(255, 255, 255, 0.16);
  --panel-radius: 20px;
  --surface: rgba(255, 255, 255, 0.05);
  --surface-strong: rgba(255, 255, 255, 0.10);
  --chip-bg: rgba(255, 255, 255, 0.09);
  /* Foreground (#eef2f7) at 0.7 alpha over the near-black --background
     (#0a0d13) computes well above 4.5:1 (WCAG AA) - the background here is
     much darker than a mid-tone material would be, so there's real headroom
     for a comfortably legible secondary-text alpha. */
  --muted: rgba(238, 242, 247, 0.70);
  --muted-strong: rgba(238, 242, 247, 0.88);
  --hud-bg: rgba(10, 13, 19, 0.90);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
  --shadow-md:
    0 10px 30px -10px rgba(0, 0, 0, 0.45),
    0 3px 10px -3px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  --shadow-lg:
    0 30px 60px -20px rgba(0, 0, 0, 0.55),
    0 10px 20px -6px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.26);
  --shadow-glow:
    0 0 0 1px var(--border),
    0 8px 24px -8px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);

  --radius: 16px;
  --radius-tight: 10px;
  --radius-card: 22px;
  --radius-cta: 28px;
  --radius-pill: 9999px;
}
```

## 3. Component treatments

- **Buttons** (`[data-slot='button'][data-variant='default']`): translucent white-tinted
  capsule, `backdrop-filter: blur()`, fresnel rim border, inset top highlight. A `::before`
  specular sweep animates left-to-right on hover (same mechanic already used by the `gemini`
  look's button). `:active` compresses (translateY + brightness dip), same press language the
  app already uses everywhere else.
- **Composer bar** (`.composer-bar`): a glass slab — `backdrop-filter: blur() saturate()`,
  bright top-edge highlight, fresnel rim. Focus state intensifies the rim into a glow rather
  than swapping to a hard border color.
- **`.glass-panel` / `.intel-card` / `.chat-turn-user`**: the near-opaque (~88%) variant
  described in §1 — legible first, glass-styled at the edges second. Still gets the fresnel
  rim + top highlight + a soft `backdrop-filter` so it doesn't read as a flat recolor.
- **Sidebar** (`aside`, i.e. `SidebarRail`'s root element): the strongest, most literal use of
  the material — low-opacity fill + real `backdrop-filter: blur() saturate()` so the message
  list visibly, softly distorts behind it as the page scrolls; fresnel rim on the trailing
  edge.
- **Modals**: no dedicated CSS needed — every modal panel already renders via the shared
  `--hud-bg` / `--border` / `--shadow-lg` tokens, so they pick up the glass treatment for free
  once those tokens are set above.
- **Body background**: a deep, cool near-black canvas with two soft, low-opacity radial color
  blooms (blue/cyan) for the glass panes to have something worth refracting, rather than the
  grain-noise texture the leather look used (glass is smooth, not grained).
