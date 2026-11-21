---
name: venn-site-design
description: >-
  Design language of Venn's public landing site in `site/` (Next.js): quiet white
  page, ink as the only accent, black pill buttons, large tight headlines, and the
  two overlapping circles as the single signature image. Use when adding or changing
  a section, page, component, copy, color, type, spacing, or motion under `site/`,
  or when reviewing site UI for consistency with what is already built. Covers the
  rules `site/check.mjs` enforces. Not for the ChatGPT widget's own screens.
---

# Venn site design

How the landing page in `site/` looks, why, and how to extend it without it drifting.
`site/README.md` covers build, data, and deploy; this skill covers design decisions only.

## Read first

| File | Why |
| --- | --- |
| `site/app/globals.css` | Every page style, in page order, under `/* ---------- Name ---------- */` banners |
| `widget/src/venn-kit.css` | Tokens and card primitives. The source of truth |
| `site/app/page.tsx` | Section order and all landing copy |
| The component you are changing in `site/components/` | Markup, states, and ARIA already in use |

Open `references/recipes.md` when you add a section, a page, a link, or a new state.
Screenshots of the current page are in `site/.shots/` when someone has run
`node check.mjs --shots .shots` (the folder is git-ignored, so it may be absent or stale).

## The direction in one paragraph

One idea, drawn once: two circles and the ground they share. Everything else steps back.
The page is white, the type is near-black, the primary button is black, and the only color
is the blue, pink, and violet of the circles. It should read as calm and exact, the way the
product behaves: it shows you an overlap and stops. If a change adds a second idea, a second
accent, or a second thing that moves, it is probably wrong for this page.

## Color

Use tokens, never raw hex, in `globals.css`. All of them come from the kit except `--text-2`.

| Role | Token | Where |
| --- | --- | --- |
| Page and card surface | `--surface` | Hero, principles, panels, the form field |
| Recessed band or fill | `--bg`, `--surface-2`, `--surface-3` | The "Inside ChatGPT" band, chat bubble, step track |
| Text | `--text` | Headings, body, controls |
| Secondary text | `--text-2` | Hero subhead, section intros, principle text, form note |
| Tertiary text | `--muted` | Footnotes, footer, labels inside cards |
| Hairlines | `--border`, `--border-strong` | Card edges; control and pill edges |
| Action | `--primary`, `--on-primary` | The one primary button per view |
| The circles | `--venn-a`, `--venn-b`, `--venn-shared` | The hero scene, its CSS fallback, `.venn-pair`. Nowhere else |
| Status | `--danger`, `--focus` | Form errors, focus rings |

- Ink is the accent. Do not introduce a brand color for links, headings, icons, or highlights.
- The circle colors are for the circles. Do not reuse them for buttons, badges, text, or section
  backgrounds; that is what keeps the figure legible as the signature.
- Use `--text-2`, not `--muted`, for anything that sits over the hero scene.
- Tint with `color-mix(in srgb, var(--token) N%, transparent)` rather than a new token.
- Sections alternate white and `--bg`. Separate them with the surface change, not rules or shadows.
- The page is light only (`<html data-theme="light">`). Do not add a dark theme here; the kit's
  dark tokens exist for the widget. A visitor whose system is dark still gets the light page,
  and `check.mjs` verifies it stays readable.

## Type

One family (`--font`: the system UI font, with self-hosted Inter as the fallback). No second
typeface, no webfont from another origin.

| Level | Size | Other |
| --- | --- | --- |
| Hero `h1` | `clamp(2.5rem, 1.2rem + 6.2vw, 5.5rem)` | 600, line-height 1.02, tracking -0.04em |
| Section `h2` | `clamp(2rem, 1.3rem + 3vw, 3.5rem)` | 600, line-height 1.08, tracking -0.035em |
| `h3` | `1.1875rem` | 600, line-height 1.2, `--tracking-tight` |
| Hero subhead | `clamp(1.0625rem, 0.96rem + 0.45vw, 1.3125rem)` | line-height 1.4, max 40rem |
| Body | `1.0625rem` | line-height 1.47 |
| Card text | `0.9375rem` | line-height 1.4 to 1.45 |
| Small: eyebrow, notes, footer | `0.8125rem` | The smallest size the page itself sets |

