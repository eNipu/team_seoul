# T19 · Waitlist states in the hero

**Goal.** A visitor on the `pair` version sees that their place is held, shares one link, and
sees the circle fill. A visitor on the `open` version sees what they see today.

## Read first

- `WAITLIST.md` › Decisions, Shape, Copy
- `.agents/skills/venn-site-design/SKILL.md` (all of it; the hero must still fit one screen)
- `site/components/Waitlist.tsx`, `site/lib/attribution.ts`, `site/app/page.tsx`
- `site/app/globals.css` › Waitlist; `widget/src/venn-kit.css` › `.avatar`
- `site/check.mjs` › `submitWaitlist` and the "phone/waitlist" block in `main`

## Do

1. Version: `page.tsx` reads `?w=pair` or `?w=open`, else `WAITLIST_VERSION` (default `pair`),
   and passes it to `Waitlist`, which sends it with the `POST`.
2. Form: same field and button. Only the note differs by version.
3. Pending state: lead, text, "Share my invite link", "See it inside ChatGPT", note.
4. Confirmed state for `pair`: lead, text, a row of five circles (filled for people in the
   circle, dashed for invites left) built from the kit's `.avatar`, `aria-hidden`, with the
   note below as its text. The circles are ink and hairline, not the `--venn-*` colours.
5. `open` keeps today's confirmed state, word for word.
6. `isSpot` must accept a spot saved before this change and refresh it from `GET ?code=`.
7. `check.mjs`: join on `pair` and expect the pending state; join a second email with that
   link and expect "You're both in."; keep today's assertions for `?w=open`.
8. `site/README.md` › Waitlist: describe both versions.

## Done when

- [ ] Both versions work end to end on a phone-sized screen, with the keyboard only.
- [ ] A returning pending visitor whose +1 has joined sees the confirmed state after reload.
- [ ] The header, `h1`, subhead and waitlist end above the fold at 360 x 640 in every state.
- [ ] Focus moves to the new state after joining, and it is announced (`role="status"`).
- [ ] `npm --prefix site run build && node site/check.mjs --shots site/.shots` passes with
      `DATABASE_URL` set, and someone has looked at `phone-small-fold.png`.

## Not in this task

The view for someone who arrives with a link (T20). The subhead (T21). `/metrics` (T22).
Telling a pending person by email that their +1 joined: there is no email provider (`BACKLOG.md`).
