# T07 · Act from the Interests card

**Goal.** From the Interests card the user can open a friend, get ideas, or log that they met,
without typing.

## Read first

- `widget/src/components/Reconnect.tsx` (how a card calls tools and navigates)
- `widget/src/App.tsx` › `refreshCall`
- `widget/src/components/common.tsx` › `Nav`; `widget/src/types.ts` › `friendArg`
- `widget/src/components/Dashboard.tsx` (where the entry point goes)
- `widget/src/components/Interests.tsx` (from T04)

## Do

1. On each friend row:
   - the name opens `heldly_view_friend`;
   - "Ideas" opens `heldly_suggest_activity`;
   - "We met" calls `heldly_log_interaction`, then refreshes the card.
2. Add `interests` to `refreshCall` so the card reloads through `heldly_show_interests`.
3. On the dashboard, add an "Interests" entry that opens `heldly_show_interests`.
4. Add `heldly_show_interests` to the mock bridge so the demo works end to end.
5. Failed calls show the existing error banner with Retry and keep the card as it was.

## Done when

- [ ] In the demo, "We met" resets that friend's day count and clears "Time to reconnect".
- [ ] With `&flaky=1`, a failed "We met" shows the banner and Retry works.
- [ ] Back navigation returns to the Interests card from the friend and ideas cards.
- [ ] Buttons are at least 44 px and have clear labels for screen readers ("Ideas for Mina").
- [ ] `npm --prefix widget run typecheck` and `npm --prefix widget run build` pass.

## Not in this task

New backend behaviour. Everything here calls tools that already exist.
