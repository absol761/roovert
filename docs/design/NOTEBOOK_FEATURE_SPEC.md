# Notebook — Feature + Implementation Spec

Status: proposed, not yet implemented. This document is the single source of truth for a
new, **off-by-default** "Notebook" feature: an AI-assisted note-taking + lightweight-math
surface styled after reMarkable's e-ink tablets, with three selectable paper styles (White,
Black, Construction/blue).

Written to the same bar as `docs/design/SKEUOMORPHIC_LOOK_SPEC.md` (material research backed
by real sources, exact token values, computed WCAG contrast, explicit pitfalls) — read that
doc first if you haven't; this one assumes the same conventions (CSS custom-property blocks,
`@layer`-free appends to `app/globals.css`, opt-in via explicit user action, nothing here
touches any default/existing behavior until a user turns it on).

Target files are listed per-section and consolidated in §8 (file breakdown) for parallel
implementation.

---

## 0. One-paragraph scope statement

**In scope for v1 (buildable overnight):** a hidden-until-enabled "Notebook" opened from the
sidebar rail; a near-fullscreen paper-style writing surface (White / Black / Construction,
switchable per-note); plain-text notes with **optional, explicit** LaTeX rendering (`$...$` /
`$$...$$`, via KaTeX) and **optional, non-intrusive** live arithmetic evaluation on lines that
unambiguously look like `expression =`; one explicit, user-triggered AI action (clean up /
explain / check this note) that previews its result and never edits text without approval,
built on the app's existing query-gateway plumbing; localStorage persistence; a single
Settings toggle, off by default.

**Explicitly out of scope for v1** (cut to keep this buildable in one night and to avoid the
exact failure modes research turned up — see §2): symbolic algebra / equation solving /
graphing, handwriting or OCR input, voice/meeting transcription, real-time collaborative
editing, per-note sharing/export beyond what the app's existing conversation-export pattern
already does, a rich-text/WYSIWYG toolbar, and any integration with the app's 9-Look theming
system (justified in §4).

---

## 1. Research: what makes AI-assisted formatting feel helpful vs. annoying

### 1a. The products that get this right (and exactly what they do)

