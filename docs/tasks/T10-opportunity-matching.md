# T10 · Match needs with offers

**Goal.** A service that finds where a friend could help the user, and where the user could
help a friend. No tool yet; T11 exposes it.

## Read first

- `backend/app/services/relationship_service.py` › `Friend`, `_connection_friend`, `_person_friend`, `all_friends`, `resolve`, `terms_of`
- `backend/app/services/memory_service.py` › `visible_memories_of`
- `CONTRACTS.md` › Opportunities

## Do

1. Give `Friend` two lists, `looking_for` and `offering`. For a connection they are the titles
   of that friend's *visible* `LOOKING_FOR` and `OFFERING` memories. For a person they are the
   note's lists from T09.
2. Add `backend/app/schemas/opportunities.py` matching the contract.
3. Add `backend/app/services/opportunity_service.py`:
   - `match(my_looking_for, my_offering, friend) -> list[Opportunity]`, a pure function.
     My need against their offer gives `they_can_help_you`; my offer against their need gives
     `you_can_help_them`. Two texts match when `terms_of(a) & terms_of(b)` is not empty;
     `matched_on` is that set, sorted.
   - `find(db, user, connection_id=None, person_id=None) -> OpportunitiesView`. The caller's
     own lists come from all of their own `LOOKING_FOR` and `OFFERING` memories, whatever the
     visibility. With no id, go through `all_friends`; with one, through `resolve`.
   - Order by number of matched terms, then longest time since contact. Keep 20.
4. `yours` and `theirs` carry the prefix shown in the contract ("Looking for: …", "Offering: …").
5. Unit tests for `match` in `backend/tests/unit/test_opportunities.py`.

## Done when

- [ ] My "pilot customers in retail" against their "intros to retail buyers" gives one
      `they_can_help_you` with `matched_on == ["retail"]`.
- [ ] The reverse pairing gives `you_can_help_them`.
- [ ] Texts that share only filler words ("looking", "really") do not match.
- [ ] Output order is stable for the same input.
- [ ] `make test && make lint` pass.

## Not in this task

The tool and its security tests (T11). Semantic matching with embeddings (backlog).
