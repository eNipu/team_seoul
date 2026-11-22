# Venn website

The Venn web app: the second way into Venn, next to the ChatGPT plugin. Same account, same
saved records (people, memories, follow-ups, plans). On the website you start with a person or
a plan instead of a chat. Private ChatGPT conversations and ChatGPT's own memory are not synced.

React 19 + TypeScript + Vite, no other runtime dependencies, no remote assets. It talks to the
JSON API described in `../docs/WEB_API.md` on the same origin (`/api/v1/...`).

## Run

```sh
npm install
npm run dev        # Vite dev server at http://localhost:5173/app/ ; /api is proxied to http://127.0.0.1:8000
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build  ->  dist/index.html + dist/assets/*
npm run preview    # Vite's preview of dist
npm run serve      # node scripts/serve.mjs [port]: serves dist the way the backend does (see below)
```

The build uses `base: "/app/"`. The backend serves `web/dist` at `/app`, files under
`/app/assets/` as they are, and `index.html` for every other path under `/app/`, so the app uses
ordinary History-API URLs with a small router of its own (`src/router.tsx`).

## Demo mode

Add `?demo=1` to any URL: the app uses an in-memory mock of the API (`src/mockApi.ts`) and skips
sign-in. The flag is kept across in-app navigation. Nothing is stored; a reload resets the data.
It is seeded with the investor demo: account "Gene", Maya Chen, the memory "Photo walks with
Maya", and a search for "photography" that returns Maya with the reason she matched.

Extra demo-only flags:

| URL | Shows |
| --- | --- |
| `/app?demo=1` | Signed in as Gene with the seeded circle |
| `/app?demo=1&fresh=1` | A brand-new account (first-run welcome) |
| `/app?demo=1&signedout=1` | The sign-in screen. `gene` exists; any other valid username leads to "Create account" |
| `/app?demo=1&signedout=1&passcode=1` | Sign-in with a passcode field (`venn` works, `locked` answers 429) |
| `/app?demo=1&external=1` | "Sign-in on this site isn't set up for this server." |

Without `?demo=1` and without a backend the app shows "This copy of the site isn't connected to
a Venn server." with a link to the demo.

## Sign-in

On load the app calls `GET /api/v1/session`. Signed out and `sign_in_available` → the sign-in
screen (username, passcode only when `passcode_required`). A 404 `NOT_FOUND` on sign-in offers
"Create account" as an explicit second step. Any later 401 returns to the sign-in screen at the
same URL, so signing in continues where the user was. Sign out is `DELETE /api/v1/session`.

## Routes

| Path | Screen |
| --- | --- |
| `/app` | Home (or first-run welcome) |
| `/app/people` | People (`?new=1` opens "Add a person", `?import=1` opens "Import a list", `?linkedin=1` opens "Import from LinkedIn") |
| `/app/people/person/<id>`, `/app/people/connection/<id>` | Person page with the Venn diagram |
| `/app/memories` | Memories (`?q=` keyword search, `?new=1` opens "Add a memory") |
| `/app/search?q=…` | Search results with the reason each person came up |
| `/app/follow-ups` | Open follow-ups |
| `/app/plans` | Plans (`?new=1` opens "New plan") |
| `/app/answers` | Answers from question links, and the links |
| `/app/account` | Profile, "Use Venn in ChatGPT", connect with friends, sign out, delete account |
| anything else | 404 page |

In **People → Import from LinkedIn → Demo connections**, review up to 100 fictional connections
without LinkedIn cookies or an export file. Choose profiles individually or click **Select all**, then confirm. On a signed-in account they are saved as private sample notes;
use **Home → Remove sample data** to clear them. To try the flow without persisting anything, open
`/app/people?demo=1&linkedin=1` instead.

## Source layout

- `src/api.ts` — typed client for every route (`X-Venn-Request: 1` on mutating requests,
  `{error:{code,message}}` handling, 401 hook); picks the mock in demo mode.
- `src/mockApi.ts` — the stateful in-memory mock with the same interface.
- `src/types.ts` — payload types and defensive parsers (adapted from `widget/src/types.ts`).
- `src/App.tsx` — session gate, shell (sidebar, top bar with global search, mobile tab bar), routes.
- `src/pages/` — one file per screen. `src/VennDiagram.tsx` — the two-circle SVG.
- `src/ui.tsx` — shared pieces (data loading, toasts, dialogs, form fields, copy buttons).
- `src/icons.tsx`, `src/calendar.ts`, `src/QrCode.tsx`, `src/styles.css` tokens — copied from
  `widget/src` so both surfaces look like one product. Nothing is imported across packages.

## Testing the build in a browser

`scripts/serve.mjs` is a dependency-free static server that maps `/app/*` to `dist` with the
`index.html` fallback (it has no API, so use `?demo=1`). `scripts/shots.mjs` drives headless
Chrome over the DevTools protocol against it: it runs steps, prints console errors, checks
horizontal overflow, text contrast and touch-target sizes, and writes screenshots.

```sh
npm run build
node scripts/serve.mjs 4173 &
node scripts/shots.mjs jobs.json   # job format is documented at the top of the script
```