- The page's own styles use weights 400, 500, and 600 (700 appears only inside the kit's circles
  and avatars). Hierarchy comes from size and tightness, not from bold or color.
- Headings are fluid with `clamp()`, not stepped with breakpoints. Add `text-wrap: balance` to
  centered multi-line text and cap paragraphs at roughly 34 to 40rem.
- Never go under 12px (the kit's `.badge` is exactly 12px). Inputs stay at 16px or more so iOS
  does not zoom on focus.
- Numbers that change or line up use `font-variant-numeric: tabular-nums`.

## Layout and spacing

- Everything sits in `.wrap`: `min(100% - 40px, 1080px)`, centered. Reading and interaction
  columns are much narrower: `30rem` for the form and the preview, `34rem` for intro text.
- The landing page is centered. The principles grid and `/metrics` are left-aligned because they
  are for scanning. Pick by purpose; do not mix alignments inside one block.
- Section padding is fluid: `clamp(56px, 8vw, 112px)` to `clamp(64px, 10vw, 128px)`. Be generous;
  white space is doing the work a divider would.
- Grids reflow on their own: `repeat(auto-fit, minmax(min(100%, 15rem), 1fr))`. Reach for a
  media query only when content truly changes, as the hero does on short screens.
- Shapes: `--pill` for every control and tag, `--radius` (18px) for panels, `--radius-sm` (12px)
  for cards inside panels, 28px for the chat shell that holds a panel. Outer radius is always
  larger than the radius it contains.
- Depth: a hairline border plus `--shadow` on floating surfaces, `--shadow-sm` on a selected
  segment. No heavier shadows, no glows, no gradients on surfaces.
- Use logical properties (`padding-block`, `margin-inline`) as the file already does.

### The hero is exactly one screen

The header, `h1`, subhead, and waitlist must all end above the fold at 360 x 640. Anything else
in the hero is optional and gated like `.collage` (shown only at 720px wide and 800px tall or
more). The backdrop stays `position: absolute`, behind the content, with `pointer-events: none`,
under `.hero__veil`, which is what keeps the text contrast safe. If you change how the circles
are arranged, change `VennScene.tsx` and `.venn-fallback` together: the CSS version paints first
and must match (side by side on wide screens, stacked when the aspect ratio is under 4:5).

## Components

Compose from the kit before writing new CSS: `.panel`, `.card`, `.notice`, `.btn` (with
`--primary`, `--ghost`, `--small`, `--block`), `.badge`, `.chip`, `.avatar`, `.pick`,
`.venn-pair`, `.lock-note`, `.muted`, `.small`, `.sr-only`.

- Anything that depicts the product (a card inside ChatGPT) is built from kit classes only, so the
  page cannot show a widget that does not exist. Page-specific wrappers go in `globals.css`.
- New page classes follow `block__element--modifier` and live under the banner of their section.
- A token or primitive both the site and widget need goes in `widget/src/venn-kit.css`. Never edit
  `site/app/venn-kit.css`; the build overwrites it.
- One `.btn--primary` per view. Secondary actions are plain `.btn`.
- Every link, button, email input, select, and `.pick` row is at least 44 x 44px. This includes
  text links: see the recipe before adding one.
- State is visible in the control: a disabled button says why ("Tick at least one signal"), a busy
  one says what is happening ("Joining…"), and an empty state offers the way back.
- Icons are small inline SVGs in `currentColor`, `aria-hidden`. No icon library.
- The mark (`VennMark`) is ink, decorative, and always beside the wordmark.

## Motion

- Ambient only in the hero: the slow orbit, or a 14s breathe in the CSS fallback. Nothing else
  on the page loops.
- New content enters with the shared `rise` keyframes (8px, 0.4 to 0.5s,
  `cubic-bezier(0.2, 0.8, 0.2, 1)`). Control feedback is a 0.15s transition.
- No scroll-triggered reveals, parallax, hover lifts, or animation libraries.
- The reduced-motion block at the end of `globals.css` switches everything off, and the hero then
  stays on the still CSS circles. New motion must be covered by both.

## Copy

- Short declarative sentences with a full stop, headlines included: "Find the common ground."
- Sentence case everywhere. Title Case only for the CTA "Join the Waitlist", the proper name
  "Founding Circle", and the three metric names on `/metrics`.
- Second person; Venn is the subject of what it does and, just as often, of what it does not do
  ("It never contacts anyone for you").
- Buttons name the result, verb first: "Draft warm intro", "Approve 4 signals".
- Errors say what to do next. Notes under a control state a promise, not marketing.
- No exclamation marks, emoji, superlatives, or invented numbers, logos, or testimonials.
- A claim must match the table "What the copy may claim" in `site/README.md`. Update that table
  when a claim changes. Example people are made up and the page says so; never use a real
  person's name or photo.

## Accessibility that is part of the look

- One `h1` per page. Each `<section>` has `aria-labelledby`; a section with no visible title gets
  an `.sr-only` heading.
- Decorative visuals are `aria-hidden` and carry an `.sr-only` text equivalent (see `HeroCollage`).
  Symbols such as "↔" are hidden and replaced with a spoken word.
- Results appear in `role="status"`, errors in `role="alert"`, and focus moves to a confirmation
  that replaces a form.
- Focus uses the kit's `:focus-visible` ring. If you remove an inner outline, put the ring on the
  wrapper, as `.waitlist__field` does.
- Contrast is WCAG AA: 4.5:1, or 3:1 for text of 24px and up.

## What `check.mjs` will fail

Design within these, because the check runs at 360, 390, 768, and 1280px, once with a dark
system setting and once with reduced motion:

- More or fewer than one `h1`, an empty heading, or a landing `h1` that is not
  "Find the common ground." or is under 32px
- Any sideways overflow, or any visible element crossing the viewport edge (wide tables scroll
  inside `.metrics__scroll`)
- A hero taller than the screen, or its header, `h1`, subhead, or waitlist below the fold
- Text under AA contrast or under 12px
- A control under 44px in either dimension
- A console error, an uncaught script error, a request to another origin, or a cookie
- A hero scene that does not draw, or that loads under reduced motion
- A change to the preview's wording or steps. `exercisePreview` matches the signal labels,
  button text, and notes literally, and the waitlist and `/metrics` checks match theirs. When
  you change that copy on purpose, update `check.mjs` in the same change.

So: fonts and images are self-hosted under `site/public/`, nothing loads from a CDN, and no
embed, analytics script, or font service is added.

## Workflow

1. State in one sentence what the change is for and which existing section it belongs to. If it
   needs a new section, say what the visitor learns there that they do not learn above.
2. Reuse tokens, kit primitives, and existing page classes. Write new CSS only for what is left.
3. Build and check:

   ```bash
   npm --prefix site run build
   node site/check.mjs --shots site/.shots
   ```

   If the kit changed, also run `npm --prefix widget run typecheck` and
   `npm --prefix widget run build`.
4. Open the screenshots (`phone-small-fold.png` and `desktop-fold.png` first) and look at them.
   The check proves the rules above; it does not prove the page looks right.
5. Report what ran and what you looked at. If Chrome or Node 22 was unavailable and the check
   did not run, say so.

For a critique against general UI principles, pair this with the sibling `apple-design` skill
using its web foundations. This skill wins where they differ on the site's established look.
`turbota-new-startup-design-from-nazarii` is an optional direction and applies only when the
user asks for it.
