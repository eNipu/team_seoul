# T02 · Tool `heldly_show_interests`

**Goal.** ChatGPT can ask for the user's interests and get the Interests card payload.

## Read first

- `CONTEXT.md` › recipe "Add an MCP tool"
- `backend/app/mcp/tools.py` › `heldly_reconnection_suggestions` (the pattern to copy)
- `backend/app/mcp/server.py` › `INSTRUCTIONS`
- `backend/tests/integration/test_social_flow.py` › `save` (test helper)
- `CONTRACTS.md` › Interests

## Do

1. Register `heldly_show_interests` with `@apps.tool`, no arguments, `READ_ONLY`, scopes
   `[MEMORIES_READ, CONNECTIONS]`. It calls `interest_service.build_interests`.
2. Title: "My interests". Description: shows what the user cares about, grouped from the
   memories they saved, with the friends who share each interest. Use when the user asks about
   their interests, what they have in common with people, or their "map".
3. Text for the model: one line per cluster, "Label: N memories". With no clusters:
   "No interests yet. Save a few memories first."
4. Add the tool to the list of card tools in `INSTRUCTIONS`.
5. Docs: a row under "Home" in `docs/MCP_TOOLS.md` and the tool count; one line under "Cards"
   in `plugin/skills/heldly-social/SKILL.md`.
6. Tests in `backend/tests/integration/test_interests_flow.py` and `tests/security/test_authz.py`.

## Done when

- [ ] After Alice saves two climbing memories, `alice.ok("heldly_show_interests")` returns
      `view == "interests"` and a cluster with `memory_count == 2`.
- [ ] Bob's memories never appear in Alice's result.
- [ ] A token without `heldly.memories.read` gets `FORBIDDEN`.
- [ ] `make test && make lint` pass.

## Not in this task

Friends in clusters (T03). The widget shows its empty state for this view until T04 lands.
