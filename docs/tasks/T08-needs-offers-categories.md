# T08 · Memory categories "Looking for" and "Offering"

**Goal.** The user can save what they need and what they can offer as memories. T10 matches
these against friends.

## Read first

- `backend/app/schemas/memory.py` › `MemoryCategory`
- `backend/app/ai/extraction.py` › `SYSTEM_PROMPT`, `_PATTERNS`, `_TITLE_PREFIX`
- `backend/app/mcp/tools.py` › `heldly_propose_memories` (description text)
- `widget/src/types.ts` › `MEMORY_CATEGORIES`, `CATEGORY_LABELS`; `widget/src/styles.css` › `badge--cat-`
- `plugin/skills/heldly-social/SKILL.md` › "Memories are consent-based"
- `CONTRACTS.md` › Needs and offers

## Do

1. Add `LOOKING_FOR` and `OFFERING` to `MemoryCategory`. The column is a string, so no migration.
2. Extraction: add both to `SYSTEM_PROMPT`; add heuristic patterns ("I'm looking for", "I need",
   "I can help with", "I offer") and title prefixes ("Looking for", "Offering").
3. Tool description and skill: when the user states a need or something they can offer,
   propose it in these categories. Say plainly that a friend can only be matched to it if the
   user sets it to "Shared with connections"; the default stays `PRIVATE`.
4. Widget: labels "Looking for" and "Offering", and a badge style for each.
5. Docs: the categories line in `docs/DATA_MODEL.md`.

## Done when

- [ ] A `suggested` item with category `LOOKING_FOR` can be proposed, saved and listed.
- [ ] `heuristic_extract("I'm looking for a design partner.")` returns a `LOOKING_FOR` candidate.
- [ ] The memory review demo shows both badges in light and dark.
- [ ] `make test && make lint`, widget typecheck and build pass.

## Not in this task

Matching (T10). Needs and offers on people notes (T09).