- **Apple Math Notes (Notes/Calculator, iOS 18+).** Type an arithmetic line ending in `=`
  (e.g. `5 * 6 =`) and it fills in `30` live, recalculating as you edit upstream values.
  Ambiguous input gets a dotted **blue** underline (tap to revise); unsolvable/unrecognized
  input gets a dotted **red** underline. Nothing is rewritten — the result is an addition
  *next to* what you typed, never a mutation of it. Source: MacMost's detailed walkthrough
  (https://macmost.com/34-notes-about-math-notes.html), AppleInsider's interview with the
  feature's own PMs (https://appleinsider.com/articles/24/07/17/apple-executives-talk-about-the-origins-of-math-notes-in-ipados-18).
- **Obsidian's live-preview math.** `$...$`/`$$...$$` is rendered with KaTeX only inside
  explicit LaTeX delimiters the user typed themselves — it is never inferred from plain
  prose, so a sentence that happens to contain a dollar amount or a stray `=` is never
  mistaken for math.
- **iA Writer's Markdown philosophy.** Formatting is a *second, rendered layer* over literal
  Markdown source text, never a replacement of it — "a Markdown-formatted document should
  stay readable as plain text" (https://ia.net/writer/support/basics/markdown-guide). The
  source text a user typed is sacred; styling is applied, never substituted.
- **Notion AI / inline-formatting tools, done wrong.** The AWS Marketplace review corpus and
  a DEV Community troubleshooting guide both describe Notion AI's rewrite feature **losing
  the user's original formatting** ("my neat bullet points turn into paragraphs") and
  producing generic, over-edited prose with no way to protect a selection from being
  touched. This is the single most-repeated complaint found in research and the one this
  spec is built around avoiding (see §2's rule R1 and the AI-assist design in §4).

### 1b. Synthesized design rules (all testable, not just aspirational)

1. **R1 — Never silently mutate what the user typed.** Auto-formatting renders an
   *additional visual layer* (a KaTeX-rendered span, a ghost result, a dismissible
   annotation) positioned next to or below the source text. The underlying stored text is
   never rewritten by a background process. Test: select-all + copy a note at any time and
   the clipboard text is byte-identical to what was typed, including any line that currently
   shows a rendered result.
2. **R2 — Nothing fires mid-keystroke.** Recognition (is this line math? is this a LaTeX
   span?) only re-evaluates on blur of that line (cursor leaves it) or after a 500ms typing
   pause, never on every keypress. Test: typing `12345` rapidly never flashes an
   intermediate, wrong "recognized" state.
3. **R3 — High-precision triggers only; no prose false-positives.** A line is "arithmetic"
   only if, after trimming, it matches `^[\s\d+\-*/^%().]+=\s*$` — digits, basic operators,
   parentheses, and a trailing `=`, nothing else. Any letter, word, or punctuation outside
   that set disqualifies the line. This directly targets Apple Math Notes' most-cited
   complaint (an Apple Community thread: "Notes now intrusively checks hand-written math
   formulae" while a parent was helping a kid with homework prose) — our regex cannot match
   anything that isn't unambiguously a bare arithmetic expression.
4. **R4 — Every auto-format is instantly, locally undoable.** Pressing `Esc` while a line
   with a shown result/render is focused dismisses *that line's* annotation for the rest of
   the session (stored as a per-line dismissed-flag, not a deletion) without affecting any
   other line. This is the direct fix for the most common structural complaint found (Apple
   Math Notes and 1Password's Markdown-in-notes thread both lack *any* granular, discoverable
   off switch — see §2, items A2/A6).
5. **R5 — One visible, one-click master switch, not buried in a submenu.** A "Show math
   results" toggle lives in the Notebook's own toolbar (always visible while the Notebook is
   open), not three levels deep in Settings. Turning it off hides every ghost-result layer
   immediately and reversibly; it never deletes anything.
6. **R6 — AI output is always a proposal, never a commit.** Covered in full in §4; restated
   here because it's the same principle as R1 applied to the AI-assist action specifically.

---

## 2. Anti-patterns checklist — things this feature must NOT do

Each item below is tied to a specific complaint found during research, not a hypothetical.

| # | Must NOT do | Real complaint it's answering | Source |
|---|---|---|---|
| A1 | Rewrite or restructure text the user already wrote without an explicit "apply" action | AWS Marketplace reviewer: Notion AI's rewrite "loses my formatting... neat bullet points turn into paragraphs"; wants "a choice over when to apply formatting changes" | AWS Marketplace reviews of Notion AI (via eesel.ai summary) |
| A2 | Make the master kill-switch hard to find | Apple Community: user "can not find anything in settings to permanently turn off" Math Notes | discussions.apple.com/thread/255773843 |
| A3 | Trigger recognition on content that isn't unambiguously the target pattern | Apple Community: Notes "intrusively checks hand-written math formulae" while writing unrelated prose; r/ipad: feature fires on homework help text | discussions.apple.com, reddit via axebps-redlib mirror |
| A4 | Produce generic, voice-flattening rewrites when asked to "clean up" | eesel.ai / DEV Community: Notion AI rewrites "using generic, corporate-speak," removing nuance | eesel.ai blog on Notion AI rewrite |
| A5 | Strip or change formatting/structure the user didn't ask to change | DEV Community troubleshooting guide: Notion AI output "stripping formatting, adding unwanted line breaks, changing block types" | dev.to/techsifted Notion AI troubleshooting |
| A6 | Force the AI action into every interaction with no opt-out per note | GoodNotes feedback board: user "forced... to do the ai summarize too," burning credits unintentionally | feedback.goodnotes.com/forums/191274 |
| A7 | Let one special character silently change the meaning of surrounding text (over-eager autoformat) | Zotero forum: "When I'm typing notes, I'll often add asterisks for emphasis, but I want them to stay asterisks" — auto-markdown changed literal characters | forums.zotero.org/discussion/123152 |
| A8 | Ship an editor-wide autoformat behavior with zero way to disable it anywhere | 1Password Community: "It is currently not possible to turn off markdown in the extension" | 1password.community markdown threads |
| A9 | Auto-renumber or restructure lists the user deliberately typed a specific way | GitHub Community: GitHub's own markdown editor auto-renumbers ordered lists, with users asking how to keep them as all "1." | github.community/t/can-you-disable-markdown-list-auto-completion |
| A10 | Lose dynamic recalculation silently / fail with no visible error state | Apple Community: "Math Notes stop updating dynamically" with no indication why | discussions-kr-prz.apple.com/thread/255813454 |
| A11 | Attempt algebra/graphing and get it visibly wrong, eroding trust in the whole feature | r/ipad / r/iPadPro: "can't do anything more advanced than basic 5th grade math," called "terrible, needs to improve" | reddit via redlib mirrors |

**How this spec answers each row:** A1/A4/A5/A6 → §4's "AI output is a proposal, never a
commit" rule, with per-action preview + explicit Insert/Replace/Discard. A2/A8 → §6's
always-visible Settings toggle *and* the Notebook's own in-toolbar master switch (two
independent, obvious off-switches — session-level and permanent). A3/A7/A9 → §3's
intentionally narrow, allowlist-style trigger pattern (R3) that never touches anything
outside a bare arithmetic line or an explicit `$...$` span; nothing else in the note is ever
auto-formatted. A10 → recognized-math results recompute from the stored literal text on every
render, so "stuck" stale results are structurally impossible (there's no separate cached
state to go stale). A11 → explicit scope cut: arithmetic evaluation only, no symbolic solving,
stated plainly in §0 and §3 so no implementer is tempted to reach for a CAS.

---

## 3. Math: recognition + rendering approach (concrete, scoped for one night)

**Rendering library: KaTeX, not MathJax.** KaTeX renders synchronously (no reflow/async
layout pass MathJax needs), ships at roughly 75KB gzipped vs. MathJax 3's larger footprint,
and has first-class, widely-used React wrapper patterns. It covers 100% of what this feature
needs (basic expressions, fractions, exponents) — MathJax's broader LaTeX coverage (e.g.
`\DeclareMathOperator`) buys nothing here. License: MIT, compatible with this repo. **Add
`katex` (+ `@types/katex` dev dependency) to `package.json` — the only new runtime
dependency this feature needs.**

