# T49 · Suggest a person and a plan before the user asks

**Goal.** In a Venn chat or on My Venn home, turn a real interest into one explained invitation idea with somebody already in the user's circle.

## Read first

- `backend/app/mcp/server.py`, `backend/app/services/relationship_service.py`, `plugin/skills/venn-social/SKILL.md`
- `web/src/pages/Home.tsx`, `docs/WEB_API.md`, `docs/MCP_TOOLS.md`

## Done when

- A concrete interest in Venn chat can trigger a quiet read, followed by one grounded person, a proposed activity, and an optional invite draft. Weak matches and solo plans don't prompt a card.
- A group follow-up keeps the original person and can bridge different people's interests without calling them a universal overlap.
- Signed-in home features one weekly action, prefers open follow-ups, and can proactively surface a separate one-on-one or small-group meetup from saved interests. No dependence on access to chat history.
- Opening a suggestion doesn't send, book, or save anything. No cross-user private data or strangers. Empty accounts still see onboarding.

## 60-second demo

1. Open `/app?demo=1`. Home already has a specific follow-up and a photo walk with Maya. Choose **Make it a group** to bring in Jun's interest in architecture, then **Draft an invite** to see the unsent message.
2. In ChatGPT, refresh the Venn connection after updating the server. Load the sample circle explicitly, then say “I fixed my film camera; I might take it out this weekend.” The grounded suggestion can feature Jun's shared film photography interest.
3. Choose **Make it a group**. The sample circle has Diego's hiking interest, so the planner can propose a trail photo walk. With a fresh, empty account, the same initial comment should produce no Venn suggestion card.
