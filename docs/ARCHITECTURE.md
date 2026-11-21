# Heldly architecture

Heldly is a ChatGPT-native social companion. Users talk to it inside ChatGPT; there is no
standalone consumer website. Scope of this first version: profile, consent-based memories,
invite-code connections, relationship maintenance. (Games are out of scope for now.)

```
ChatGPT ──(MCP over streamable HTTP, OAuth bearer)──▶ FastAPI app
   │                                                    ├── /mcp                MCP server (official Python SDK, MCPServer)
   │  renders                                           ├── /.well-known/*      OAuth protected-resource + AS metadata
   └── widget iframe (ui://heldly/app-v4.html) ◀────────├── /authorize /token /register /dev/login   (dev auth only)
        React, MCP Apps bridge                          ├── /healthz /readyz
        calls tools via host                            └── services ──▶ SQLAlchemy ──▶ Postgres (Supabase) / SQLite (dev)
                                                                     └─▶ OpenAI (optional memory extraction)
```

## Components

| Path | What |
| --- | --- |
| `plugin/` | Portable plugin package: `plugin.json`, `mcp.json`, `skills/heldly-social/SKILL.md`, assets |
| `.agents/plugins/marketplace.json` | Repo-local marketplace for installing the plugin during development |
| `backend/app/main.py` | `create_app()` — FastAPI app, mounts the MCP Starlette app, health checks, invite landing page (`/i/{code}`), lifespan |
| `backend/app/invite_page.py` | The static page behind an invite link / QR code |
| `backend/app/branding.py` | Shared look (mark, CSS, page shell) of the server-rendered pages: invite page and dev sign-in. No scripts or external requests |
| `backend/app/mcp/server.py` | Builds `MCPServer` with the `Apps` extension, widget resource and auth |
| `backend/app/mcp/tools.py` | All 39 MCP tools (thin: auth → service → result) |
| `backend/app/mcp/common.py` | Scope constants, annotations, `run_as_user`, result/error shaping |
| `backend/app/auth/` | `JWTTokenVerifier` (production), `DevOAuthProvider` (development), identity mapping |
| `backend/app/services/` | Business logic: users, memories (+ search), social (invites/connections/blocking), people (notes on friends not on Heldly, import review), relationship (friend view, activity ideas, reconnection, "who do I know who…" search, group plans, meetup brief/recap, follow-ups), quiz, dashboard (home, set-up steps, help), analytics, consent |
| `backend/scripts/seed_demo.py` | `make seed me=<dev username>` — demo friends for a development account |
| `backend/app/ai/extraction.py` | Memory candidate extraction (OpenAI structured output, heuristic fallback) and sensitive-data filter |
| `backend/app/models/` | SQLAlchemy 2 models; `backend/migrations/` Alembic |
| `widget/` | React + Vite single-file bundle rendered by ChatGPT (memory review, home with set-up checklist, help, invite, friend, activity ideas, reconnect, people import, people search, group plan, meetup brief, quiz) |

## Request flow

1. ChatGPT calls `POST /mcp` with `Authorization: Bearer <token>`. The SDK's auth middleware
   verifies the token (JWT/JWKS in production, dev provider in development), checks the
   required scopes and the audience/resource, and stores the `AccessToken` in a contextvar.
2. The tool handler calls `run_as_user(scopes, fn)`: it re-checks the tool's scopes, maps the
   token to a user (`auth_subject = "<issuer>|<sub>"`, created on first use), opens a DB
   transaction and runs the synchronous service function in a worker thread.
3. The service enforces ownership on every row it touches. Domain errors become
   `isError` tool results with text `CODE: message`.
4. Results contain short text for the model plus `structuredContent` for the widget.

User ids are **never** taken from tool arguments.

## Widget (MCP Apps)

- One HTML resource `ui://heldly/app-v4.html` (`text/html;profile=mcp-app`), built from
  `widget/` into a single file and served from `widget/dist/index.html` (fallback page if missing).