**Two independent recognizers, never combined into one "smart" pass:**

1. **Explicit LaTeX spans** — any `$...$` (inline) or `$$...$$` (block) the user typed
   themselves is rendered with KaTeX. This is pure opt-in: the user must type the delimiter;
   nothing is ever auto-wrapped in `$...$` on their behalf. Unparseable LaTeX inside the
   delimiters fails closed — render the literal source text unstyled, never throw/crash the
   note.
2. **Bare-arithmetic lines** — a line (after trim) matching
   `/^[\d+\-*/^%().\s]+=\s*$/` is eligible for live evaluation. This is deliberately a
   strict allowlist of characters (digits, `+ - * / ^ % ( ) .` and whitespace, trailing `=`)
   — see R3/A3/A7/A9 above for why this must stay narrow. On recognizing an eligible line
   (debounced per R2), evaluate it with a small hand-written recursive-descent/shunting-yard
   parser supporting `+ - * / ^ %` and parentheses with standard precedence — **never**
   JavaScript's `eval()` or `Function()` (arbitrary-string evaluation is a code-injection
   surface in a feature whose whole input is untrusted user text) and **never** a symbolic
   algebra system. Division by zero or malformed input renders a small, dismissible "can't
   evaluate" marker (not a crash, not a silent no-op). The result renders as a ghost
   annotation after the trailing `=` — visually distinct (muted, smaller, slightly offset)
   from the user's own ink — never inserted into the editable text (R1).

**Explicitly cut from v1, by design:** variables/symbolic algebra, equation solving,
graphing, unit conversion, and handwriting/OCR input. All four are exactly where Apple's own
Math Notes draws its sharpest criticism (A11) and each is a multi-day implementation project
on its own — wrong scope for an overnight build. If this ships well and the product owner
wants more later, variables ("let x = 5") are the natural next increment, not symbolic solving.

**New files:** `app/lib/notebook/mathRecognition.ts` (pure functions: `isArithmeticLine`,
`evaluateArithmetic`, `extractLatexSpans` — no React, fully unit-testable in isolation).

---

## 4. AI-assist: concrete scope, reusing existing infra

**Reused, not rebuilt:** this app already has a working multi-provider streaming AI query
pipeline (`app/lib/providers.ts`, `app/api/provider/route.ts`, `app/api/query-gateway/route.ts`)
that accepts `{ query, model, systemPrompt?, conversationHistory? }` and streams back
`data: {"content": string, "done": boolean}` SSE chunks — identical to what the main chat
already parses. The Notebook's AI-assist is a thin client on top of this: no new backend
route, no new provider wiring.

**The one feature, three canned actions, same code path:**

- A small "Ask AI" affordance appears (a) in a selection-popover when text is selected inside
  a note, or (b) as a single toolbar button operating on the whole note when nothing is
  selected.
- Three fixed actions — **Clean up formatting**, **Explain this**, **Check this math** — each
  just builds a scoped system prompt (new constants in `app/lib/prompts.ts`, e.g.
  `NOTEBOOK_CLEANUP_PROMPT = "You are tidying a personal note. Return ONLY the revised text with no commentary, preserving the author's meaning and voice exactly."`) and POSTs the
  selected/whole text as `query` to the existing `/api/query-gateway` endpoint with the
  user's currently-selected model.
