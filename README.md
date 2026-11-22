# Venn — ChatGPT plugin

Venn is a ChatGPT-native AI social companion. It remembers what matters to you — **only what
you approve** — and helps you stay in touch and find the common ground with the people you
already know, friends and colleagues alike, whether or not they use Venn:
invite-code connections, private notes on friends who aren't on it (import a whole list at
once), "who do I know who…" search, activity ideas for one friend or a group, a brief before
you meet and a recap after, reconnection nudges, and a quiz on how well you know your friends.
It never contacts anyone for you.

This repo contains the first version of the plugin:

- **MCP server** (`backend/`): Python, FastAPI + the official MCP Python SDK, streamable HTTP at `/mcp`, OAuth, SQLAlchemy 2 + Alembic (Postgres/Supabase, SQLite for dev).
- **Widget** (`widget/`): React UI rendered inside ChatGPT via MCP Apps (memory review, ChatGPT-memory import, home, invite with QR code, friend, activity ideas, reconnect, people import, people search, group plan, meetup brief and quiz cards).
- **Website** (`web/`): the signed-in Venn web app (React + Vite), served by the backend at `/app`. Same account and same records as in ChatGPT; it works without ChatGPT. See [docs/WEB_API.md](docs/WEB_API.md).
- **Plugin package** (`plugin/`): `plugin.json`, `mcp.json`, and the `venn-social` skill.
- **Site** (`site/`): the public landing page, waitlist and `/metrics` (Next.js). See `site/README.md`.

The product was called Heldly before it became Venn, and the rename went all the way down: tool
names (`venn_save_memories`), OAuth scopes (`venn.profile.read`), the `ui://venn/app-v2.html`
resource, the skill folder, and the Docker and database names. Anything set up under the old name
has to be redone once: reconnect the server in ChatGPT, use the new scopes at the IdP, and see
"Coming from Heldly" under Dev loop and troubleshooting for a local database.

The one game is a quiz built from what friends chose to share; there are no other games.

## One account, two ways in

Venn is one service: use it inside ChatGPT, or sign in at the website (`http://localhost:8081/app`
in development). Both resolve to the same Venn user and call the same backend services, so the
same approval and visibility rules apply in both places.

- **In ChatGPT, start with a question**: "Who do I know who'd enjoy a photo walk?" Venn searches
  the user's records, says why each person came up, and helps draft an invitation the user sends.
- **On the website, start with a person or a plan**: add a friend, search the circle, review
  saved memories, see open follow-ups and plans. No chat session needed.
- **What carries over**: saved Venn records (approved memories, people, plans, follow-ups).
  ChatGPT chats and ChatGPT's own memory are **not** synced.
- **Linking**: connecting ChatGPT signs in to an existing Venn account. A username that has no
  account yet gets an explicit "Create account" step; nothing is created silently. If the
  browser is already signed in on the website, the connect page offers "Continue as …".
- **Friends don't need to join**: private notes, the Venn card (what you and a friend have in
  common), "This week", the quiz and sample friends all work with a single account. A friend
  can also answer four questions through a link without an account; the answers wait for the
  user's review.

Demo: in ChatGPT say *Remember that Maya and I used to take photo walks* and approve the card.
Open `/app`, sign in with the same username, search `photography`: Maya appears with
"From your memory “Take photo walks with Maya”."

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
make docker-up                 # VENN_PORT / VENN_DB_PORT override 8081 / 5432
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
4. A Venn **dev sign-in** page opens. Enter any username (e.g. `alice`), a display name, and
   your `DEV_AUTH_PASSCODE`. The username becomes your Venn identity.

Or install the packaged plugin from the repo marketplace: `.agents/plugins/marketplace.json`
points at `./plugin`. The package uses `https://app.joinvennai.com/mcp`. For local testing,
set the `url` in `plugin/mcp.json` to your tunnel's `/mcp` URL.
After changing tools or the widget, refresh the Venn connection in ChatGPT's Plugins settings.

### 6. Try it

Start a new chat, enable Venn, and try the prompts below. Venn is meant to open with a
card: any opening prompt ("open Venn", "set up my Venn profile") should show the home or
welcome card rather than a text answer. While set-up is unfinished it then goes straight into
it without being asked: first you (import your ChatGPT memory or answer two questions), then
your people (paste a list, upload contacts or name a few), then an invite for friends who use
ChatGPT. Say "skip" to move on. The home card shows the same three steps as a checklist with
buttons until they are done, and the **?** in the corner of any card (or *"help"*) opens a
card with everything Venn can do and examples to tap.

