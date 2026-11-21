# T01 · Group my memories into interests

**Goal.** A service that turns the caller's saved memories into interest clusters. No tool and
no card yet; T02 exposes it.

## Read first

- `backend/app/services/relationship_service.py` › `terms_of`, `_STOPWORDS`, `_INTEREST_CATEGORIES`, `_memory_terms`
- `backend/app/models/memory.py` › `Memory`
- `CONTRACTS.md` › Interests

## Do

1. Reuse `relationship_service.terms_of`; do not write a second tokenizer. In
   `interest_service`, define `CLUSTER_CATEGORIES` as the interest categories plus `WORK`.
2. Add `backend/app/schemas/interests.py`: `ClusterMemory`, `ClusterFriend`, `InterestCluster`,
   `InterestsView`, matching the contract.
3. Add `backend/app/services/interest_service.py`:
   - `cluster_memories(memories) -> (clusters, unclustered_count)`, a pure function.
     Only categories in `CLUSTER_CATEGORIES` take part. Each memory's terms are
     `terms_of(title, *tags)`. Repeatedly pick the term that covers the most unassigned memories
     (ties: more words first, then alphabetical); it becomes a cluster holding those memories.
     Stop at 12 clusters; count the rest as unclustered.
   - `label` is the tag or title that equals the term, in its original spelling; otherwise the
     term with its first letter capitalised.
   - `build_interests(db, user) -> InterestsView` loads the caller's memories and calls it.
     `friends` stays empty.
4. Unit tests in `backend/tests/unit/test_interests.py`, built from plain `Memory(...)` objects.

## Done when

- [ ] Two memories sharing the tag "climbing" form one cluster with `memory_count == 2`.
- [ ] A `DISLIKE` memory never appears in a cluster.
- [ ] The same input always gives the same clusters in the same order.
- [ ] With 13 unrelated interests, 12 clusters come back and `unclustered_count == 1`.
- [ ] A `WORK` memory can form a cluster.
- [ ] `make test && make lint` pass.

## Not in this task

Friends in clusters (T03), the tool (T02), the card (T04), language-model naming (backlog).
