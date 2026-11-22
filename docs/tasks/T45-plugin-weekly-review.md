# T45 · Weekly updates in the ChatGPT widget

**Goal.** Bring the landing-page weekly review layout into the plugin and save the updates a user approves.

**Read first**

- [Widget views](../../widget/README.md) and [memory tools](../MCP_TOOLS.md)
- `widget/src/components/MemoryReview.tsx`, `backend/app/mcp/tools.py`, and `backend/app/services/memory_service.py`

**Done when**

- Asking to update Venn for this week opens a review card with real drafts from the conversation.
- Users can select and edit drafts, set visibility, then save or discard them. Private is the default.
- Saving returns the approved records and their IDs. Reading the account back returns the same records.
- The layout fits desktop and narrow chat frames in both themes. Keyboard input, retries, and the
  ChatGPT memory import continue to work.
