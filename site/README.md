# Venn site

The public landing page for Venn ("Find the common ground."), its Founding Circle waitlist, and the launch
metrics page. A Next.js app (App Router) with its own small API and two tables in Postgres.

| Path | What it is |
| --- | --- |
| `app/page.tsx` | The landing page: hero with the waitlist, the "Inside ChatGPT" preview, principles |
| `app/metrics/page.tsx` | `/metrics`: unique visitors, total waitlist signups, activation rate, UTM and referral breakdown |
| `app/api/waitlist/route.ts` | `POST` joins the waitlist, `GET ?code=` returns the current spot for an invite code |
| `app/api/visit/route.ts` | `POST` records one page view |
| `proxy.ts` | Password check in front of `/metrics` (Next.js 16 calls middleware "proxy") |
| `app/globals.css` | The page's own styles |
| `app/venn-kit.css` | Copy of `widget/src/venn-kit.css`: tokens and card primitives shared with the ChatGPT widget. Do not edit here |
| `components/VennScene.tsx` | The 3D hero background, built with three.js (MIT) |
| `components/HeroBackdrop.tsx` | Loads the scene lazily and holds its CSS fallback |
| `components/HeroCollage.tsx` | Optional hero visual: two overlapping portraits and their shared ground |
| `components/Waitlist.tsx` | The email form and its confirmation state |
| `components/ChatPreview.tsx` | The two-step preview: Memory Sync card, then Common Ground Match card |
| `lib/db.ts`, `lib/waitlist.ts`, `lib/analytics.ts` | Postgres pool and schema, waitlist logic, events and metrics |
| `lib/rate-limit.ts` | Per-address request limit for the API routes |
| `public/fonts/` | Inter (SIL Open Font License, text beside it), used only where SF Pro is not available |
| `check.mjs` | Browser checks |

## Build, preview, check

```bash
cd site
npm install
npm run build                       # copies the kit from ../widget, then next build
npm run start                       # http://localhost:3000 (PORT overrides)
npm run dev                         # the same with hot reload
node check.mjs                      # needs Node 22+, Chrome, and a build
node check.mjs --shots .shots       # also saves screenshots
node check.mjs --url https://<host>/   # check a running or deployed copy
```

The waitlist and `/metrics` need Postgres. For a local database:

```bash
docker run -d --rm --name venn-site-pg -e POSTGRES_PASSWORD=venn -e POSTGRES_DB=venn -p 127.0.0.1:55432:5432 postgres:16-alpine
export DATABASE_URL=postgresql://postgres:venn@127.0.0.1:55432/venn
npm run build && node check.mjs     # now also signs up once and checks the confirmation
```

Without `DATABASE_URL` the page still renders, the form answers "The waitlist isn't open yet", page views are
not recorded, and `/metrics` says so. Nothing is kept in memory as a substitute, so a missing database can never
silently drop signups.

`check.mjs` loads the page at 360, 390, 768 and 1280 px, plus once in dark mode and once with reduced motion. It
fails on: a missing or empty heading, sideways overflow, a hero that does not fit in the first screen, text below
WCAG AA contrast, text under 12 px, a control under 44 px, a console error, a request to another origin, a
cookie, a broken step in the preview, a hero scene that does not draw, a scene that loads when reduced motion
is on, a `/metrics` that opens without the password, or a waitlist that never answers 429. It never submits the
waitlist against `--url`, so checking production does not add a signup. To include `/metrics` in a `--url` run,
pass the password: `METRICS_PASSWORD=... node check.mjs --url https://<host>/`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required in production |
| `METRICS_PASSWORD` | Password for `/metrics`. Required in production: without it `/metrics` answers 503 |
| `ANALYTICS_SALT` | Optional secret mixed into visitor hashes. Falls back to `DATABASE_URL` |
| `PORT` | Port for `npm run start` (Railway sets it) |

`.env.example` lists them; copy it to `.env.local` for local work.

## Waitlist

`POST /api/waitlist` with `{ email, utm_source?, utm_content?, ref? }` stores one row in `waitlist_signups`
(`email`, `utm_source`, `utm_content`, `ref`, `ref_code`, `created_at`) and answers
`{ position, refCode, referrals }`. The form reads `utm_source`, `utm_content` and `ref` from the page URL.

- Joining twice with the same email is not an error and returns the same spot. The response does not say
  whether the email was already there.
- `ref_code` is the person's own invite code; their link is `/?ref=<code>`. `ref` is the code they arrived with.
- The number shown is `100 +` the person's place. People are ordered by how many signups their link brought in,
  then by who joined first. So a new signup is `100 + the total count`, and inviting really does move you up.
- The browser remembers the spot (number and invite code, never the email) in `localStorage`, and refreshes it
  from `GET /api/waitlist?code=` on the next visit.
