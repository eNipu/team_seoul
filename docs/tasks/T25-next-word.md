# T25 · The changing word under the headline

**Goal.** Under "Find the common ground." the page says "You already know your next customer."
and the last word changes: customer, investor, friend, gym buddy, travel buddy. Source: the
team's handwritten note of 2026-11-21.

## Read first

- `.agents/skills/venn-site-design/SKILL.md` › Motion, "The hero is exactly one screen"
- `site/app/page.tsx` › `NEXT`, `site/components/NextWord.tsx`
- `site/app/globals.css` › `.hero__next`
- `site/README.md` › "What the copy may claim"

## Do

1. `NextWord.tsx`: the static part on one line, the word on the next, so nothing moves sideways
   when the word changes. The first word is in the HTML the server sends.
2. One word every 2.4 s, entering like the shared `rise`. It holds still with reduced motion,
   while the pointer is on the line, while a form field has focus and while the tab is hidden.
3. Screen readers get one sentence with every word; the changing line is `aria-hidden`.
4. The subhead loses its first sentence, which this line replaces. The `h1` stays.
5. `check.mjs`: the line is above the fold in every state, the word changes, and it does not
   change with reduced motion.
6. Claims table, the design skill's Motion section, and the page description in `layout.tsx`.

## Done when

- [ ] `npm --prefix site run build && node site/check.mjs --shots site/.shots` passes with
      `DATABASE_URL` set, and someone has looked at `phone-small-fold.png`.

## Not in this task

A pause button. The word cannot be paused from the keyboard; WCAG 2.2.2 asks for a way to
pause anything that moves for more than five seconds. Add one before a formal audit.
