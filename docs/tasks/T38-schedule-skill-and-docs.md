# T38 · Teach the model to schedule; update the docs

**Goal.** The model calls the scheduling tools at the right moments and never claims a meeting is
booked before the tool says so.

## Read first

- `SCHEDULING.md`
- `plugin/skills/venn-social/SKILL.md`, `backend/app/mcp/server.py` › `INSTRUCTIONS`
- `docs/SECURITY.md` (the "Add to calendar" paragraph), `README.md` (calendar line)

## Do

1. Skill: a "Scheduling" section. Check `venn_calendar_status` first and offer the link; turn
   "next week, mornings" into a window; show the card; only say "booked" after a `booked` status.
2. Skill: a "Reaching you" section on linking channels, and that Venn only sends fixed meeting
   messages to verified channels.
3. `INSTRUCTIONS`: add the scheduler card to the list of cards.
4. `docs/SECURITY.md`, `README.md`: replace "Venn has no calendar access" with what is now true.
5. Prompts for T15's set: five scheduling requests and the tool each should pick.

## Done when

- [ ] The docs say nothing that contradicts `SCHEDULING.md`.
- [ ] `make test && make lint` pass.

## Not in this task

New behaviour.
