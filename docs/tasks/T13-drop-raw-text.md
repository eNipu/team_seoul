# T13 · Stop sending the user's raw text to the server

**Status note.** Needs a team decision before work starts. The case for it is below.

**Goal.** `venn_propose_memories` accepts only the candidates the model drafted, not up to
4,000 characters of the user's own words.

## Why

- With `OPENAI_API_KEY` set, that text is forwarded to a second OpenAI call. The site and the
  memo both promise that Venn does not see conversations.
- ChatGPT's plugin rules tell tools not to ask for raw transcripts or broad context. A free-text
  field of this size is a review risk.
- The model has already read the conversation and can fill `suggested` itself, at no cost to us.

Background: `Venn PRD.md` §11.3, item 2.

## Read first

- `backend/app/mcp/tools.py` › `venn_propose_memories`
- `backend/app/services/memory_service.py` › `propose_memories`
- `backend/app/ai/extraction.py`
- `plugin/skills/venn-social/SKILL.md` › "Memories are consent-based"

## Do

1. Remove the `text` argument. `suggested` becomes required (1 to 8 items).
2. Delete the OpenAI and heuristic extraction. Keep `contains_sensitive` and
   `sanitize_candidates`; every candidate still passes through them.
3. Remove the `openai` dependency and the `OPENAI_*` settings (`config.py`, `.env.example`,
   `pyproject.toml`, the README configuration table).
4. Update the tool description, the skill, `docs/MCP_TOOLS.md`, and the privacy bullet in
   `docs/SECURITY.md`.
5. Fix the tests that pass `text=` or import `heuristic_extract`. If T08 is merged, drop its
   heuristic patterns with the rest.

## Done when

- [ ] A call with `text` is rejected as an unknown argument; a call with no `suggested` returns `INVALID_REQUEST`.
- [ ] `grep -ri openai backend/app` finds nothing.
- [ ] The sensitive-data tests still pass.
- [ ] `make test && make lint` pass.
