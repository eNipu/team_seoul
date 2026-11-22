# T52 · People radar

**Goal.** Let someone explore proposed people by recent contact and common interests before adding private notes.

**Read first.** `widget/src/components/PeopleImport.tsx`, `backend/app/services/people_service.py`, and `docs/MCP_TOOLS.md`.

**Done when**

- People on both rings can be inspected and selected by keyboard or touch, including on a narrow screen.
- The radar explains its rings, shows namesake clues, and only labels a shared interest with supporting data and read permission.
- Selecting a marker reveals details. Saving requires confirmation. Reduced motion skips the entrance animation.
