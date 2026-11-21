# Heldly — ChatGPT plugin

Heldly is a ChatGPT-native AI social companion. It remembers what matters to you — **only what
you approve** — and helps you stay close to friends, whether or not they use Heldly:
invite-code connections, private notes on friends who aren't on it (import a whole list at
once), "who do I know who…" search, activity ideas for one friend or a group, a brief before
you meet and a recap after, reconnection nudges, and a quiz on how well you know your friends.
It never contacts anyone for you.

This repo contains the first version of the plugin:

- **MCP server** (`backend/`): Python, FastAPI + the official MCP Python SDK, streamable HTTP at `/mcp`, OAuth, SQLAlchemy 2 + Alembic (Postgres/Supabase, SQLite for dev).
- **Widget** (`widget/`): React UI rendered inside ChatGPT via MCP Apps (memory review, ChatGPT-memory import, home, invite with QR code, friend, activity ideas, reconnect, people import, people search, group plan, meetup brief and quiz cards).
- **Plugin package** (`plugin/`): `plugin.json`, `mcp.json`, and the `heldly-social` skill.

The one game is a quiz built from what friends chose to share; there are no other games.

## Quick start

Requirements: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 20+, (optional) Docker.

```bash
make setup    # uv sync, npm install, build widget, create .env from .env.example
make dev      # http://localhost:8081/mcp
make test     # unit / integration / security tests (SQLite)
```

Check it's up: `curl localhost:8081/readyz`. Unauthenticated `POST /mcp` returns `401` with OAuth
discovery headers — that's expected.

With Docker (Postgres + server, migrations applied on start):

```bash
make docker-up                 # HELDLY_PORT / HELDLY_DB_PORT override 8081 / 5432
make test-postgres             # run the test suite against Postgres
```

## Run it in ChatGPT (development)

ChatGPT runs in the cloud, so it can't reach `localhost`. It needs a public HTTPS URL that
points at your local server. Use a tunnel; the server's built-in dev OAuth handles sign-in.

### 1. Install and build (first time only)

```bash
make setup        # Python + widget deps, builds widget/dist/index.html, creates .env
```

### 2. Start a tunnel to port 8081

```bash
ngrok http 8081
# or: cloudflared tunnel --url http://localhost:8081
```

Copy the public host it prints, e.g. `abc123.ngrok-free.app` (just the host, no `https://`).
Keep the tunnel running.

### 3. Point the server at the tunnel

Edit `.env` in the repo root:

```bash
PUBLIC_BASE_URL=https://abc123.ngrok-free.app
ALLOWED_HOSTS=["abc123.ngrok-free.app"]
DEV_AUTH_PASSCODE=pick-a-passcode        # the sign-in page is public while tunneling
DEV_AUTH_SECRET=<long random string>     # e.g. output of: openssl rand -hex 32
```

Leave `MCP_BASE_URL` empty; it defaults to `$PUBLIC_BASE_URL/mcp`.

### 4. Start the server

```bash
make dev
```

Check it through the tunnel:

```bash
curl https://abc123.ngrok-free.app/readyz                                    # ready
curl https://abc123.ngrok-free.app/.well-known/oauth-protected-resource/mcp  # OAuth metadata
```

### 5. Add it to ChatGPT

1. In ChatGPT settings, turn on **developer mode** and open the plugins/apps settings.
2. Choose **Add custom MCP server**:
   - URL: `https://abc123.ngrok-free.app/mcp`
   - Authentication: **OAuth** (leave client ID/secret empty; ChatGPT registers itself)
3. Choose **Create as plugin** and connect.
4. A Heldly **dev sign-in** page opens. Enter any username (e.g. `alice`), a display name, and
   your `DEV_AUTH_PASSCODE`. The username becomes your Heldly identity.

Or install the packaged plugin from the repo marketplace: `.agents/plugins/marketplace.json`
points at `./plugin`. Set the `url` in `plugin/mcp.json` to your tunnel's `/mcp` URL first.

### 6. Try it

Start a new chat, enable Heldly, and try the prompts below. Heldly is meant to open with a
card: any opening prompt ("open Heldly", "set up my Heldly profile") should show the home or
welcome card rather than a text answer.

- *"Set up my Heldly profile. I love bouldering and ramen, and I want to meet new people."*
  A memory review card appears; nothing is saved until you approve it.
- *"Show my Heldly dashboard"* — a brand-new account gets a welcome card instead
- *"Import my ChatGPT memory into Heldly"* — pick the areas on the card; ChatGPT lists what it
  remembers about you in the chat, you say which to keep, and those come back as a review
  card. Needs ChatGPT's Memory to be on and to know something about you.
- *"Create a Heldly invite code"*
- *"Add my friend Maya to Heldly — college roommate, loves hiking, haven't seen her in two months"*
- *"What could I do with Maya?"*
- *"Who should I reconnect with?"*
- *"What did I save about food?"*
- *"Import my friends: Maya (college roommate, loves pottery), Tom (old coworker, cycling), …"*
  — or paste a list / upload a contacts export. A card lets you pick who to add.
