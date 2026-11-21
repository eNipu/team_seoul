# Heldly site

The public landing page for Heldly. Static files in `public/`, plus one bundled script built from `src/`.

| Path | What it is |
| --- | --- |
| `public/index.html`, `public/styles.css` | The page |
| `public/js/` | Build output from `src/`. Committed, so the deploy needs no build step |
| `public/fonts/` | Bricolage Grotesque (headings) and Caveat (one handwritten note). Both SIL Open Font License; the licence texts sit beside them |
| `public/grain.png` | The paper grain behind the page, 96 px tile |
| `src/data.js` | The made-up interests and people used by the scene and the example |
| `src/main.js` | The "inside ChatGPT" example, the card under the scene, and loading of the scene |
| `src/scene.js` | The 3D picture in the hero, built with three.js (MIT) |
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

The product idea as one picture. About 130 small dots, each a memory, drift in and gather into five interest
clusters around "you". The people you know sit between the two interests they share with you. Every few seconds one
person lights up in coral, lines draw to those interests and to you, and the card underneath gives one way to keep
that connection alive.

- WebGL draws the dots and lines. Cluster washes and labels are HTML positioned from the same 3D points, so the
  text stays sharp. Colours are read from the CSS tokens, so the scene follows light and dark mode.
- Loaded as a separate chunk (about 145 KB compressed) only if the browser has WebGL 2. Without it, the stage
  shows a still dot pattern.
- Stops rendering when it is off screen or the tab is hidden.
- With reduced motion, it draws one still frame, already gathered, and never animates.
- Drag sideways to turn it a little. Vertical swipes still scroll the page.
- The figure has a text description for screen readers; the canvas, labels and changing card are hidden from them.

## Deploy

Railway project `heldly`, service `site`. Railpack serves `public/` as a static site.

```bash
npm run build && node check.mjs
railway up ./site/public --path-as-root --service site -m "what changed"
node site/check.mjs --url https://site-production-4ef8eb52.up.railway.app/
```

## What the copy may claim

The page describes the product the team is building, and the "Where it stands" section says which parts work today.
Keep that section true when the product changes.

| Claim | Status | Source |
| --- | --- | --- |
| Saves only the memories you approve | Works | `heldly_propose_memories`, `heldly_save_memories` |
| Searching what you've saved | Works | `heldly_search_memories` |
| Adding people, connecting by invite code | Works | `heldly_add_person`, `heldly_create_invite` |
| Reminders to reconnect, with ideas | Works | `heldly_reconnection_suggestions`, `heldly_suggest_activity` |
| Shows its own cards in the chat | Works | `widget/` |
| Interest clusters | In development | Not in the code yet |
| Suggestions for how a connection could help | In development | Not in the code yet |
| It can't read your chats | True by design | An MCP server only receives the arguments of a tool call |
| It never contacts anyone for you | Works | `README.md`, `plugin/skills/heldly-social/SKILL.md` |

The page does not say Heldly gathers conversations. It can't, and ChatGPT's plugin rules don't allow it; it gathers
what the user asks it to remember. The people in the examples are made up, and the footer says so.

## Design notes

Air first: one idea per section, centred, with a lot of space between sections. Texture comes from a paper grain
and two soft colour washes behind the hero. The page is graphic rather than wordy: the scene, three small drawings
for the three steps, and a working example.

Colour has one job: warm is the connection in focus, cold is everything at rest. Headings are Bricolage Grotesque;
body text is the system stack; Caveat appears once, as the handwritten note, and never carries information.

| Token | Light | Dark | Contrast on paper (light / dark) |
| --- | --- | --- | --- |
| `--ink` | `#15181c` | `#eceef0` | 16.3 / 16.0 |
| `--ink-2` | `#505862` | `#a4adb7` | 6.6 / 8.2 |
| `--warm` (graphics) | `#dc5a39` | `#f0805f` | 3.5 / 7.1 |
| `--warm-ink` (text) | `#a8391d` | `#ff9f84` | 5.9 / 9.4 |
| `--warm-solid` (button fill) | `#bf4326` | `#f0805f` | text on it: 5.2 / 7.1 |
| `--cold` (graphics) | `#647a92` | `#7f95ad` | 4.1 / 6.0 |
| `--cold-ink` (text) | `#465a70` | `#a9bbcf` | 6.5 / 9.5 |

The airy, centred rhythm takes its cue from boardy.ai. The layout, copy, code and every asset are Heldly's own.
