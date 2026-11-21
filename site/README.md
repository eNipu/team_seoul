# Heldly site

The public page for Heldly. Three static files in `public/` (`index.html`, `styles.css`, `demo.js`) plus the logo.
There is no build step and there are no dependencies.

## Preview and check

```bash
python3 -m http.server 8090 -d site/public   # http://localhost:8090
node site/check.mjs                           # browser checks, needs Node 22+ and Chrome
node site/check.mjs --shots /tmp/heldly-shots # same, plus full-page screenshots
node site/check.mjs --url https://<host>/     # run the checks against a deployed copy
```

`check.mjs` loads the page at 360, 768 and 1280 px in light and dark and fails on: an empty or missing heading,
horizontal overflow, text below WCAG AA contrast, text under 13 px, a control under 44 px, a console error, a request
to another origin, or a cookie. It also clicks through the example card.

## Deploy

The page runs on Railway as the `site` service of the `heldly` project. Railpack sees `index.html` and serves the
folder as a static site.

```bash
railway up ./site/public --path-as-root --service site -m "what changed"
```

## What the copy may claim

Every statement on the page is taken from the code or the docs in this repository. If the product changes, change the
page with it.

| Claim on the page | Source |
| --- | --- |
| Nothing is saved until approved; private by default | `backend/app/services/memory_service.py`, `docs/SECURITY.md` |
| Invite codes last 72 hours; the inviter accepts the request | `backend/app/config.py` (`invite_ttl_hours`), `docs/ARCHITECTURE.md` |
| Reconnection list starts at three weeks, longest gap first | `reconnection_suggestions` in `backend/app/services/social_service.py` |
| Up to three activity ideas from interests both people shared | `suggest_activity` in the same file |
| Text may be sent to OpenAI's API to draft suggestions | `backend/app/ai/extraction.py` (when `OPENAI_API_KEY` is set) |
| Passwords, card numbers and API keys are refused | `contains_sensitive` in `backend/app/ai/extraction.py` |
| Heldly never contacts anyone | `README.md`, `plugin/skills/heldly-social/SKILL.md` |
| No cookies, nothing loaded from other sites | the CSP in `index.html`; enforced by `check.mjs` |

The page does not mention Claude, scheduling or communities. None of them is in the code yet.

## Design notes

Colour has one job: warm means kept or recent, cold means gone quiet. Navigation, body text and the main button are
ink on paper. Type is the widget's system stack, so the page and the widget read as one product and no font is
downloaded. Light and dark follow the visitor's system setting.

| Token | Light | Dark | Contrast on paper (light / dark) |
| --- | --- | --- | --- |
| `--ink` | `#15181c` | `#eceef0` | 16.3 / 16.0 |
| `--ink-2` | `#505862` | `#a4adb7` | 6.6 / 8.2 |
| `--warm` (graphics) | `#dc5a39` | `#f0805f` | 3.5 / 7.1 |
| `--warm-ink` (text) | `#a8391d` | `#ff9f84` | 5.9 / 9.4 |
| `--warm-solid` (button fill) | `#bf4326` | `#f0805f` | text on it: 5.2 / 7.1 |
| `--cold` (graphics) | `#647a92` | `#7f95ad` | 4.1 / 6.0 |
| `--cold-ink` (text) | `#465a70` | `#a9bbcf` | 6.5 / 9.5 |

The example card copies the wording and the flow of `widget/src/components/MemoryReview.tsx`. If that component
changes, update the card.
