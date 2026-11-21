# T25 · The changing word under the headline

**Goal.** Under "Find the common ground." the page says "You already know your next customer."
on one line, and the last word rolls upward to the next: customer, friend, business partner.
Source: the team's handwritten note of 2026-11-21, and the three words the team then chose.

## Read first

- `.agents/skills/venn-site-design/SKILL.md` › Motion, "The hero is exactly one screen"
- `site/app/page.tsx` › `NEXT`, `site/components/NextWord.tsx`
- `site/app/globals.css` › `.hero__next`
- `site/README.md` › "What the copy may claim"

## Do

1. `NextWord.tsx`: one line from 600 px up. The slot is as wide as its word, so the sentence
   stays centered, and its width is animated between words. Narrower, the word takes the line
   below. The first word is in the HTML the server sends.
2. One word every 2.4 s: the old one leaves through the top, the new one rises from below.
   It holds still with reduced motion, while the pointer is on the line, while a form field
   has focus and while the tab is hidden.
3. Screen readers get one sentence with every word; the changing line is `aria-hidden`.
4. The subhead loses its first sentence, which this line replaces. The `h1` stays.
5. `check.mjs`: the line is above the fold in every state, the word changes, it does not
   change with reduced motion, and on a wide screen it is one centered line.
6. Claims table, the design skill's Motion section, and the page description in `layout.tsx`.

## Done when

- [ ] `npm --prefix site run build && node site/check.mjs --shots site/.shots` passes with
      `DATABASE_URL` set, and someone has looked at `phone-small-fold.png`.

## Not in this task

A pause button. The word cannot be paused from the keyboard; WCAG 2.2.2 asks for a way to
pause anything that moves for more than five seconds. Add one before a formal audit.
