# Venn site

The public landing page for Venn ("Venn. Connect your AI memories."), its Founding Circle waitlist, and the launch
metrics page. A Next.js app (App Router) with its own small API and two tables in Postgres.

| Path | What it is |
| --- | --- |
| `app/page.tsx` | The landing page: hero with the waitlist, use cases and FAQ. Rendered per request, because it reads `?w=` and `?ref=` |
| `app/metrics/page.tsx` | `/metrics`: unique visitors, total waitlist signups, activation rate, UTM and referral breakdown |
| `app/api/waitlist/route.ts` | `POST` joins the waitlist, `GET ?code=` returns the current spot for an invite code |
| `app/api/visit/route.ts` | `POST` records one page view |
| `proxy.ts` | Password check in front of `/metrics` (Next.js 16 calls middleware "proxy") |
| `app/globals.css` | The page's own styles |
| `app/venn-kit.css` | Copy of `widget/src/venn-kit.css`: tokens and card primitives shared with the ChatGPT widget. Do not edit here |
| `components/HeroBackdrop.tsx` | What sits behind the join panel: still CSS circles first, then the 3D scene once the page is idle |
| `components/VennScene.tsx` | The 3D scene: two glass spheres orbiting each other, built with three.js (MIT) |
| `components/Motion.tsx` | Turns on the scroll reveals for elements marked `data-reveal` |
| `components/Waitlist.tsx` | The email form and its states after joining |
| `app/how-it-works/page.tsx`, `components/OnboardingPreview.tsx` | Product walkthrough and four-step sample onboarding |
| `components/ChatGptPreview.tsx` | Embeds the actual Venn widget using its in-memory sample bridge |
| `lib/db.ts`, `lib/waitlist.ts`, `lib/analytics.ts` | Postgres pool and schema, waitlist logic, events and metrics |
| `lib/version.ts` | The two waitlist versions, `pair` and `open`, and which one is the default |
| `lib/rate-limit.ts` | Per-address request limit for the API routes |
| `public/fonts/` | Inter (SIL Open Font License, text beside it), used only where SF Pro is not available |
| `check.mjs` | Browser checks |

## Build, preview, check

```bash
cd site
npm install
npm run build                       # checks the site kit, then runs Next.js build
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
npm run build && node check.mjs     # now also joins both versions and checks every waitlist state
```

Without `DATABASE_URL` the page still renders, the form answers "The waitlist isn't open yet", page views are
not recorded, and `/metrics` says so. Nothing is kept in memory as a substitute, so a missing database can never
silently drop signups.

`check.mjs` loads the page at 360, 390, 768 and 1280 px, plus once in dark mode and once with reduced motion. It
checks headings, overflow, signup visibility on the first screen, WCAG AA text contrast, 12 px minimum text,
44 px controls, console errors, cross-origin requests, cookies other than the consent-region cookie, the hero
fallback, section navigation, the sample onboarding, `/metrics` authentication, and the waitlist rate limit.
With `DATABASE_URL`
it also walks the waitlist on the smallest phone: joining alone with real key presses (Tab to the field,
Enter, focus on the answer, Tab through both actions, each with a focus ring), arriving with that link (invited, then
both confirmed), coming back as the first person, a link nobody owns, and the open version. Each state must
read as written in `docs/tasks/WAITLIST.md` and end above the fold. It never submits the
waitlist against `--url`, so checking production does not add a signup. To include `/metrics` in a `--url` run,
pass the password: `METRICS_PASSWORD=... node check.mjs --url https://<host>/`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required in production |
| `METRICS_PASSWORD` | Password for `/metrics`. Required in production: without it `/metrics` answers 503 |
| `ANALYTICS_SALT` | Optional secret mixed into visitor hashes. Falls back to `DATABASE_URL` |
| `WAITLIST_VERSION` | `pair` (the default) or `open`: the waitlist a visitor gets without `?w=` in the URL |
| `PORT` | Port for `npm run start` (Railway sets it) |
| `WIDGET_PREVIEW_URL` | Absolute URL of the Venn demo iframe. Defaults to `https://app.joinvennai.com/widget-preview`. For local end-to-end checks use the local backend URL. |
| `CHATGPT_PLUGIN_URL` | Verified, published ChatGPT directory listing. When absent the site offers the beta test connection. |

