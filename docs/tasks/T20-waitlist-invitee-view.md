# T20 · What an invited person sees

**Goal.** Someone who opens `/?ref=<code>` learns they were invited and that joining confirms
both places, without being told who invited them.

## Read first

- `WAITLIST.md` › Rules, Shape, Copy (the Invitee rows)
- `site/components/Waitlist.tsx` as left by T19, `site/lib/attribution.ts`
- `.agents/skills/venn-site-design/SKILL.md` › "The hero is exactly one screen", Copy

## Do

1. `page.tsx`: when the URL has a `ref`, call `inviteHasRoom` before the page is sent and pass
   the answer to `Waitlist`. The page is then rendered per request.
2. Room: show the invitee lead and text above the field, the button "Accept the invite"
   and the invitee note. The `h1` and subhead do not change.
3. No room, or an unknown code: the normal form for the page's version, with the "no longer
   open" line above it. If the lookup fails, the normal form alone.
4. After joining, show the confirmed state from T19. Its circle already counts the inviter.
5. A device that already has a spot ignores the `ref` and shows that spot.
6. `check.mjs`: open a page with a valid link and expect the invitee lead and button; open
   one with a made-up code and expect the normal form.

## Done when

- [ ] The invitee view never shows an email address, a name or the inviter's position.
- [ ] The lead and text are in the HTML the server sends, so the field does not move after
      the page has painted.
- [ ] Above the fold at 360 x 640, with the keyboard only, and with reduced motion.
- [ ] `npm --prefix site run build && node site/check.mjs --shots site/.shots` passes with
      `DATABASE_URL` set.

## Not in this task

Asking the inviter for a name so the invitee can see it. Decided against in `WAITLIST.md`.
