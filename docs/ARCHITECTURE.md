# Heldly architecture

Heldly is a ChatGPT-native social companion. Users talk to it inside ChatGPT; there is no
standalone consumer website. Scope of this first version: profile, consent-based memories,
invite-code connections, relationship maintenance. (Games are out of scope for now.)

```
ChatGPT ──(MCP over streamable HTTP, OAuth bearer)──▶ FastAPI app
   │                                                    ├── /mcp                MCP server (official Python SDK, MCPServer)
   │  renders                                           ├── /.well-known/*      OAuth protected-resource + AS metadata
   └── widget iframe (ui://heldly/app-v2.html) ◀────────├── /authorize /token /register /dev/login   (dev auth only)
        React, MCP Apps bridge                          ├── /healthz /readyz
        calls tools via host                            └── services ──▶ SQLAlchemy ──▶ Postgres (Supabase) / SQLite (dev)
                                                                     └─▶ OpenAI (optional memory extraction)
```

## Components

| Path | What |
| --- | --- |
| `plugin/` | Portable plugin package: `plugin.json`, `mcp.json`, `skills/heldly-social/SKILL.md`, assets |
| `.agents/plugins/marketplace.json` | Repo-local marketplace for installing the plugin during development |
| `backend/app/main.py` | `create_app()` — FastAPI app, mounts the MCP Starlette app, health checks, lifespan |
| `backend/app/mcp/server.py` | Builds `MCPServer` with the `Apps` extension, widget resource and auth |
| `backend/app/mcp/tools.py` | All 28 MCP tools (thin: auth → service → result) |
| `backend/app/mcp/common.py` | Scope constants, annotations, `run_as_user`, result/error shaping |
| `backend/app/auth/` | `JWTTokenVerifier` (production), `DevOAuthProvider` (development), identity mapping |
| `backend/app/services/` | Business logic: users, memories (+ search), social (invites/connections/blocking), people (notes on friends not on Heldly), relationship (friend view, activity ideas, reconnection), dashboard, analytics, consent |
| `backend/app/ai/extraction.py` | Memory candidate extraction (OpenAI structured output, heuristic fallback) and sensitive-data filter |
| `backend/app/models/` | SQLAlchemy 2 models; `backend/migrations/` Alembic |
| `widget/` | React + Vite single-file bundle rendered by ChatGPT (memory review, home, invite, friend, activity ideas, reconnect) |

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

- One HTML resource `ui://heldly/app-v2.html` (`text/html;profile=mcp-app`), built from
  `widget/` into a single file and served from `widget/dist/index.html` (fallback page if missing).
- Six *render* tools are bound to it via `_meta.ui.resourceUri`; each result carries a `view`
  discriminator the widget switches on: `heldly_propose_memories` (`memory_review`),
  `heldly_show_dashboard` (`dashboard`, or `welcome` for an empty account),
  `heldly_create_invite` (`invite`), `heldly_view_friend` (`friend`), `heldly_suggest_activity`
  (`activity_ideas`) and `heldly_reconnection_suggestions` (`reconnect`). All other tools are
  data tools without a template.
- The widget calls tools back through the host bridge — both data tools (save/edit/delete
  memories, edit profile, add/edit/delete people, respond to requests, log a hangout, revoke an
  invite) and other render tools to move between cards — so the same auth applies. Data tools
  the widget may call are marked `openai/widgetAccessible`.
- Bump the resource URI (`app-v3`) when shipping breaking widget changes; ChatGPT caches templates.

## Memory consent flow

```
user text / model candidates ──▶ heldly_propose_memories ──▶ MemoryProposal (server-side, 24h, owner-only)
                                                              │  nothing saved
                     user reviews in widget or chat ◀─────────┘
                                   │ approvals [{index, visibility, edits}]
                                   ▼
                          heldly_save_memories ──▶ Memory rows (default PRIVATE), proposal consumed
```

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