`.env.example` lists them; copy it to `.env.local` for local work.

## Waitlist

The rules, the response shape and every sentence a visitor reads are written once, in
`docs/tasks/WAITLIST.md`. In short, there is one list with two versions:

- `pair`: a place is held (`pending`) until one person joins with your link, then both are confirmed.
- `open`: confirmed on joining. Inviting is optional and moves you up the list.

A page shows `WAITLIST_VERSION`, or the version in its URL: `/?w=pair` or `/?w=open`. Share one link of each
to compare them; `/metrics` splits its numbers by version. Anyone can add `?w=open` to skip the +1. That is
accepted: nobody is turned away, and a pending signup is stored like any other.

`POST /api/waitlist` with `{ email, version?, utm_source?, utm_content?, ref? }` stores one row in
`waitlist_signups` (`email`, `utm_source`, `utm_content`, `ref`, `ref_code`, `created_at`, `version`,
`invited_by`, `confirmed_at`) and answers
`{ position, refCode, referrals, status, version, circle, invitesLeft }`. The form sends the page's version and
reads `utm_source`, `utm_content` and `ref` from the page URL.

- Joining twice with the same email is not an error and returns the same spot, unchanged. The response does
  not say whether the email was already there.
- `ref_code` is the person's own invite code; their link is `/?ref=<code>`. `ref` is the code they arrived with.
- Someone who arrives with a link that has room is attached to it (`invited_by`) and confirmed in either
  version, and a pending owner of that link is confirmed too. A link has room for 4 people, or 3 if its owner
  was invited, so a circle is at most 5. With a full or unknown link the person joins as if they had none;
  `ref` is still stored. The owner's row is locked while this is decided, so two people cannot both take
  the last place.
- `confirmed_at` is empty while a place is held. Venn sends nothing when it is filled: the first person sees
  it the next time they open the page.
- `app/page.tsx` looks a `?ref=` up before the page is sent, so an invited person reads "Someone saved you a
  place." on first paint and is never told who invited them. A full or unknown link says so instead.
- In the open version the number shown is `100 +` the person's place. People are ordered by how many signups
  their link brought in, then by who joined first. So a new signup is `100 + the total count`, and inviting
  really does move you up. The pair version shows no number.
- The browser remembers the spot (the invite code and the counts, never the email) in `localStorage`, and
  refreshes it from `GET /api/waitlist?code=` on the next visit. A spot saved before the two versions existed
  is still read.
- A database from before the two versions is upgraded on first use (`lib/db.ts`): everyone already on the list
  is `open` and confirmed, and attached to the link they came with while it has room.
- Rate limit: 10 signup tries per address per 10 minutes, then `429` with `Retry-After`. Lookups are limited to
  30 a minute. The counts live in the server process (`lib/rate-limit.ts`), which fits the single Railway
  instance; with more than one instance, move them to Postgres. The address is read from `X-Real-IP`, then
  `X-Forwarded-For`. Checked on the deployed site: Railway's edge replaces both, so a client cannot pick its
  own address.
- Not covered: emails are not confirmed, so someone with many addresses can still add fake signups, move up
  the list, or be their own +1. Confirming needs an email provider.

The schema is created on first use (`lib/db.ts`); there is no migration step. The tables are named so they can
live in the same database as the MCP backend, which has its own `analytics_events`.

## Analytics and `/metrics`

First-party only: no third-party scripts, no cookies, nothing stored on the device for tracking.

- `lib/analytics.ts` records two events in `site_events`: `page_view` (from `components/PageView.tsx`) and
  `core_action_completed` (fired by the server when a new email joins the waitlist). Both carry the waitlist
  version the page showed.
- A visitor is a hash of IP address and user agent with a salt that changes every day. The raw IP is not stored.
  The same person on two days counts as two visitors. Page views from bots and headless browsers are not
  counted; a signup always is.
- Activation Rate is visitors with `core_action_completed` divided by all visitors.
- Confirmed Signups counts rows with `confirmed_at`; the rest are pending. Pairs Formed counts people whose
  link has at least one person attached. Confirmed Rate is confirmed signups divided by all visitors.
