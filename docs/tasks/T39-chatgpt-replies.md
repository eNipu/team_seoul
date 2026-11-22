# T39 · Tailored replies inside ChatGPT

**Goal.** When Venn is invoked for a social question without a dedicated card, show the answer, a short checklist, or a copyable message draft in Venn's widget. Let the user keep a reply privately and find or delete it later.

## Read first

- `backend/app/mcp/server.py`, `backend/app/mcp/tools.py`, `plugin/skills/venn-social/SKILL.md`
- `widget/src/App.tsx`, `widget/src/mcp/client.ts`, `widget/src/types.ts`
- `docs/MCP_TOOLS.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`

## Done when

- A narrow, typed render tool accepts task-specific, model-generated content. Existing dedicated cards still take precedence for their matching intents.
- The widget has a fullscreen control on hosts that support it. All replies also work inline.
- Saving requires an explicit widget action. Saved replies are private, deduplicate on retry, and can be deleted by their owner.
- The MCP integration tests and widget builds pass. Check the reply and save/retry flows at phone width in light and dark themes.
