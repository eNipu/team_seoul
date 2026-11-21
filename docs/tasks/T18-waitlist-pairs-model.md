# T18 · Waitlist pairs: model and API

**Goal.** A signup is pending or confirmed, knows who invited it, and a link stops attaching
people once it is full. The current page keeps working unchanged.

## Read first

- `WAITLIST.md` › Decisions, Rules, Shape
- `site/lib/db.ts`, `site/lib/waitlist.ts`, `site/app/api/waitlist/route.ts`
- `site/lib/analytics.ts` › `cleanRef`, `cleanAttribution`
- `site/README.md` › Waitlist

## Do

1. `db.ts` › `SCHEMA`: add `version TEXT NOT NULL DEFAULT 'open'`,
   `invited_by BIGINT REFERENCES waitlist_signups (id)` and `confirmed_at TIMESTAMPTZ`, with an
   index on `invited_by`. Once, when the columns are missing, backfill old rows:
   `confirmed_at = created_at`, and `invited_by` from `ref` while that link has room.
2. `db.ts`: add a `transaction` helper. Today there is only `query`.
3. `waitlist.ts` › `joinWaitlist(email, attribution, version)`: in one transaction, lock the
   inviter's row, count the people attached to it, and apply the Rules table. Set the inviter's
   `confirmed_at` when it was empty.
4. `WaitlistSpot`: add `status`, `version`, `circle` and `invitesLeft`. `spotForCode` returns them too.
5. `route.ts`: read `version` from the body. Anything other than `pair` or `open` falls back
   to `WAITLIST_VERSION` (`lib/version.ts`). `waitlist.ts` › `inviteHasRoom(code)` says
   whether a link exists and has room; T20 uses it.
6. `site/README.md` › Waitlist and Environment, and `site/.env.example`.

## Done when

Against a local Postgres (see `site/README.md`), with `curl`:

- [ ] `pair` without a link answers `pending` and `invitesLeft: 4`.
- [ ] A second email with that link answers `confirmed` and `invitesLeft: 3`, and the first
      one's `GET ?code=` now says `confirmed`, `circle: 2`, `invitesLeft: 3`.
- [ ] The sixth email with the first link is stored and is not attached to it.
- [ ] `inviteHasRoom` is `true`, then `false` once the link is full, and `false` for a made-up code.
- [ ] Two people who use the last place of a link at the same moment: one is attached.
- [ ] Joining twice returns the same answer. A row created before the change is `open`, `confirmed`.
- [ ] `npm --prefix site run build && node site/check.mjs` passes with `DATABASE_URL` set.

## Not in this task

Any change to what a visitor sees (T19, T20). `/metrics` (T22).
