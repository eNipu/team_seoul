# T21 · Hero subhead and the claims table

**Goal.** The page says who Venn is for in the prototype's best line, and every new sentence
is listed with its status.

## Read first

- `WAITLIST.md` › Copy, Words from the prototype that are not used
- `site/app/page.tsx`, `site/app/layout.tsx` (the page description)
- `site/components/Waitlist.tsx` › `SHARE_TEXT`
- `site/README.md` › "What the copy may claim"
- `.agents/skills/venn-site-design/SKILL.md` › Copy, "The hero is exactly one screen"

## Do

1. `page.tsx`: replace the hero subhead with the one in `WAITLIST.md`. The `h1` stays.
2. `layout.tsx`: if the description repeats the old subhead, bring it in line.
3. `SHARE_TEXT`: the share text in `WAITLIST.md`.
4. Claims table: add "A confirmed place for both of you" (a promise the team must keep) and
   "from what each of you approves" (works). Remove "Your AI knows what you're building".
   The line about your next opportunity became the changing word in T25.

## Done when

- [ ] The subhead still ends above the fold at 360 x 640.
- [ ] No sentence on the page says that AIs talk to each other, that Venn is invitation only,
      or names a launch date.
- [ ] `npm --prefix site run build && node site/check.mjs --shots site/.shots` passes, and
      someone has looked at `phone-small-fold.png` and `desktop-fold.png`.

## Not in this task

The `h1`, the circles, the preview and the principles.
