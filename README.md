# Heldly — ChatGPT plugin

Heldly is a ChatGPT-native AI social companion. It remembers what matters to you — **only what
you approve** — and helps you stay close to friends: invite-code connections, activity ideas
based on shared interests, and gentle reconnection nudges. It never contacts anyone for you.

This repo contains the first version of the plugin:

- **MCP server** (`backend/`): Python, FastAPI + the official MCP Python SDK, streamable HTTP at `/mcp`, OAuth, SQLAlchemy 2 + Alembic (Postgres/Supabase, SQLite for dev).
- **Widget** (`widget/`): React UI rendered inside ChatGPT via MCP Apps (memory review, dashboard).
- **Plugin package** (`plugin/`): `plugin.json`, `mcp.json`, and the `heldly-social` skill.

Games are intentionally out of scope for this version.

## Quick start

Requirements: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 20+, (optional) Docker.

```bash
make setup    # uv sync, npm install, build widget, create .env from .env.example
make dev      # http://localhost:8081/mcp
make test     # 61 unit / integration / security tests (SQLite)
```

Check it's up: `curl localhost:8081/readyz`. Unauthenticated `POST /mcp` returns `401` with OAuth
discovery headers — that's expected.

With Docker (Postgres + server, migrations applied on start):

```bash
make docker-up                 # HELDLY_PORT / HELDLY_DB_PORT override 8081 / 5432
make test-postgres             # run the test suite against Postgres
```

## Connect it to ChatGPT

ChatGPT needs a public HTTPS URL. During development use a tunnel:

```bash
ngrok http 8081                # or: cloudflared tunnel --url http://localhost:8081
```

Then in `.env`:

```bash
PUBLIC_BASE_URL=https://<your-tunnel-host>
ALLOWED_HOSTS=["<your-tunnel-host>"]
DEV_AUTH_PASSCODE=<something>          # protects the dev sign-in page
```

Restart `make dev`, then either:

1. **ChatGPT → Settings → Plugins (developer mode) → Add custom MCP server** → URL
   `https://<your-tunnel-host>/mcp`, auth **OAuth** → *Create as plugin*. ChatGPT registers
   itself (DCR), sends you to the Heldly dev sign-in page, and you pick a username; or
2. **Install from the repo marketplace**: `.agents/plugins/marketplace.json` points at
   `./plugin`. Update `plugin/mcp.json` `url` to your tunnel URL first.

Try: *"Set up my Heldly profile"*, *"Show my Heldly dashboard"*, *"Create a Heldly invite
code"*, *"Who should I reconnect with?"*.

To test two users, sign in with a different username in another ChatGPT account (or the MCP
Inspector: `npx @modelcontextprotocol/inspector`).

## How it works

```
ChatGPT ──MCP (OAuth bearer)──▶ FastAPI /mcp ──▶ services ──▶ Postgres
   └─ widget iframe ◀── ui://heldly/app-v1.html  (calls tools back through the host)
```

- **Consent-based memories**: `heldly_propose_memories` creates a server-side proposal and
  shows a review card — nothing is saved. Only items the user approves are saved with
  `heldly_save_memories` (default visibility `PRIVATE`).
- **Connections**: invite code → connection request → friend accepts. Block/report built in.
- **Staying close**: activity suggestions from interests *both* people chose to share,
  hangout logging, reconnection suggestions.
- **Identity** always comes from the OAuth token, never from tool arguments.

22 tools in total — see [docs/MCP_TOOLS.md](docs/MCP_TOOLS.md).

## Configuration

See [.env.example](.env.example). Key settings:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite (default) or `postgresql://…` (Supabase works) |
| `PUBLIC_BASE_URL` / `MCP_BASE_URL` | Public URL; MCP resource defaults to `$PUBLIC_BASE_URL/mcp` |
| `AUTH_MODE` | `dev` (built-in OAuth server, refused in production) or `jwt` (your IdP) |
| `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL` | Required for `jwt` / production |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional LLM memory extraction (heuristic fallback otherwise) |

## Production

1. Pick an OAuth IdP (Auth0, Clerk, Supabase Auth, …), create an API with audience
   `https://<host>/mcp` and scopes `heldly.profile.read heldly.profile.write
   heldly.memories.read heldly.memories.write heldly.connections.manage`, enable DCR/PKCE.
2. Set `ENVIRONMENT=production`, `AUTH_MODE=jwt`, `OAUTH_*`, `DATABASE_URL`, `PUBLIC_BASE_URL`.
3. Deploy the `Dockerfile` (it builds the widget, runs `alembic upgrade head`, starts uvicorn).
4. Point `plugin/mcp.json` at `https://<host>/mcp`, fill real URLs in `plugin/plugin.json`
   (website, privacy policy, terms), and submit.

See [docs/SECURITY.md](docs/SECURITY.md) for the full checklist.

## Repository layout

```
plugin/                     plugin.json, mcp.json, skills/heldly-social/SKILL.md, assets/
.agents/plugins/            local marketplace entry
backend/
  app/main.py               FastAPI app factory (uvicorn app.main:create_app --factory)
  app/mcp/                  MCP server, tools, helpers
  app/auth/                 JWT verifier (prod), dev OAuth provider, identity mapping
  app/services/             memories, social graph, dashboard, analytics, consent
  app/ai/                   memory extraction + sensitive-data filter
  app/models/, migrations/  SQLAlchemy models, Alembic
  tests/                    unit/, integration/, security/
widget/                     React + Vite single-file MCP App
docs/                       ARCHITECTURE, DATA_MODEL, MCP_TOOLS, SECURITY
Makefile, Dockerfile, docker-compose.yml, .env.example
```

## Development

```bash
make lint            # ruff + widget typecheck
make format
make migration m="…" # autogenerate an Alembic revision
cd widget && npm run dev   # widget with mock data: ?view=memory_review | ?view=dashboard
```
