# T06 · Check-in cadence per person

**Goal.** The user can say "remind me to check in with Mina every two months". Reconnect
suggestions respect it instead of the fixed 21 days.

## Read first

- `CONTEXT.md` › recipe "Add a column"
- `backend/app/models/person.py` › `Person`, and the newest file in `backend/migrations/versions/`
- `backend/app/services/people_service.py` › `add_person`, `update_person`, `to_out`
- `backend/app/services/relationship_service.py` › `reconnection_suggestions`
- `backend/app/mcp/tools.py` › `venn_add_person`, `venn_update_person`
- `widget/src/components/PersonForm.tsx`, `widget/src/types.ts` › `Person`
- `CONTRACTS.md` › Needs and offers (the `cadence_days` line)

## Do

1. Column `people.cadence_days` (integer, nullable, 7 to 365) with a migration.
2. `venn_add_person` and `venn_update_person` accept `cadence_days`; `0` clears it.
   `PersonOut` returns it.
3. In `reconnection_suggestions`, a person is a candidate when
   `days >= (cadence_days or min_days)`. Connections keep using `min_days`.
4. If T05 is merged, `due` in the interests view uses the same rule for people.
5. Widget: a "Check in" choice in `PersonForm` (Default, Every 2 weeks, Monthly, Every 2 months,
   Every 3 months, Twice a year, Yearly) mapped to days. Show it on the Friend card for a person.
6. Skill: one sentence under "Friends who are not on Venn" on when to set it.
7. Docs: `docs/MCP_TOOLS.md`, `docs/DATA_MODEL.md`.

## Done when

- [ ] A person with `cadence_days = 60`, last seen 30 days ago, is not suggested; at 61 days they are.
- [ ] A person with no cadence still follows `min_days`.
- [ ] `cadence_days = 3` is rejected with `INVALID_REQUEST`.
- [ ] Another user cannot set or read it (extend `test_people_notes_are_owner_only`).
- [ ] `make test && make lint`, widget typecheck and build pass.

## Not in this task

Cadence for connections (backlog: it needs a per-user setting per connection).
