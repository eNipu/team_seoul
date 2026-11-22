# Developing Venn

Start with the [local quickstart](../README.md#quickstart), then use this guide to connect your development server to ChatGPT or prepare a deployment.

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
4. A Venn **dev sign-in** page opens. Sign in with your development username and passcode. For a new username, choose **Create account** to continue.

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
  A memory review card appears; a draft becomes a profile memory only when you approve it.
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

## Configuration

See [.env.example](../.env.example). Key settings:

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
3. Deploy the `Dockerfile` (it builds the widget and web app, runs `alembic upgrade head`, starts uvicorn).
4. Point `plugin/mcp.json` at `https://<host>/mcp`, fill real URLs in `plugin/plugin.json`
   (website, privacy policy, terms), and submit.

See [docs/SECURITY.md](SECURITY.md) for the full checklist.

### ChatGPT development listing

For a manually registered Venn app, open **Settings → Plugins → Venn → Manage app**.
Set **App name** to **Venn** and **App description** to “Keep private notes about people you
know, find shared interests, and plan time together.” The development listing in ChatGPT
has its own editable fields. After deploying an MCP change, use **Refresh tools** and open
**View details** to check what the host displays.

For a listing editor that accepts an icon, use [the 512 px Venn PNG](../web/public/venn-icon.png).
Use **Lifestyle** for category and **https://joinvennai.com** for website where those fields
are available. The packaged plugin also declares these details in [its manifest](../plugin/plugin.json).

### Railway deployment

Railway project `heldly` (the old product name), environment `production`:

| Service | Build and watch paths |
| --- | --- |
| `backend` | Serves MCP and My Venn. Builds from the root `Dockerfile` and watches `backend/`, `widget/`, `web/`, `Dockerfile`, and `.dockerignore`. |
| `site` | Serves the landing page and waitlist. Builds with Railpack from `/site` and watches `site/`. |
| `Postgres` | Private database used by both services. |

Both services track `main` in `eNipu/team_seoul`. Railway builds a service when a push or
merge into `main` changes one of its watched paths.

Branch feature and fix work from `dev` and open pull requests against `dev`. To release,
open a pull request from `dev` into `main`. Merge any direct production fix back into `dev`.

The documented beta configuration uses
`ENVIRONMENT=development` and `AUTH_MODE=dev`: the built-in sign-in page, behind
`DEV_AUTH_PASSCODE` (in the service's Variables tab). Anyone who has the passcode can sign in
under any username, so share it with the team only and do steps 1 and 2 above before real
users arrive.

```bash
curl https://app.joinvennai.com/readyz
```
