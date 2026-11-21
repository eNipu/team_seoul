# T05 · One "keep it alive" line per friend

**Goal.** Next to each friend in an interest cluster, say one concrete thing to do together,
and whether it is time to reconnect.

## Read first

- `backend/app/services/relationship_service.py` › `_ideas`, `_ACTIVITY_IDEAS`, `_DEFAULT_IDEAS`, `DEFAULT_RECONNECT_DAYS`
- `backend/app/services/interest_service.py` › `build_interests`
- `widget/src/components/Interests.tsx` (from T04)
- `CONTRACTS.md` › Interests

## Do

1. Make `_ideas` public (`ideas`).
2. For each friend in a cluster, set `keep_alive` to the title of the first idea from
   `ideas([cluster.key], friend)`. It is grounded in the shared interest first, so a climbing
   cluster suggests climbing.
3. Set `due` to `days_since_last_interaction >= DEFAULT_RECONNECT_DAYS`.
4. Add the first due friend to the text summary: "Mina: 240 days. Try: Go climbing together."
5. Check that the card from T04 shows both fields with real data; adjust wording if needed.

## Done when

- [ ] A friend sharing "climbing" gets a `keep_alive` line that is about climbing.
- [ ] A friend last seen 30 days ago has `due == true`; one seen yesterday has `due == false`.
- [ ] No `keep_alive` text contains anything from another user's `PRIVATE` memory (assert in a security test).
- [ ] `make test && make lint`, widget typecheck and build pass.

## Not in this task

Per-person cadence (T06 replaces the fixed 21 days for people). Language-model wording (backlog).