- Thirteen *render* tools are bound to it via `_meta.ui.resourceUri`; each result carries a `view`
  discriminator the widget switches on: `heldly_propose_memories` (`memory_review`),
  `heldly_import_chatgpt_memory` (`memory_import`),
  `heldly_show_dashboard` (`dashboard`, or `welcome` for an empty account), `heldly_help` (`help`),
  `heldly_create_invite` (`invite`), `heldly_view_friend` (`friend`), `heldly_suggest_activity`
  (`activity_ideas`), `heldly_reconnection_suggestions` (`reconnect`),
  `heldly_propose_people_import` (`people_import`), `heldly_find_people` (`people_search`),
  `heldly_plan_group` (`group_plan`), `heldly_meetup_brief` (`brief`) and `heldly_start_quiz`
  (`quiz`). All other tools are data tools without a template.
- The widget calls tools back through the host bridge — both data tools (save/edit/delete
  memories, edit profile, add/edit/delete people, confirm an import, respond to requests, log a
  hangout, add or tick off a follow-up, revoke an invite) and other render tools to move between cards — so the same auth applies. Data tools
  the widget may call are marked `openai/widgetAccessible`.
- The invite QR code is generated on the server (`segno`) and sent as rows of `0`/`1`, so the
  widget needs no QR library. "Add to calendar" builds a Google Calendar link in the widget and
  opens it through the host; Heldly itself has no calendar access.
- Bump the resource URI (`app-v5`) when shipping breaking widget changes; ChatGPT caches templates.

## Memory consent flow

```
user text / model candidates ──▶ heldly_propose_memories ──▶ MemoryProposal (server-side, 24h, owner-only)
                                                              │  nothing saved
                     user reviews in widget or chat ◀─────────┘
                                   │ approvals [{index, visibility, edits}]
                                   ▼
                          heldly_save_memories ──▶ Memory rows (default PRIVATE), proposal consumed
```

### Import from ChatGPT memory

The server has no access to ChatGPT's memory, so extraction and the first review happen in the
chat and only what the user picked is sent:

```
heldly_import_chatgpt_memory ──▶ chooser card (areas)          no data in, nothing saved
        │ "Preview my ChatGPT memory" → ui/message into the chat
        ▼
ChatGPT lists what it remembers, in the chat                    Heldly sees nothing
        │ user: "keep all except 3 and 7"
        ▼
heldly_propose_memories(source="chatgpt_memory", ≤30) ──▶ review card ──▶ heldly_save_memories
                                                                          Memory.source = chatgpt_memory
```

It depends on the user having ChatGPT's Memory / chat-history reference switched on and on
ChatGPT using it in a chat where the plugin is active; ChatGPT recalls what it finds relevant,
not a complete export of every past chat.

The model cannot fabricate approval: saving requires a server-issued `proposal_id` owned by the
caller, only indexes from that proposal are accepted, and each proposal can be used once.

## Connections

Invite codes (`XXXX-XXXX`, 72h, limited uses, revocable) → redeeming sends a connection request
→ the inviter accepts/declines → a canonical `connections` row (`user_a_id < user_b_id`).
Blocks prevent requests in both directions. Heldly never messages anyone; it only suggests.

## Auth modes

- `AUTH_MODE=jwt` (required in production): ChatGPT does OAuth with your IdP (Auth0, Clerk,
  Supabase Auth, ...). The server is only a resource server: it publishes protected-resource
  metadata pointing at `OAUTH_ISSUER` and validates RS/ES/PS-signed JWTs from `OAUTH_JWKS_URL`
  (`iss`, `aud`, `exp`, signature, scopes).
- `AUTH_MODE=dev`: a built-in OAuth authorization server (dynamic client registration, PKCE,
  a simple username sign-in page, HS256 tokens). Refused when `ENVIRONMENT=production`.

## Deployment

`Dockerfile` builds the widget and the backend and runs `alembic upgrade head` before
`uvicorn app.main:create_app --factory`. Behind a TLS-terminating proxy, set `PUBLIC_BASE_URL`
to the public https URL and add the host to `ALLOWED_HOSTS` if it differs. The MCP endpoint is
stateless (`stateless_http=True`, JSON responses), so it scales horizontally.