- **R6, restated concretely: the streamed response renders into a side-by-side preview card
  — never directly into the note.** The card shows "Insert" (append), "Replace selection"
  (only enabled when a selection drove the request), and "Discard." Nothing in the stored
  note changes until the user clicks one of those. This is the direct structural fix for A1/
  A4/A5/A6 — there is no code path by which an AI response can land in the note without that
  explicit click, by construction, not by convention.

**New files:** `app/components/notebook/AskAIPanel.tsx` (selection popover + preview card +
the three canned actions, calling `/api/query-gateway` exactly as the chat composer does);
3 new prompt constants appended to `app/lib/prompts.ts`.

---

## 5. Visual design — reMarkable's actual visual language, translated to CSS

### 5a. What actually makes reMarkable read the way it does (not "gray background")

- **The "white" is never pure white.** A reviewer's direct colorimeter reading of the Paper
  Pro's panel measured its "white" state at **#A8AAA7** — a cool, desaturated gray, not
  `#FFFFFF` — explicitly because bright white reads as glare/clinical on a paper-emulating
  surface (https://blog.remarkable.com/blog/how-we-made-remarkable-paper-pro and third-party
  colorimeter write-ups referencing the panel). This repo's own Leatherbound research (see
  `SKEUOMORPHIC_LOOK_SPEC.md` §3c) hits the same conclusion from the opposite (dark) direction
  with its grain/noise technique. The same principle, "no clinical pure value," is what every
  paper style below is built around — translated for an *emissive* screen (where reflectance
  physics don't apply) as "warm/cool off-white, never `#fff`; soft near-black, never `#000`."
- **Extreme chrome restraint.** Reviews consistently describe the UI as "minimal," with the
  device's own interface receding almost entirely once writing starts (xatakaon.com,
  techcrunch.com coverage of the Paper Pro/Pure). Translated: the Notebook's own toolbar is a
  single thin strip, icon-only, no visible borders/panels competing with the page — paper is
  the focal surface, chrome is nearly invisible until touched.
- **Fine, physical-feeling surface texture**, not a flat color fill — reviewers specifically
  credit "just enough texture... to offer friction" for the paper illusion (geardiary.com
  Paper Pro review). This repo already has the right *technique* for this (see
  `SKEUOMORPHIC_LOOK_SPEC.md` §3c): an inline SVG `feTurbulence` filter encoded as a `data:`
  URI, zero binary assets. Reused here verbatim, just re-tuned (lower `baseFrequency`, since
  paper grain is finer/flatter than leather grain — leather used `0.85`; paper uses `0.35`,
  see token block below) and layered under text at very low opacity, never near/behind
  small text (same pitfall the leather spec already documents and this spec repeats in §6).
- **A restrained, single accent color per surface** used only for one purpose (recognized-
  math ink / the one AI-assist affordance), never as decoration — mirrors reMarkable's famous
  one-color trade-dress (orange) used sparingly against an otherwise monochrome device.

### 5b. Paper-style token blocks

Three self-contained token sets, each gated behind a `data-notebook-paper` attribute set **on
the Notebook's own root element only** (never `documentElement` — see §7 for why this must
stay independent of the app-wide Look system). Target file: append to `app/globals.css`.