- *"Who do I know who climbs?"*
- *"Plan something for me, Hana and Diego"*
- *"I'm seeing Maya tomorrow — brief me"*, and afterwards *"I had dinner with Maya, she got
  promoted; remind me to ask about Busan"*
- *"Quiz me on Jun"* or *"Play the Heldly quiz"* (needs friends who have shared a few things)

**Demo data:** most of these need friends. `make seed me=<your dev username>` adds three
demo connections (with shared memories and past hangouts), a pending request and five notes
about people who aren't on Heldly; it adds memories of your own only if you have none.
`make seed-remove me=<your dev username>` takes the demo data out again. Start a new chat
afterwards.

**Testing two users:** connect from a second ChatGPT account and sign in with a different
username (e.g. `bob`). Redeem alice's invite code as bob, then accept the request as alice.
You can also act as a second user with the MCP Inspector (`npx @modelcontextprotocol/inspector`,
connect to `https://abc123.ngrok-free.app/mcp`).

### Dev loop and troubleshooting

- **Python changes** reload automatically. **`.env` changes** need a restart of `make dev`.
- **Widget changes:** run `make build-widget`, then restart the server (it reads the widget at
  startup). ChatGPT may cache the UI; start a new chat if you still see the old one.
- **New tunnel URL** (free ngrok URLs change on restart): update `PUBLIC_BASE_URL` and
  `ALLOWED_HOSTS`, restart, then update the server URL in ChatGPT and reconnect. Old tokens
  are bound to the old URL and get rejected with 401.
- **Tool calls fail with `421 Invalid Host header`** (server log: `Invalid Host header`): the
  tunnel host is missing from `ALLOWED_HOSTS`. Sign-in still works in this case, because the
  host is only checked on authenticated `/mcp` requests.
- **Sign-in loops or `401` after connecting:** `PUBLIC_BASE_URL` doesn't match the URL ChatGPT
  uses, or `DEV_AUTH_SECRET` changed. Fix `.env`, restart, disconnect and reconnect.
- **Tools missing or out of date:** after adding or changing tools, refresh the connector in
  ChatGPT settings.
- **Server logs** show every MCP request; set `LOG_LEVEL=DEBUG` in `.env` for more detail.
- **Start over:** stop the server and delete `backend/heldly.db`. It is recreated on the next
  start.

## How it works

```
ChatGPT ──MCP (OAuth bearer)──▶ FastAPI /mcp ──▶ services ──▶ Postgres
   └─ widget iframe ◀── ui://heldly/app-v4.html  (calls tools back through the host)
```

- **Consent-based memories**: `heldly_propose_memories` creates a server-side proposal and
  shows a review card — nothing is saved. Only items the user approves are saved with
  `heldly_save_memories` (default visibility `PRIVATE`).
- **Import from ChatGPT memory**: Heldly cannot read ChatGPT's memory, so
  `heldly_import_chatgpt_memory` shows a card that asks ChatGPT to list what it remembers in
  the chat; only what you pick is proposed (`source: "chatgpt_memory"`) and only what you
  confirm is saved.
- **Connections**: invite code → connection request → friend accepts. Block/report built in.
- **Friends who aren't on Heldly**: private, owner-only notes (`heldly_add_person`) so they get
  activity ideas and reconnection nudges too. Never shared, never used to contact anyone.
- **Staying close**: a friend card, activity ideas from interests *both* people chose to share
  (or from your own notes), hangout logging, reconnection suggestions.
- **Import with review**: `heldly_propose_people_import` shows up to 50 candidates on a card;
  only the ones the user ticks are added. Contact details are stripped.
- **Find and plan**: `heldly_find_people` searches your notes and what friends shared;
  `heldly_plan_group` finds common ground for 2–6 friends.
- **Meetups**: `heldly_meetup_brief` before, `heldly_recap_meetup` after; follow-ups ("ask
  about…") carry over to the next brief. "Add to calendar" opens a prefilled Google Calendar
  link — Heldly has no calendar access.
- **Quiz**: `heldly_start_quiz` — "How well do you know Jun?" or "Who's who in your circle?".
  Uses only what friends shared with connections; scores aren't stored.
- **Invite link + QR**: the invite card shows a QR code for `/i/{CODE}`, a page with the code
  and how to redeem it.
- **Cards**: twelve tools render an interactive card in ChatGPT; the rest return data.
- **Identity** always comes from the OAuth token, never from tool arguments.

38 tools in total — see [docs/MCP_TOOLS.md](docs/MCP_TOOLS.md).

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
  app/services/             memories, social graph, people notes + import, relationship views, quiz, dashboard, analytics, consent
  scripts/seed_demo.py      demo data for a dev account (make seed me=<username>)
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
cd widget && npm run dev   # widget with mock data: ?view=memory_review | memory_import | dashboard | welcome |
                           #   invite | friend | friend_person | activity_ideas | reconnect
```
