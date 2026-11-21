# T15 · Prompt set for tool selection

**Goal.** A fixed list of prompts with the tool each should trigger, so a change to tool names,
descriptions or the skill can be checked instead of guessed.

Needs a person with ChatGPT developer mode and the plugin connected.

## Read first

- `backend/app/mcp/server.py` › `INSTRUCTIONS`
- `plugin/skills/heldly-social/SKILL.md`
- `docs/MCP_TOOLS.md` (tool list only)

## Do

1. Create `docs/evals/tool-selection.md` with a table: prompt, expected first Heldly tool,
   notes. Write 30 prompts:
   - 12 direct ("Show my Heldly dashboard").
   - 8 indirect ("Who haven't I seen in a while?").
   - 4 follow-ups that reuse something from an earlier result ("Ideas for the second one").
   - 6 that must not trigger Heldly at all ("What's the weather in Seoul?").
2. Add a results table: date, model, passed out of 30, and the prompts that failed.
3. Run it once and record the result. For each failure, note whether the wrong tool fired, no
   tool fired, or a card tool was skipped for a data tool.
4. When T02 and T11 land, add three prompts for each new tool.

## Done when

- [ ] The file exists with 30 prompts and one recorded run.
- [ ] Each failure has a one-line note on the likely cause (description, skill, or instructions).

## Not in this task

Fixing the failures. Open a task per fix. Automating the run.
