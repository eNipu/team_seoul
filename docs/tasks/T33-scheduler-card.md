# T33 · Scheduler card

**Goal.** A card to pick times, see a proposal's state, and see a booked meeting, like Boardy's
"Auto-booked" banner but in Venn's style.

## Read first

- `CONTRACTS.md` › Scheduler (written by T30)
- `CONTEXT.md` › Recipes › Add a card
- `widget/src/components/` (an existing card with actions, e.g. the friend card)

## Do

1. `types.ts`: `scheduler` view; coerce every field.
2. `mock.ts`: `scheduler`, `scheduler-proposed` and `scheduler-booked` demo views.
3. `components/Scheduler.tsx`: slots as toggle buttons (up to three), "Propose these times"
   calls `venn_propose_meeting`; a proposed state ("Waiting for Bob"); a booked state with date,
   time, the Meet link and "Cancel". Text only, buttons 44 px, times in the viewer's zone.
4. Say plainly when the other person's calendar was not checked.
5. `App.tsx` and `widget/README.md`.

## Done when

- [ ] All three demo views work at 360 px and wide, light and dark, keyboard only.
- [ ] Nothing is proposed without pressing the button.
- [ ] Widget typecheck and build pass.

## Not in this task

Choosing calendars or editing working hours in the card.
