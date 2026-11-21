# T04 · Interests card in the widget

**Goal.** The widget renders the `interests` view. Works from demo data, so it does not wait
for the backend tasks.

## Read first

- `CONTEXT.md` › recipe "Add a card"
- `widget/README.md`
- `widget/src/types.ts` › `ViewData`, `parseView`, `ReconnectViewData`
- `widget/src/components/Reconnect.tsx` (closest existing card)
- `widget/src/mock.ts` › `DEMO_VIEWS`, `mockInitialView`
- `CONTRACTS.md` › Interests
- `AGENTS.md` › Design skills (load `apple-design` for the visual review)

## Do

1. Types and parser for `InterestsViewData`. Unknown or missing fields fall back to safe
   values (`[]`, `0`, `null`).
2. Demo data: four clusters, one with no friends, one friend with `due: true`, and one cluster
   with a long label. Demo URL `?view=interests`.
3. `components/Interests.tsx`:
   - One section per cluster: label, "N memories", up to 5 memory titles.
   - Friends under it: name, "N days since you last met", and the `keep_alive` line when present.
   - `due` is shown with words ("Time to reconnect"), never colour alone.
   - Empty state: "No interests yet. Tell Venn what you're into, then save what it suggests."
   - If `unclustered_count > 0`: "N more memories don't fit a group yet."
4. Wire it into `App.tsx` and document it in `widget/README.md`.

## Done when

- [ ] `?view=interests` renders in light and dark, at 360 px and wide, with no sideways scroll.
- [ ] Every control is reachable by keyboard with a visible focus ring.
- [ ] A payload of `{}` with `view: "interests"` renders the empty state without errors.
- [ ] `npm --prefix widget run typecheck` and `npm --prefix widget run build` pass.

## Not in this task

Buttons that call tools (T07). Changing the dashboard.
