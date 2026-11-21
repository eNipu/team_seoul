# T03 · Put friends into interest clusters

**Goal.** Each interest cluster lists the friends who share it, using only what the user is
allowed to see.

## Read first

- `backend/app/services/relationship_service.py` › `_Friend`, `_all_friends`, `_days_since`
- `backend/app/services/interest_service.py` (from T01)
- `backend/tests/security/test_authz.py` › `test_private_memories_never_shared_with_connections`, `test_blocked_connection_cannot_be_viewed`, `test_people_notes_are_owner_only`
- `CONTRACTS.md` › Interests

## Do

1. Make `_all_friends` and `_days_since` public (`all_friends`, `days_since`). They already
   apply the visibility and block rules; do not write a second path to friends' data.
2. In `build_interests`, a friend joins a cluster when `cluster.key` is in `friend.terms`.
   Fill `kind`, `id`, `display_name` and `days_since_last_interaction`. Leave `keep_alive`
   as `null` and `due` as `false`.
3. Order friends by days since last contact, longest first. Keep at most 8 per cluster.
4. Extend the text summary: "Climbing: 3 memories, shared with Mina and Jun".
5. Tests through the tool, in `test_interests_flow.py` and `test_authz.py`.

## Done when

- [ ] A connection whose `SHARED_WITH_CONNECTIONS` memory mentions climbing appears in Alice's climbing cluster.
- [ ] A person note with the interest "Climbing" appears there too, with `kind == "person"`.
- [ ] Bob's `PRIVATE` climbing memory does not put Bob in the cluster.
- [ ] A blocked connection appears in no cluster.
- [ ] Carol's person notes never appear in Alice's result.
- [ ] `make test && make lint` pass.

## Not in this task

The "keep it alive" line (T05), cadence (T06).