- "By waitlist version" takes visitors from page views and signups from the list, each by version. The two
  are counted differently (a daily hash against a row per email), so read the rate as a comparison between
  the versions, not as an exact share. Visits and signups from before the versions existed count as `open`,
  under the old page copy.
- `/metrics` asks for a password (HTTP Basic auth, any user name, `METRICS_PASSWORD`). In production it stays
  closed with a 503 until the variable is set. `next dev` opens it without one.
- It shows counts only: no emails. Invite codes appear in the referral table.

## Hero and onboarding

The hero has the copy and chat example on the left and the join panel on the right, over two glass
spheres in the brand yellow and red that orbit each other in 3D. On a phone signup appears before the
chat example. Invitation and confirmation panels sit immediately below the subtitle to keep their controls
within reach. A CSS version of the circles is in the HTML and paints first;
three.js is a separate chunk loaded once the page is idle. The still version stays for reduced motion, data
saving and no WebGL, and rendering stops when the scene is off screen or the tab is hidden.

Motion (`app/globals.css` › Motion) always plays into the finished page, so nothing is hidden without script
or with reduced motion: the hero arrives line by line, the underline is drawn and the highlight swept in, and
sections fade up the first time they scroll into view (`data-reveal="up"`, or `"group"` for children in turn).

The landing page links to [How it works](/how-it-works) and the [ChatGPT demo](/chatgpt).
The ChatGPT demo uses the same built widget that the MCP resource serves. Its sandboxed iframe
uses sample data and stores changes only in its own tab state.

On /how-it-works, the visitor selects sample memories, sends a simulated invite, accepts it as Maya,
and sees the interests they share. A single SVG illustrates the four steps. With reduced motion,
the SVG jumps to each state. Back preserves the memory selection, and Restart clears it.
The demo stores no choices. The last step links back to the real waitlist.

## Shared styling with the widget

The landing page uses its own `app/venn-kit.css` for the site palette and primitives. Its build verifies
that the file exists. The ChatGPT widget uses `widget/src/venn-kit.css`.

The landing page is light only (`<html data-theme="light">`); the widget keeps light and dark for the host.

## Deploy

Railway deploys the `site` service in the `heldly` project's `production` environment from
`eNipu/team_seoul` on `main`. The root directory is `/site` and the watch path is `/site/**`,
measured from the repository root. Railpack detects Next.js and runs `npm run build` and
`npm run start`. Open feature pull requests against `dev` and promote releases by merging
`dev` into `main`.

The service has `DATABASE_URL` (a reference to the project's `Postgres` service, shared with the backend),
`METRICS_PASSWORD` and `ANALYTICS_SALT`. Read the metrics password in the service's Variables tab. Postgres
has no public address; the site reaches it over Railway's private network.

```bash
npm --prefix site run build
node site/check.mjs --url https://joinvennai.com/
```

## What the copy may claim

The page labels the onboarding as a preview and tells visitors that their choices are not saved.
Keep the page true when the product changes.

| Claim | Status | Source |
| --- | --- | --- |
| Saves only what you approve | Works | `venn_propose_memories`, `venn_save_memories` |
| Shows its own cards in ChatGPT | Works | `widget/` |
| It never contacts anyone for you | Works | `README.md`, `plugin/skills/venn-social/SKILL.md` |
| "Connect your AI memories." | Works for approved ChatGPT memories | `venn_import_chatgpt_memory`, memory review and save |
| Review, accept, and find shared interests | Preview with a sample person | Memory review, invite redemption and acceptance, `venn_compare` |
| "We only email you about your invite" | A promise the team must keep | `waitlist_signups` holds the emails. Nothing is sent today |
| "A confirmed place for both of you", "Your places in the Founding Circle are confirmed" | A promise the team must keep | `confirmed_at`. Whoever opens Venn to the list must honour it |
| "Someone saved you a place" | Works | Shown only when the link exists and has room (`inviteHasRoom`) |
| "You join with one person you know" | True of the pair version | A place stays pending until a +1 joins; `?w=open` has no such rule |
| "Planned pricing at launch. Early access is free." | Pricing decision | `site/PRICING-DECISION.md`; billing is not live |
| "Invited friends are always free" | Pricing decision | `site/PRICING-DECISION.md`; this must remain true when billing launches |

The onboarding uses an example person. The waitlist collects email addresses. There is no privacy page yet (T17).