- Rate limit: 10 signup tries per address per 10 minutes, then `429` with `Retry-After`. Lookups are limited to
  30 a minute. The counts live in the server process (`lib/rate-limit.ts`), which fits the single Railway
  instance; with more than one instance, move them to Postgres. The address is read from `X-Real-IP`, then
  `X-Forwarded-For`. Checked on the deployed site: Railway's edge replaces both, so a client cannot pick its
  own address.
- Not covered: emails are not confirmed, so someone with many addresses can still add fake signups and move up
  the list. Confirming needs an email provider.

The schema is created on first use (`lib/db.ts`); there is no migration step. The tables are named so they can
live in the same database as the MCP backend, which has its own `analytics_events`.

## Analytics and `/metrics`

First-party only: no third-party scripts, no cookies, nothing stored on the device for tracking.

- `lib/analytics.ts` records two events in `site_events`: `page_view` (from `components/PageView.tsx`) and
  `core_action_completed` (fired by the server when a new email joins the waitlist).
- A visitor is a hash of IP address and user agent with a salt that changes every day. The raw IP is not stored.
  The same person on two days counts as two visitors. Page views from bots and headless browsers are not
  counted; a signup always is.
- Activation Rate is visitors with `core_action_completed` divided by all visitors.
- `/metrics` asks for a password (HTTP Basic auth, any user name, `METRICS_PASSWORD`). In production it stays
  closed with a 503 until the variable is set. `next dev` opens it without one.
- It shows counts only: no emails. Invite codes appear in the referral table.

## The hero scene

Two glass spheres orbit each other slowly; the volume they share is lit in a third color. It sits behind the
hero as a full-bleed background that ignores the pointer, under a radial veil that keeps the text contrast high.

- A CSS version (two blended circles) is in the HTML and paints first. three.js is a separate chunk loaded with
  `next/dynamic` and `ssr: false` once the page is idle, and the canvas fades in after its first frame.
- The CSS version stays when the visitor asks for reduced motion or data saving, or when WebGL is unavailable.
- Two spheres and one small shader. The pixel ratio is capped at 1.75, and rendering stops when the hero is off
  screen or the tab is hidden.
- The colors come from the kit tokens `--venn-a`, `--venn-b` and `--venn-shared`.

## The hero collage

`COLLAGE` in `app/page.tsx` fills the optional slot under the form. Give either person an `image` (a square
portrait under `public/`) to show a photo instead of initials, or set `COLLAGE` to `null` to remove it. It is
shown only when the hero has room (at least 720 px wide and 800 px tall), so it never pushes the form below the
fold on a phone.

## Shared styling with the widget

`widget/src/venn-kit.css` is the single source for the design tokens and the card primitives (`.panel`, `.card`,
`.btn`, `.badge`, `.chip`, `.avatar`, `.check`, `.pick`, `.venn-pair`, `.lock-note`). The widget imports it
directly. `npm run build` here copies it to `app/venn-kit.css` (`scripts/sync-kit.mjs`), and the copy is
committed because Railway uploads `site/` on its own. Change the widget file, build both, commit both.

The landing page is light only (`<html data-theme="light">`); the widget keeps light and dark for the host.

## Deploy

Railway project `heldly` (it still has the old product name; renaming it there is cosmetic), service `site`.
Railpack detects Next.js and runs `npm run build` and `npm run start`. The upload root is `site/`.

The service has `DATABASE_URL` (a reference to the project's `Postgres` service, shared with the backend),
`METRICS_PASSWORD` and `ANALYTICS_SALT`. Read the metrics password in the service's Variables tab. Postgres
has no public address; the site reaches it over Railway's private network.

```bash
npm run build && node check.mjs
railway up ./site --path-as-root --service site -m "what changed"
node site/check.mjs --url https://site-production-4ef8eb52.up.railway.app/
```

## What the copy may claim

The page describes the product the team is building and says, under the preview, that it is in development.
Keep the page true when the product changes.

| Claim | Status | Source |
| --- | --- | --- |
| Saves only what you approve | Works | `venn_propose_memories`, `venn_save_memories` |
| Shows its own cards in ChatGPT | Works | `widget/` |
| It never contacts anyone for you | Works | `README.md`, `plugin/skills/venn-social/SKILL.md` |
| Memory Sync card with these four signals, sensitive info off by default | Preview | The real card is the memory review card; `Looking for` and `Can help with` are T08 |
| Common Ground Match card, "Draft warm intro" | In development | T10 to T12 |
| "Your AI knows what you're building" | True by design | ChatGPT extracts; Venn only receives what a tool call passes and the user approves |
| "We only email you about your invite" | A promise the team must keep | `waitlist_signups` holds the emails |

The people in the examples are made up, and the footer says so. There is no privacy page yet (T17), and the
waitlist now collects email addresses.
