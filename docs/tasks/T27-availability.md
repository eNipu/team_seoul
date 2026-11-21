# T27 · Working hours, buffers and notice

**Goal.** The user can tell Venn when they take meetings (C2). The slot finder (T28) and meeting
requests (T30) read it.

## Read first

- `SCHEDULING.md` › Times, Shapes (Availability)
- `backend/app/services/plan_service.py` (a small owner-only service to copy)
- `backend/app/mcp/tools.py` › `venn_get_profile`, `venn_update_profile`

## Do

1. Table `availability` (one row per user): `timezone`, `work_days` (JSON list), `day_start_minute`,
   `day_end_minute`, `buffer_minutes`, `min_notice_minutes`, `default_length_minutes`. Migration.
2. `services/availability_service.py`: `get(db, user)` returns the saved row or the defaults
   (Mon–Fri 09:00–17:00 UTC, 10 min buffer, 4 h notice, 30 min); `update(db, user, ...)` validates
   the time zone with `zoneinfo`, `day_start < day_end`, and the limits in `SCHEDULING.md`.
3. Tools `venn_get_availability` (R, profile read) and `venn_set_availability` (W, profile write).
   Partial update: only the given fields change.
4. Docs: `docs/MCP_TOOLS.md` rows and count, `docs/DATA_MODEL.md`.

## Done when

- [ ] A new user gets the defaults with `is_default: true`; after a save, `false`.
- [ ] `timezone="Mars/Olympus"` and `day_start="18:00", day_end="09:00"` return `INVALID_REQUEST`.
- [ ] Deleting the account deletes the row.
- [ ] `make test && make lint` pass.

## Not in this task

Which calendars count as busy (T29). Daily meeting caps (later).
