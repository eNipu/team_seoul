# T22 · `/metrics` for pairs and for the two versions

**Goal.** The team can see how many people are pending and confirmed, how many pairs formed,
and which version of the waitlist brings in more confirmed people per visitor.

## Read first

- `WAITLIST.md` › Decisions, Rules
- `site/lib/analytics.ts` › `track`, `getMetrics`; `site/lib/db.ts` › `site_events`
- `site/components/PageView.tsx`, `site/app/api/visit/route.ts`, `site/app/metrics/page.tsx`
- `site/README.md` › Analytics and `/metrics`

## Do

1. `site_events`: add `version TEXT` (`ADD COLUMN IF NOT EXISTS`). `PageView` sends the
   version the page showed; `track` stores it for both events. Accept only `pair` or `open`.
2. `getMetrics`: add pending, confirmed, pairs (people with at least one person attached to
   their link) and a by-version table: visitors, signups, confirmed.
3. `metrics/page.tsx`: show them. Keep "Activation Rate" as it is defined today, and add
   "Confirmed Rate": confirmed signups divided by visitors.
4. `check.mjs`: add the new labels to the list it looks for on `/metrics`.
5. `site/README.md` › Analytics: the new numbers and how each is counted.

## Done when

- [ ] After one `pair` signup and one invited signup, `/metrics` shows 0 pending, 2 confirmed
      and 1 pair, and the `pair` row of the by-version table shows 2 signups.
- [ ] `/metrics` still shows counts and invite codes only: no email addresses.
- [ ] `npm --prefix site run build && node site/check.mjs` passes with `DATABASE_URL` set.

## Not in this task

Assigning visitors to a version at random. The version is chosen by the link the team shares.