```css
/* === Notebook paper styles — scoped to [data-notebook-root], never documentElement === */

[data-notebook-root][data-notebook-paper='white'] {
  --paper-bg: #f6f3eb;        /* warm eggshell, not #fff — see §5a */
  --paper-ink: #2a2722;       /* near-black warm ink, not #000 */
  --paper-ink-muted: rgba(42, 39, 34, 0.66); /* 4.72:1 on --paper-bg, see §6 table */
  --paper-rule: rgba(42, 39, 34, 0.09);      /* faint ruled-line color, decorative only */
  --paper-accent: #2f5c8a;    /* muted "fountain pen" blue — recognized-math ink, AI affordance */
  --paper-grain-opacity: 0.35;
}

[data-notebook-root][data-notebook-paper='black'] {
  --paper-bg: #15140f;        /* warm near-black, not #000 — avoids OLED crush, keeps grain visible */
  --paper-ink: #e8e3d6;       /* warm off-white ink */
  --paper-ink-muted: rgba(232, 227, 214, 0.62); /* 6.09:1 on --paper-bg */
  --paper-rule: rgba(232, 227, 214, 0.08);
  --paper-accent: #c9a66b;    /* muted metallic gold — "gold pen on black paper" */
  --paper-grain-opacity: 0.30;
}

[data-notebook-root][data-notebook-paper='construction'] {
  --paper-bg: #32495f;        /* matte slate-construction-paper blue */
  --paper-ink: #f2efe6;       /* warm off-white ink */
  --paper-ink-muted: rgba(242, 239, 230, 0.70); /* 4.91:1 on --paper-bg */
  --paper-rule: rgba(242, 239, 230, 0.10);
  --paper-accent: #f0b35e;    /* warm amber-orange — complementary "grease pencil" accent on blue */
  --paper-grain-opacity: 0.30;
}

/* Shared grain layer — identical feTurbulence technique to the Leatherbound look
   (SKEUOMORPHIC_LOOK_SPEC.md §3c), re-tuned finer/flatter for paper vs. leather:
   baseFrequency 0.35 (paper) vs. 0.85 (leather). Zero binary assets. */
[data-notebook-root] .notebook-page::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='paperGrain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paperGrain)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
  mix-blend-mode: overlay;
  opacity: var(--paper-grain-opacity);
}

[data-notebook-root] {
  background: var(--paper-bg);
  color: var(--paper-ink);
}

/* Optional ruled lines — off by default per note (see §5c), toggled by adding
   .notebook-page--ruled, never baked unconditionally into the paper itself. */
.notebook-page--ruled {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 31px,
    var(--paper-rule) 31px,
    var(--paper-rule) 32px
  );
}
```

### 5c. Typography + interaction states

- **Font:** reuse the app's existing `--font-geist-sans` (already loaded, zero new font
  weight/file cost) at a slightly larger-than-chat body size (`17px`/`1.0625rem`) and a
  generous `line-height: 1.75` — the single biggest lever for a "quiet," uncluttered reading
  feel, per every piece of reMarkable/iA-Writer-style minimalist-writing-UI research above.
  No bold/italic toolbar — Markdown-lite conventions (`**bold**`, `*italic*`) render inline
  exactly like LaTeX spans do (R1: styled layer over literal text, never rewritten), matching
  iA Writer's "format is a rendered overlay" rule precisely.
- **Ruled lines are opt-in per note** (`.notebook-page--ruled`, see §5b), default off —
  reMarkable's own interface defaults to blank, and forcing ruled lines on every page is the
  kind of unasked-for decoration this whole feature is trying to avoid.
- **Focus state:** no border/box-shadow focus ring on the writing surface itself (it would
  visually compete with the paper) — instead a single, thin `2px` `--paper-accent` caret
  color change and a barely-perceptible (`opacity: 0.06`) warm vignette at the viewport edge,
  mirroring reMarkable's own near-chromeless focus behavior.
- **Toolbar:** one thin (40px) icon-only strip, `--paper-ink` icons at 55% opacity resting /
  100% on hover, containing exactly: paper-style switcher (3 small swatches), the "Show math
  results" master switch (R5), the Ask-AI entry point, and the modal's close affordance.
  Nothing else — no font controls, no color picker, no export menu (the app's existing
  Settings-modal export action already covers text export generically if ever extended here).

---

## 6. Accessibility — computed WCAG contrast (not asserted)

Computed with the standard WCAG relative-luminance formula directly from the hex/rgba values
in §5b (not read off a tool), compositing translucent `--paper-ink-muted` over `--paper-bg`
first, since that's the color actually rendered on screen. AA requires ≥4.5:1 for normal text
and ≥3:1 for large text (≥18pt/≥14pt bold) or non-text UI.

| Paper | Pair | Resulting color | Contrast | Verdict |
|---|---|---|---|---|
| White | `--paper-ink` on `--paper-bg` | `#2a2722` on `#f6f3eb` | **13.41:1** | AA/AAA |
| White | `--paper-ink-muted` (0.66) on `--paper-bg` | ≈`#625f59` on `#f6f3eb` | **4.72:1** | AA (normal text) |
| White | `--paper-accent` on `--paper-bg` | `#2f5c8a` on `#f6f3eb` | **6.27:1** | AA/AAA |
| Black | `--paper-ink` on `--paper-bg` | `#e8e3d6` on `#15140f` | **14.39:1** | AA/AAA |
| Black | `--paper-ink-muted` (0.62) on `--paper-bg` | ≈`#847f70` on `#15140f` | **6.09:1** | AA/AAA |
| Black | `--paper-accent` on `--paper-bg` | `#c9a66b` on `#15140f` | **8.03:1** | AA/AAA |
| Construction | `--paper-ink` on `--paper-bg` | `#f2efe6` on `#32495f` | **8.10:1** | AA/AAA |
| Construction | `--paper-ink-muted` (0.70) on `--paper-bg` | ≈`#9aa3ac` on `#32495f` | **4.91:1** | AA (normal text) |
| Construction | `--paper-accent` on `--paper-bg` | `#f0b35e` on `#32495f` | **5.02:1** | AA (normal text) |

