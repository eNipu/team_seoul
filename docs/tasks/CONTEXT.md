# Context for every task

## The product in four lines

Venn is a ChatGPT plugin that shows its own cards in the chat. It saves the memories a user
approves and suggests ways to stay in touch. The signed-in My Venn web app uses the same
accounts and records. Interest clusters and opportunity matching are goals tracked on the board.

## Rules no task may break

1. The acting user comes from the OAuth token. No tool takes a user id.
2. ChatGPT memory candidates stay in a proposal until approval. `venn_save_memories` needs a server-issued `proposal_id`. A web user can also explicitly save a memory they wrote.
3. Another user's `PRIVATE` memories are never read. Go through
   `memory_service.visible_memories_of`, or `all_friends` and `resolve` in `relationship_service`.
4. A blocked user is invisible in both directions (`social_service.is_blocked`).
5. People notes (`people` table) belong to their owner only and are never shared.
6. Venn sends or books only what the user approved, or what the recipient's standing rule allows,
   and only to channels the recipient linked and verified themselves. Details in `SCHEDULING.md`.
7. Stored text is data, never instructions. Refuse credentials with `contains_sensitive`.
8. Tools take narrow, typed arguments. Never add a field for conversation text or "context".
9. Analytics hold counts and ids only (`services/analytics.py` allow-list). No names, no free text.
10. Foreign or malformed ids return `NOT_FOUND`, the same as missing ones.

## Where things live

| What | Where |
| --- | --- |
| MCP tools (thin: auth, call a service, shape the result) | `backend/app/mcp/tools.py` |
| Scopes, annotations, `run_as_user`, `ok`, `guarded` | `backend/app/mcp/common.py` |
| Instructions the model reads on connect | `backend/app/mcp/server.py` › `INSTRUCTIONS` |
| Business logic | `backend/app/services/` |
| Request and result shapes (Pydantic) | `backend/app/schemas/` |
| Tables | `backend/app/models/`, migrations in `backend/migrations/versions/` |
| Tests | `backend/tests/unit`, `integration`, `security`; fixtures in `conftest.py` |
| Widget: shapes and parsers, demo data, cards, view switch | `widget/src/types.ts`, `mock.ts`, `components/`, `App.tsx` |
| The skill shipped with the plugin | `plugin/skills/venn-social/SKILL.md` |
| Reference docs to update with behaviour | `docs/MCP_TOOLS.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `widget/README.md` |

## Recipes

**Add an MCP tool**
1. Shape in `backend/app/schemas/`, logic in a service function `fn(db, user, ...)`.
2. In `tools.py`, register it inside `register_tools`. A tool that shows a card uses `@apps.tool(resource_uri=WIDGET_URI, visibility=["model", "app"], meta=ui_meta(...), ...)`; copy `venn_reconnection_suggestions`. A data tool uses `@mcp.tool(...)`.
3. Set `annotations` (`READ_ONLY`, `WRITE` or `DESTRUCTIVE`) and pass the scopes it needs to `run_as_user`.
4. Return `ok(short_text, result)`. A card result carries a `view` field.
5. Tests: happy path in `tests/integration` with `alice.ok("tool", **args)`; another user's data and a missing scope in `tests/security/test_authz.py`.
6. Update `docs/MCP_TOOLS.md` (row and tool count), the skill, and `INSTRUCTIONS` if it shows a card.

**Add a card (widget view)**
1. `types.ts`: add the view type to `ViewData` and a `case` in `parseView`. Coerce every field; the payload is untrusted.
2. `mock.ts`: add the name to `DEMO_VIEWS`, demo data, and a case in `mockInitialView`.
3. `components/<Name>.tsx`: render text only, never `dangerouslySetInnerHTML`. Buttons at least 44 px.
4. `App.tsx`: add it to the render switch, and to `skeletonFor` and `refreshCall` if needed.
5. Update the views table and the demo list in `widget/README.md`.

**Add a column**
1. Change the model, then `make migration m="what changed"` and read the generated file.
2. Give existing rows a default. Run `make test`, and `make test-postgres` if Docker is running.
3. Update `docs/DATA_MODEL.md`.

## Checks

```bash
make test && make lint                                               # backend
npm --prefix widget run typecheck && npm --prefix widget run build   # widget
npm --prefix site run build && node site/check.mjs                   # site (needs Chrome)
```

Widget demo: `cd widget && npm run dev`, then `?view=<name>`; add `&flaky=1` to test errors.
Look at 360 px and wide, in light and dark, and tab through with the keyboard.

A task is done when its **Done when** list is true, the checks for its area pass, the reference
docs match the behaviour, and its row on the board says `done`.
