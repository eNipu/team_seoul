# T14 · Database rule for connection pairs

**Goal.** The database itself refuses a connection stored the wrong way round, so the same two
people can never be connected twice.

Today the order (`user_a_id < user_b_id`) is enforced only in Python, by `_pair`.

## Read first

- `backend/app/models/connection.py` › `Connection`
- `backend/app/services/social_service.py` › `_pair`, `respond_to_request`
- `CONTEXT.md` › recipe "Add a column" (same migration steps)

## Do

1. Add `CheckConstraint("user_a_id < user_b_id", name="ck_connections_ordered")` to the model,
   with a migration.
2. `_pair` orders by `str(uuid)`. Confirm the database orders the same way on both SQLite and
   Postgres by inserting through `_pair` in a test with many random ids.
3. If the two orders ever disagree on either database, stop and change `_pair` to match the
   database before adding the constraint. Say so in the pull request.

## Done when

- [ ] Inserting a `Connection` with the ids reversed raises `IntegrityError`.
- [ ] 200 random pairs created through `_pair` all insert cleanly.
- [ ] `make test` passes, and `make test-postgres` passes (needs Docker).
- [ ] `docs/DATA_MODEL.md` says the order is enforced by the database.

## Not in this task

Merging `connection_requests`, `connections` and `blocks` into one table. Not planned.