Every pair clears AA for normal text with a real margin (the two tightest, White and
Construction's muted-ink alpha, were tuned up from an initial `0.58`/`0.62` specifically to
clear 4.5:1 — the same "bump the alpha, not the material story" move
`SKEUOMORPHIC_LOOK_SPEC.md` §4 documents for its own `--muted` token). As with that spec: if
QA measures a lower number against actual rendered pixels (subpixel AA, grain bleed-through,
GPU color management can all shift this slightly), the pre-approved fix is to raise the
muted-ink alpha further — that's the one number in this spec allowed to move without a
design re-review.

**Pitfalls to avoid (mirrors `SKEUOMORPHIC_LOOK_SPEC.md` §4, restated for paper):**

1. **Grain legibility.** `--paper-grain-opacity` must stay ≤0.35, `mix-blend-mode: overlay`,
   and applied only via the `.notebook-page::before` background layer — never duplicated
   directly behind small text (ghost math results, muted timestamps). This is the exact same
   failure mode the Leatherbound spec calls out as "the single most common failure mode of
   adding grain to a UI."
2. **Ghost math-result text is small by nature** (it sits inline after a `=`) — render it at
   no smaller than 14px and always in `--paper-accent` at full opacity (not a further-muted
   variant of it), since the contrast table above was computed at full-opacity accent ink.
3. **Non-color-dependent state cues.** The "dismissed" state of a per-line math annotation
   (R4) must not be color-only (e.g. just fading the ghost text) — pair it with the
   annotation actually disappearing from layout, so a colorblind user gets the same signal
   non-visually distinguishable users get.
4. **Construction paper's accent is the tightest margin (5.02:1).** Don't substitute a
   lighter/more saturated "brighter" orange for aesthetic reasons without re-running the
   contrast math — this was specifically tuned against `#32495f`, not the lighter `#3c5770`
   this spec's first draft tried (which only cleared 4.06:1 — see the design notes in this
   doc's accompanying research for the rejected intermediate value).

---

## 7. Where it lives + how it's toggled

### 7a. Standalone from the Looks system — explicit recommendation

**Recommendation: the Notebook's three paper styles are a separate, self-contained concept,
not a 9th/10th/11th entry in `app/lib/looks.ts`.** Reasoning:

- The Looks system (`app/lib/looks.ts` + `[data-look='...']` blocks in `app/globals.css`) is
  applied via `document.documentElement.setAttribute('data-look', look)` — a single,
  app-wide skin covering chat bubbles, composer, modals, sidebar, buttons. It is fundamentally
  "which theme is the whole app wearing," and every Look's tokens (`--accent`, `--panel-bg`,
  `--shadow-*`, etc.) are consumed broadly across dozens of shared components.
- Paper style is a **local, per-note** choice orthogonal to that: a user should be able to
  keep "Google Gemini" as their app-wide Look and still pick "Black paper" for one note and
  "Construction paper" for another, without either choice fighting the other's token
  namespace. Folding paper styles into `LOOKS`/`data-look` would mean either (a) the Notebook
  surface always matches whatever Look is globally active (loses the explicit
  White/Black/Construction choice the product owner asked for) or (b) switching paper style
  would have to swap `data-look` on `documentElement`, which would re-skin the *entire app*
  (sidebar, composer, every modal) just because someone changed how one note page looks —
  clearly wrong.
- Keeping it separate also means the Looks modal's grid (`LooksModal.tsx`, which maps
  `LOOK_CATEGORIES` → `LOOKS`) never needs to special-case a feature-specific, off-by-default
  concept it has no other reason to know about.

