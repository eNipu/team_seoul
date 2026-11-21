# Heldly site

The public landing page for Heldly. Static files in `public/`, plus one bundled script built from `src/`.

| Path | What it is |
| --- | --- |
| `public/index.html`, `public/styles.css` | The page |
| `public/js/` | Build output from `src/`. Committed, so the deploy needs no build step |
| `public/fonts/caveat-600.woff2` | Caveat, for the one handwritten note. SIL Open Font License, see `Caveat-OFL.txt` |
| `src/main.js` | Booking example, signal card, and loading of the 3D scene |
| `src/scene.js` | The 3D network in the hero, built with three.js (MIT) |
| `check.mjs` | Browser checks |

## Build, preview, check

```bash
cd site
npm install
npm run build                                  # writes public/js/
python3 -m http.server 8090 -d public          # http://localhost:8090
node check.mjs                                 # needs Node 22+ and Chrome
node check.mjs --shots /tmp/heldly-shots       # also saves full-page screenshots
node check.mjs --url https://<host>/           # check a deployed copy
```

`check.mjs` loads the page at 360, 768 and 1280 px in light and dark, plus once with reduced motion. It fails on:
an empty or missing heading, sideways overflow, text below WCAG AA contrast, text under 13 px, a control under 44 px,
a console error, a request to another origin, a cookie, a broken step in the booking example, a 3D scene that draws
nothing, or a scene that keeps moving when reduced motion is on.

## The 3D scene

Your network as a slowly turning cloud of about 150 contacts. Most are cold blue-grey. Every 3.4 seconds one warms
to coral, a line draws to it from "you" at the centre, and the card underneath names the person and what changed.
The colours are read from the CSS tokens, so the scene follows light and dark mode.

- Loaded as a separate chunk (about 535 KB minified) only if the browser has WebGL 2. Without it, the stage shows
  a still dot pattern.
- Stops rendering when it is off screen or the tab is hidden.
- With reduced motion, it draws one still frame with five warm contacts and never animates.
- Drag sideways to turn it. Vertical swipes still scroll the page.
- The figure has a text description for screen readers; the canvas and the changing card are hidden from them.

## Deploy

Railway project `heldly`, service `site`. Railpack serves `public/` as a static site.

```bash
npm run build && node check.mjs
railway up ./site/public --path-as-root --service site -m "what changed"
node site/check.mjs --url https://site-production-4ef8eb52.up.railway.app/
```

## What the copy may claim

The page describes the product the team is building, and the Status section says which parts work today. Keep that
section true when the product changes.

| Claim | Status | Source |
| --- | --- | --- |
| Saves only what you approve | Works | `backend/app/services/memory_service.py` |
| Connect by invite code | Works | `backend/app/services/social_service.py` |
| Find who you haven't seen in a while | Works | `reconnection_suggestions` in the same file |
| Claude support | In development | `Heldly PRD.md`, section 3 |
| Searching your network's updates | In development | `Heldly PRD.md`, section 6.3 |
| Booking on both calendars | In development | `Heldly PRD.md`, section 7 |
| Visibility only between mutual connections | Design | `Heldly idea memo.md`, `Heldly PRD.md` section 8.1 |

The people in the examples and the hero card are made up, and the footer says so.

## Design notes

Colour has one job: warm is a connection that is active again, cold is one that has gone quiet. Navigation, body
text and the main button are ink on paper. Body type is the system stack; Caveat appears once, as the handwritten
note in the hero, and never carries information.

| Token | Light | Dark | Contrast on paper (light / dark) |
| --- | --- | --- | --- |
| `--ink` | `#15181c` | `#eceef0` | 16.3 / 16.0 |
| `--ink-2` | `#505862` | `#a4adb7` | 6.6 / 8.2 |
| `--warm` (graphics) | `#dc5a39` | `#f0805f` | 3.5 / 7.1 |
| `--warm-ink` (text) | `#a8391d` | `#ff9f84` | 5.9 / 9.4 |
| `--warm-solid` (button fill) | `#bf4326` | `#f0805f` | text on it: 5.2 / 7.1 |
| `--cold` (graphics) | `#647a92` | `#7f95ad` | 4.1 / 6.0 |
| `--cold-ink` (text) | `#465a70` | `#a9bbcf` | 6.5 / 9.5 |

Structure follows boardy.ai's page (statement, how it works, example, trust, call to action), but the layout, copy,
code and every asset are Heldly's own.
