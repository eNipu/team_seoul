# T41 · Venn discussion and thread cards

**Goal.** Use a recognizable Venn interface inside ChatGPT for a social result, an ongoing
discussion, or a thread recap. Preserve structured, consented data for product analytics and matching.

## Read first

- `docs/tasks/T39-chatgpt-replies.md`, `docs/MCP_TOOLS.md`, `docs/DATA_MODEL.md`
- `backend/app/schemas/reply.py`, `backend/app/services/reply_service.py`, `widget/src/components/Reply.tsx`

## Done when

- The shared widget header shows the Venn name and pen on every screen.
- ChatGPT can render a typed result, discussion prompt, or thread recap. A discussion answer can
  continue the chat from the card, with a copy fallback.
- Saved cards belong to their owner. A save adds a category and count to analytics once. Matching
  continues to use approved memories and structured people interests.
- The MCP contract tests and widget build pass. Verify result, discussion, and thread cards at
  phone width in light and dark themes.