**Concrete mechanism:** a new, independent registry `app/lib/notebook/paper.ts` (same shape
as `looks.ts`'s array-of-objects, but its own file/namespace) exporting `PAPER_STYLES =
[{id:'white', name:'White', ...}, {id:'black', ...}, {id:'construction', ...}]`, default
`'white'`. Applied via `data-notebook-paper` set on the Notebook's own root `<div>` (never
`documentElement`) — see the exact selectors in §5b. Paper choice is stored per-note (so
switching notes can restore each one's own paper) in the same localStorage blob as note
content (§8).

### 7b. Navigation: a dedicated near-fullscreen view, not a tiny floating window

Two existing UI patterns were evaluated:

- **`FloatingChatWindow`-style draggable window** — good fit for a *second chat thread* you
  want glanceable alongside the main one, but wrong for Notebook: writing/math needs room to
  breathe (the entire reMarkable aesthetic this spec is chasing depends on generous
  whitespace), and a resizable/draggable chrome frame with corner-snap handles is exactly the
  kind of competing visual chrome §5a's "extreme chrome restraint" principle argues against.
- **A small centered modal** (`SettingsModal`/`LooksModal`'s `max-w-2xl`/`max-w-5xl` pattern)
  — too cramped for a writing surface; those modals are right-sized for *settings/pickers*,
  not for a page you write a page of math on.

**Recommendation: `NotebookModal`, a new component following the existing modal
*mechanics* (same `useModalDismiss`/`useFocusTrap`/`MODAL_TRANSITION` hooks every modal in
this app already shares, same `fixed inset-0 z-[100]` dismiss-on-backdrop-click pattern) but
sized near-fullscreen (`inset-4` / `max-w-[96vw] max-h-[94vh]`) rather than a centered
dialog — a full paper canvas with a thin toolbar, not a dialog box.** Opened from a **new
sidebar-rail icon** (`SidebarRail.tsx`, lucide `NotebookPen`), placed in the existing
`topActions` array right after "New window" — consistent with how every other primary
surface (history, global feed, command palette, looks) is reached today. The rail item is
rendered with `hidden: !notebookEnabled` (the exact field the `RailAction` interface already
supports — see `SidebarRail.tsx` lines 32-39) so when the feature is off, there is no icon,
no trace, no empty state — it does not exist in the UI at all, matching "off by default"
literally rather than just defaulting a toggle to unchecked.

### 7c. The toggle itself: off by default

Add one boolean, `notebookEnabled`, to `SettingsModal`'s existing "Preferences" section (same
slider-switch component already used for Data Saver/Focus Mode/Neural Background/Visualizer
button — copy that exact markup, it's a proven, accessible pattern already in the file).
Lifted to `app/page.tsx` as `const [notebookEnabled, setNotebookEnabled] = useState(false)`
— **default `false`**, satisfying "off by default" outright. Unlike `look`/`dataSaver`/etc.
(which page.tsx currently keeps in-memory only, resetting each session — confirmed by reading
the file, no `localStorage` calls exist for those today), persist this one explicitly to
`localStorage` under a new key (`roovert_notebook_enabled`) using the exact same
try/catch-wrapped, SSR-safe read/write pattern `RESPONSE_STYLE_STORAGE_KEY` already uses in
`page.tsx` — once a user opts in, it should stay on, not silently revert next session. The
Notebook's own content (notes, per-note paper choice, per-line dismissed-math flags) is a
second, separate localStorage key (§8), so disabling the feature later never deletes a user's
notes — it just hides the entry point again.

`NotebookModal` and its KaTeX dependency are loaded via `next/dynamic` (the same pattern
`FloatingChatWindow` already uses one line above it in `page.tsx`), so a user who never
enables the feature pays zero bundle cost for it — not even the KaTeX library is fetched
until the feature is both enabled *and* opened.

---

## 8. File / component breakdown (for parallel implementation)

Each row is close to independent — a swarm of implementation agents can take one row each
with minimal cross-file coordination. "Depends on" lists the one or two things that must
exist (even as a stub/interface) before that piece can be finished.

| # | File (new unless noted) | Owns | Depends on |
|---|---|---|---|
| 1 | `app/lib/notebook/paper.ts` | `PAPER_STYLES` registry (id/name/description), default `'white'` | nothing |
| 2 | `app/globals.css` (append only) | The three `[data-notebook-root][data-notebook-paper='...']` token blocks + grain layer + ruled-line class from §5b | #1 (for id names) |
| 3 | `app/lib/notebook/mathRecognition.ts` | `isArithmeticLine`, `evaluateArithmetic` (hand-written parser, no `eval`), `extractLatexSpans` — pure functions, unit-testable with `vitest` (already a dev dependency) | nothing |
| 4 | `app/lib/notebook/storage.ts` | localStorage CRUD for the notes array (`roovert_notebook_notes`), debounced save, try/catch-wrapped per the pattern at `page.tsx`'s `saveConversations` | nothing |
| 5 | `app/components/notebook/NotebookModal.tsx` | The near-fullscreen shell: toolbar (paper switcher, math-results master switch, Ask-AI entry, close), note list, mounts `NotebookPage` | #1, #4 |
| 6 | `app/components/notebook/NotebookPage.tsx` | The writing surface: editable text + per-line recognition (via #3) + KaTeX render layer + `MathLine` ghost-result annotations + per-line dismiss (`Esc`) | #3 |
| 7 | `app/components/notebook/MathLine.tsx` | One recognized line's rendering: source text (untouched) + ghost result span, dismiss state | #3 |
| 8 | `app/components/notebook/AskAIPanel.tsx` | Selection popover / toolbar entry, 3 canned actions, streams from `/api/query-gateway`, preview card with Insert/Replace/Discard (never auto-applies) | §4's 3 prompt constants (#9) |
| 9 | `app/lib/prompts.ts` (append only) | 3 new scoped system-prompt constants for Notebook AI actions | nothing |
| 10 | `app/components/modals/SettingsModal.tsx` (edit) | New "Notebook" toggle in the existing Preferences section (copy the Data-Saver switch markup) | nothing |
| 11 | `app/components/layout/SidebarRail.tsx` (edit) | New rail icon/action, `hidden: !notebookEnabled` | #5 (the open handler it calls) |
| 12 | `app/page.tsx` (edit) | `notebookEnabled` state + localStorage persistence, `isNotebookOpen` state, `next/dynamic` import of `NotebookModal`, prop wiring to #10/#11 | #5, #10, #11 |
| 13 | `package.json` (edit) | Add `katex` dependency + `@types/katex` dev dependency | nothing |

Suggested split for a small swarm: **Agent A** = #1, #2, #13 (tokens/CSS/dependency, zero
React); **Agent B** = #3 (math lib, pure functions, easiest to test in total isolation);
**Agent C** = #4, #6, #7 (storage + the writing surface + math-line rendering, the core
"notebook" experience); **Agent D** = #8, #9 (AI-assist panel + prompts, only needs the
existing query-gateway contract, not the other agents' work); **Agent E** = #5, #10, #11, #12
(the modal shell + all the app-wiring/toggle plumbing, done last since it imports #1/#4/#6).

---

## References

- [MacMost — "34 Notes About Math Notes"](https://macmost.com/34-notes-about-math-notes.html) — live calculation, variables, dotted blue/red error lines.
- [AppleInsider — Apple PMs on the origins of Math Notes](https://appleinsider.com/articles/24/07/17/apple-executives-talk-about-the-origins-of-math-notes-in-ipados-18)
- [Apple Community — "can not find anything in settings to permanently turn off"](https://discussions.apple.com/thread/255773843)
- [Apple Community — Math Notes stops updating dynamically](https://discussions-kr-prz.apple.com/thread/255813454)
- [Obsidian forum — live-preview/reading-mode math discrepancies](https://forum.obsidian.md/tag/math) — informed the "explicit delimiter only" rule in §3.
- [iA — Markdown Guide ("stay readable as plain text")](https://ia.net/writer/support/basics/markdown-guide)
- [eesel.ai — Notion AI rewrite behavior](https://www.eesel.ai/blog/notion-ai-improve-or-rewrite-content) and [DEV Community — Notion AI troubleshooting](https://dev.to/techsifted/notion-ai-not-working-heres-how-to-fix-it-1ecd) — both informed §2's A1/A4/A5.
- [GoodNotes feedback — forced AI summarize](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/50547288-let-us-record-normally-without-requiring-record-a) — informed A6.
- [Zotero forum — want literal asterisks to stay literal](https://forums.zotero.org/discussion/123152/feature-request-option-to-disable-automatic-markdown-in-notes) — informed A7/R3.
- [1Password Community — markdown can't be disabled in extension](https://www.1password.community/1password-at-home-31/markdown-cannot-be-disabled-on-my-1password-com-25078) — informed A8.
- [GitHub Community — can't disable markdown list auto-completion](https://github.community/t/can-you-disable-markdown-list-auto-completion/151277) — informed A9.
- [reMarkable — "How we made reMarkable Paper Pro"](https://blog.remarkable.com/blog/how-we-made-remarkable-paper-pro) and third-party colorimeter coverage citing a measured panel white of `#A8AAA7` — informed §5a's "never pure white" rule.
- KaTeX size/characteristics via npm registry analysis (DepScope: ~75KB gzipped) and KaTeX's own README (https://katex.org/) — informed the KaTeX-over-MathJax recommendation in §3.
- This repo's own `docs/design/SKEUOMORPHIC_LOOK_SPEC.md` §3c/§4 — source of the reused `feTurbulence` grain technique and the "bump alpha, not material story" accessibility-fix convention mirrored in §6.
