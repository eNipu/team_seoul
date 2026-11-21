# T24 · Say "people you know" where Venn describes itself

**Goal.** The text ChatGPT and a new user read first matches the site: Venn is for the people
you already know, at work or outside it, and helps you see how you could help each other.

## Read first

- `WAITLIST.md` › Words from the prototype that are not used
- `backend/app/mcp/server.py` › `INSTRUCTIONS` (first line and the set-up steps)
- `plugin/plugin.json` (descriptions), `plugin/skills/venn-social/SKILL.md` (opening section)
- `README.md` (first paragraph), `widget/src/components/` › the welcome and help cards
- `docs/tasks/T15-tool-selection-prompts.md`

## Do

1. Reword only the sentences that say who Venn is for. "Friends" stays wherever it names a
   feature or a person in the user's list ("friend card", "add my friend Maya").
2. Do not promise matching needs with offers before T11 ships. Until then say "stay in
   touch" and "find common ground".
3. No tool, scope, view or field is renamed. No tool description changes its trigger words.
4. If T15 is done, run its prompt set before and after and compare which tool is picked.

## Done when

- [ ] `INSTRUCTIONS`, `plugin.json`, the skill's opening, the README's first paragraph and
      the welcome card describe the same product in the same words.
- [ ] `make test && make lint`, widget typecheck and build pass.
- [ ] A new chat with "open Venn" still opens the home or welcome card.

## Not in this task

Renaming anything. The site (T21). New tools.
