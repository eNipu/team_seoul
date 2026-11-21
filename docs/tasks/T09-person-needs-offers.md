# T09 · Needs and offers on people notes

**Goal.** For a friend who is not on Heldly, the user can note what that person is looking for
and what they offer. T10 matches these against the user's own needs and offers.

## Read first

- `CONTEXT.md` › recipe "Add a column"
- `backend/app/models/person.py`
- `backend/app/services/people_service.py` › `clean_interests`, `_reject_sensitive`, `add_person`, `update_person`, `to_out`
- `backend/app/schemas/social.py` › `PersonOut`
- `backend/app/mcp/tools.py` › `heldly_add_person`, `heldly_update_person`
- `widget/src/components/PersonForm.tsx`, `Friend.tsx`; `widget/src/types.ts` › `Person`
- `CONTRACTS.md` › Needs and offers

## Do

1. Columns `people.looking_for` and `people.offering`: JSON lists, default `[]`, with a migration.
2. Clean them like interests: trimmed, de-duplicated, at most 6 items of 120 characters, and
   refused if they contain credentials.
3. Both tools accept `looking_for` and `offering`. Omitted means unchanged; `[]` clears.
   `PersonOut` returns them.
4. Widget: two fields in `PersonForm` ("Looking for", "Can offer"), and both lists on the
   Friend card for a person. Update the demo data.
5. Skill: one sentence under "Friends who are not on Heldly" with an example.
6. Docs: `docs/MCP_TOOLS.md`, `docs/DATA_MODEL.md`.

## Done when

- [ ] Add a person with `looking_for=["  a retail advisor ", "A retail advisor"]`; one clean item comes back.
- [ ] A seventh item, or one of 121 characters, is rejected with `INVALID_REQUEST`.
- [ ] An item containing a password is rejected with `PRIVACY_VIOLATION`.
- [ ] Another user can neither read nor change them (extend `test_people_notes_are_owner_only`).
- [ ] `make test && make lint`, widget typecheck and build pass.

## Not in this task

Matching (T10). Anything about people who are on Heldly: their needs are memories (T08).
