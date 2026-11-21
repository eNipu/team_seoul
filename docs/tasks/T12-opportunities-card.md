# T12 · Opportunities card and Friend section

**Goal.** The widget renders the `opportunities` view, and the Friend card shows how that one
connection could help. Works from demo data.

## Read first

- `CONTEXT.md` › recipe "Add a card"
- `widget/src/components/Interests.tsx` (from T04) and `Friend.tsx`
- `widget/src/types.ts` › `parseView`, `FriendViewData`; `widget/src/mock.ts`
- `CONTRACTS.md` › Opportunities
- `AGENTS.md` › Design skills

## Do

1. Types and parser for `OpportunitiesViewData`; add `opportunities` to the friend view type
   (default `[]`).
2. `components/Opportunities.tsx`: two groups with plain headings, "They could help you" and
   "You could help them". Each row shows the name, your line, their line, what matched, and
   days since you last met. Row actions: open the friend, "Ideas".
3. Empty state: "No openings yet. Save what you're looking for, or what you can offer, and
   Heldly will match it with the people you know."
4. `Friend.tsx`: a section "How this connection could help" when the array is not empty.
5. Demo data for both directions, `?view=opportunities`, and the tool in the mock bridge.
6. Wire into `App.tsx` (`refreshCall` too) and document in `widget/README.md`.

## Done when

- [ ] `?view=opportunities` renders in light and dark, at 360 px and wide, with no sideways scroll.
- [ ] The direction is clear from the heading text, not from colour or an icon alone.
- [ ] `?view=friend` shows the new section; `?view=friend_person` with an empty array does not.
- [ ] A payload of `{}` with `view: "opportunities"` renders the empty state without errors.
- [ ] `npm --prefix widget run typecheck` and `npm --prefix widget run build` pass.

## Not in this task

Drafting a message to the friend. The model can do that in chat; the card only explains.
