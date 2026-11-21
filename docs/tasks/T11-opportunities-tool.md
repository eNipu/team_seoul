# T11 · Tool `heldly_show_opportunities`

**Goal.** ChatGPT can answer "who could help me?", "who could I help?" and "how could Sam and I
help each other?" with the Opportunities card payload.

## Read first

- `CONTEXT.md` › recipe "Add an MCP tool"
- `backend/app/mcp/tools.py` › `heldly_view_friend` (same optional `connection_id` | `person_id` arguments)
- `backend/app/services/opportunity_service.py` (from T10)
- `backend/app/services/relationship_service.py` › `view_friend`; `backend/app/schemas/social.py` › `FriendView`
- `backend/tests/integration/test_social_flow.py` › `connect`, `save`
- `CONTRACTS.md` › Opportunities

## Do

1. Register `heldly_show_opportunities` with `@apps.tool`, `READ_ONLY`, scopes
   `[CONNECTIONS, MEMORIES_READ]`. Arguments: optional `connection_id` or `person_id`, never both.
2. Text for the model: one line per item, "Sam could use your B2B sales advice (matched on:
   sales)". With none: say so, and suggest saving what the user is looking for or can offer.
3. `FriendView` gains `opportunities` for that friend, filled in `view_friend`.
4. Add the tool to `INSTRUCTIONS`, `docs/MCP_TOOLS.md` and the skill ("Staying close" section).
   The skill must repeat rule 6: Heldly explains the opening; the user reaches out.
5. Tests in `backend/tests/integration/test_opportunities_flow.py` and `tests/security/test_authz.py`.

## Done when

- [ ] Alice saves a shared `OFFERING`; Bob, connected, saves a shared `LOOKING_FOR` on the same
      topic. Alice sees `you_can_help_them` for Bob, and Bob sees `they_can_help_you` for Alice.
- [ ] If Bob's `LOOKING_FOR` is `PRIVATE`, Alice sees nothing about it.
- [ ] A blocked connection produces no opportunities in either direction.
- [ ] Carol's person notes never appear for Alice.
- [ ] Passing both ids returns `INVALID_REQUEST`; a foreign id returns `NOT_FOUND`.
- [ ] `make test && make lint` pass.

## Not in this task

The card (T12). Notifying a user when a new match appears (backlog).
