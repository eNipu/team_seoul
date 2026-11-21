# T30 · Tool `venn_find_meeting_times`

**Goal.** "Set up 30 minutes with Teodor next week" returns three times both people are free,
on a card (C3, J5). Nothing is sent yet.

## Read first

- `SCHEDULING.md` › Rules, Limits
- `backend/app/services/slots.py` (T28), `availability_service.py` (T27), `services/calendar/` (T29)
- `backend/app/services/relationship_service.py` › `resolve`
- `CONTEXT.md` › Recipes › Add an MCP tool

## Do

1. Tables `meeting_requests` (organiser, connection, title, length, status, expires at) and
   `meeting_slots` (request, start, end, picked). Migration.
2. `services/meeting_service.py` › `find_times(db, user, connection_id, length, window_start,
   window_end, title)`: resolve the connection (blocks and removals give `NOT_FOUND`), read both
   availabilities and free/busy, call `find_slots`, store a request in status `picking`.
3. Card tool (`view: "scheduler"`), scope `venn.calendar`. Result: request id, the other person's
   display name, slots with local times for the organiser, and `counterparty_calendar` true/false.
4. Write the scheduler shape into `CONTRACTS.md`. Tests in `tests/integration`, and another
   user's request in `tests/security/test_authz.py`.

## Done when

- [ ] With both calendars faked, returns up to three slots that avoid both users' busy blocks.
- [ ] A person note id or someone else's connection id returns `NOT_FOUND`.
- [ ] A window over 14 days or a length of 5 minutes returns `INVALID_REQUEST`.
- [ ] `make test && make lint` pass.

## Not in this task

Proposing or booking (T31, T32). The card itself (T33).
