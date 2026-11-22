# T55 — A guided first run in ChatGPT

Make the plugin's welcome, home and help agree on a single path: import memories → import Instagram and/or LinkedIn contacts → find connections with similar interests. Return to the first unfinished step. An explicit request outside onboarding still works. The signed-in web app keeps its own setup checklist.

- The memory flow was simplified in [T61](T61-card-memory-import.md): review and save selected drafts on the import card, not in chat. There is no automatic memory read.
- One confirmed platform import is enough; offer the other without requiring it. Never imply that the built-in preview was fetched from the user's account.
- Show exact versus related interest evidence from eligible people, including a useful empty state. No invitation, booking or message is sent.
- Test account isolation, resume, step order, no-match, narrow/dark widget, multiple review pages and the handoff from each success screen.

Rehearsal: open `/widget-preview?view=welcome` and follow the three steps. The standalone preview substitutes a single example interest for the ChatGPT conversation. `?view=memory_review_import` opens a 12-item review. With the built widget served at the origin root, run `VENN_ORIGIN=http://127.0.0.1:4199 node web/scripts/shots.mjs widget/onboarding-rehearsal.json`.