- *"Set up my Venn profile. I love bouldering and ramen, and I want to meet new people."*
  A memory review card appears; nothing is saved until you approve it.
- *"Show my Venn dashboard"* — a brand-new account gets a welcome card instead
- *"Import my ChatGPT memory into Venn"* — pick the areas on the card; ChatGPT lists what it
  remembers about you in the chat, you say which to keep, and those come back as a review
  card. Needs ChatGPT's Memory to be on and to know something about you.
- *"Create a Venn invite code"*
- *"Add my friend Maya to Venn — college roommate, loves hiking, haven't seen her in two months"*
- *"What could I do with Maya?"*
- *"Who should I reconnect with?"*
- *"Draft a low-pressure message inviting Maya for a photo walk"* — Venn opens a draft card
  with **Copy** and **Save privately**. The bookmark in the widget header opens saved replies.
- *"What did I save about food?"*
- *"Import my friends: Maya (college roommate, loves pottery), Tom (old coworker, cycling), …"*
  — or paste a list / upload a contacts export. A card lets you pick who to add.
- *"Who do I know who climbs?"*
- *"Plan something for me, Hana and Diego"*
- *"I'm seeing Maya tomorrow — brief me"*, and afterwards *"I had dinner with Maya, she got
  promoted; remind me to ask about Busan"*
- *"Quiz me on Jun"* or *"Play the Venn quiz"* (needs friends who have shared a few things)

**Demo data:** most of these need friends. `make seed me=<your dev username>` adds three
demo connections (with shared memories and past hangouts), a pending request and five notes
about people who aren't on Venn; it adds memories of your own only if you have none.
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
- **Start over:** stop the server and delete `backend/venn.db`. It is recreated on the next
  start.
- **Coming from Heldly:** the default SQLite file is now `backend/venn.db`; rename an old
  `backend/heldly.db` to keep its data. Docker Compose now creates a `venn` Postgres user and
  database, so an old volume has to be removed (`docker compose down -v`, which deletes its data) or
  dumped and restored. `HELDLY_PORT` / `HELDLY_DB_PORT` are now `VENN_PORT` / `VENN_DB_PORT`. Tokens issued
  with `heldly.*` scopes are rejected: disconnect and reconnect in ChatGPT.

## How it works

```
ChatGPT ──MCP (OAuth bearer)──▶ FastAPI /mcp ──▶ services ──▶ Postgres
   └─ widget iframe ◀── ui://venn/app-v2.html  (calls tools back through the host)
```

- **Consent-based memories**: `venn_propose_memories` creates a server-side proposal and
  shows a review card — nothing is saved. Only items the user approves are saved with
  `venn_save_memories` (default visibility `PRIVATE`).
- **Import from ChatGPT memory**: Venn cannot read ChatGPT's memory, so
  `venn_import_chatgpt_memory` shows a card that asks ChatGPT to list what it remembers in
  the chat; only what you pick is proposed (`source: "chatgpt_memory"`) and only what you
  confirm is saved.
- **Connections**: invite code → connection request → friend accepts. Block/report built in.
- **Friends who aren't on Venn**: private, owner-only notes (`venn_add_person`) so they get
  activity ideas and reconnection nudges too. Never shared, never used to contact anyone.
- **Staying close**: a friend card, activity ideas from interests *both* people chose to share
  (or from your own notes), hangout logging, reconnection suggestions.
- **Import with review**: `venn_propose_people_import` shows up to 50 candidates on a card;
  only the ones the user ticks are added. Contact details are stripped.
- **Find and plan**: `venn_find_people` searches your notes and what friends shared;
  `venn_plan_group` finds common ground for 2–6 friends.
- **Meetups**: `venn_meetup_brief` before, `venn_recap_meetup` after; follow-ups ("ask
  about…") carry over to the next brief. "Add to calendar" opens a prefilled Google Calendar
  link.
- **Calendar** (in progress, `docs/tasks/SCHEDULING.md`): set meeting hours with
  `venn_set_availability`; connect Google Calendar once from the link `venn_calendar_status`
  gives. Venn reads free/busy only.
- **Quiz**: `venn_start_quiz` — "How well do you know Jun?" or "Who's who in your circle?".
  Uses only what friends shared with connections; scores aren't stored.
- **Invite link + QR**: the invite card shows a QR code for `/i/{CODE}`, a page with the code
  and how to redeem it.
- **Set-up and help**: the home card carries a three-step set-up checklist (about you, your
  people, connect) until it is done, and the model is told to start it without being asked.
  `venn_help` shows what Venn can do, with examples to tap.
- **Cards**: nineteen tools render an interactive card in ChatGPT; the rest return data.
- **Identity** always comes from the OAuth token, never from tool arguments.

60 tools in total — see [docs/MCP_TOOLS.md](docs/MCP_TOOLS.md). The website's routes are in [docs/WEB_API.md](docs/WEB_API.md).

## Configuration

See [.env.example](.env.example). Key settings:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite (default) or `postgresql://…` (Supabase works) |
| `PUBLIC_BASE_URL` / `MCP_BASE_URL` | Public URL; MCP resource defaults to `$PUBLIC_BASE_URL/mcp` |
| `AUTH_MODE` | `dev` (built-in OAuth server, refused in production) or `jwt` (your IdP) |
| `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL` | Required for `jwt` / production |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional LLM memory extraction (heuristic fallback otherwise) |
| `APIFY_TOKEN` | Optional. Lets the website's "Import from LinkedIn" fetch company, location and skills for the connections you pick; without it they are imported with name and headline |

## Production

1. Pick an OAuth IdP (Auth0, Clerk, Supabase Auth, …), create an API with audience
   `https://<host>/mcp` and scopes `venn.profile.read venn.profile.write
   venn.memories.read venn.memories.write venn.connections.manage venn.calendar`, enable DCR/PKCE.
2. Set `ENVIRONMENT=production`, `AUTH_MODE=jwt`, `OAUTH_*`, `DATABASE_URL`, `PUBLIC_BASE_URL`.
3. Deploy the `Dockerfile` (it builds the widget, runs `alembic upgrade head`, starts uvicorn).
4. Point `plugin/mcp.json` at `https://<host>/mcp`, fill real URLs in `plugin/plugin.json`
   (website, privacy policy, terms), and submit.

See [docs/SECURITY.md](docs/SECURITY.md) for the full checklist.

### What runs on Railway today

Railway project `heldly` (the old product name), environment `production`:

| Service | URL | Notes |
| --- | --- | --- |
| `backend` | `https://app.joinvennai.com` (MCP at `/mcp`) | Root `/`, root `Dockerfile`. Watches `backend/`, `widget/`, `web/`, `Dockerfile`, and `.dockerignore`. |
| `site` | `https://joinvennai.com` | Root `/site`, Railpack. Watches `site/`. |
| `Postgres` | private network only | Used by both |

Both services track `main` in `eNipu/team_seoul`. Railway builds a service when a push or
merge into `main` changes one of its watched paths.

Branch feature and fix work from `dev` and open pull requests against `dev`. To release,
open a pull request from `dev` into `main`. Merge any direct production fix back into `dev`.

The backend is **not** in production mode. There is no identity provider yet, so it runs with
`ENVIRONMENT=development` and `AUTH_MODE=dev`: the built-in sign-in page, behind
`DEV_AUTH_PASSCODE` (in the service's Variables tab). Anyone who has the passcode can sign in
under any username, so share it with the team only and do steps 1 and 2 above before real
users arrive.

```bash
curl https://app.joinvennai.com/readyz
```

## Repository layout

```
plugin/                     plugin.json, mcp.json, skills/venn-social/SKILL.md, assets/
.agents/plugins/            local marketplace entry
backend/
  app/main.py               FastAPI app factory (uvicorn app.main:create_app --factory)
  app/mcp/                  MCP server, tools, helpers
  app/auth/                 JWT verifier (prod), dev OAuth provider, identity mapping
  app/web/                  website: session cookie, /api/v1 routes, serving web/dist at /app
  app/services/             memories, social graph, people notes + import, relationship views, quiz, dashboard, analytics, consent
  scripts/seed_demo.py      demo data for a dev account (make seed me=<username>)
  app/ai/                   memory extraction + sensitive-data filter
  app/models/, migrations/  SQLAlchemy models, Alembic
  tests/                    unit/, integration/, security/
widget/                     React + Vite single-file MCP App
web/                        React + Vite website for signed-in users (make build-web)
site/                       Next.js landing page, waitlist API and /metrics
docs/                       ARCHITECTURE, DATA_MODEL, MCP_TOOLS, SECURITY, WEB_API
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
