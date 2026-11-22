<img src="plugin/assets/logo.svg" alt="" width="64" height="64">

# Venn

Venn helps you stay in touch with people you already know. Ask ChatGPT “Who would enjoy a photo walk?” and Venn can surface a friend, show which saved interest led to the match, and draft an invitation for you to send. Open **My Venn** in a browser to see the same people, memories and plans.

[Try the weekly review](https://app.joinvennai.com/widget-preview?view=weekly_review) · [Open My Venn](https://app.joinvennai.com/app/) · [Visit the public site](https://joinvennai.com)

## From a conversation to a plan

1. **Review a memory.** Tell ChatGPT “Maya and I used to take photo walks.” Review the proposed wording and audience, then approve the items to keep. Profile memories default to private.
2. **Find common ground.** Search your circle using your own notes and the interests your connections chose to share. You can keep a private note about Maya even if she never joins Venn.
3. **Follow through.** Prepare for a meetup, save a plan, or keep a question for next time. You decide when to reach out.

## Quickstart

Use Python 3.12, [uv](https://docs.astral.sh/uv/), Node.js 22.12+ and Make. From the repository root, run:

```sh
make setup
make dev
```

Open [My Venn locally](http://localhost:8081/app/) and create a development account. To explore with sample data, open the [weekly review preview](http://localhost:8081/widget-preview?view=weekly_review). Setup builds both React clients and creates a local configuration. On startup the backend migrates its SQLite database. The default setup works without API keys.

| Developer task | Command |
| --- | --- |
| Check server and database readiness | `curl -fsS localhost:8081/readyz` |
| Add sample people to a development account | `make seed me=alice` (use your sign-in name) |
| Run backend tests against SQLite | `make test` |
| Check Python formatting, lint and both React clients’ types | `make lint` |
| Run the backend with PostgreSQL in Docker | `make docker-up` |

To try the local build inside ChatGPT, expose port 8081 over HTTPS and configure the public URL and development passcode. Follow the [ChatGPT connection guide](docs/DEVELOPMENT.md#run-it-in-chatgpt-development).

## Repository guide

| Component | Responsibility |
| --- | --- |
| [Backend](backend/) | FastAPI hosts the MCP endpoint, web API, and shared services for identity, consent and relationships. |
| [ChatGPT widget](widget/README.md) | React cards render tool results and send actions back through the host. |
| [My Venn](web/README.md) | The signed-in web app at `/app/` works independently of a ChatGPT session. |
| [Plugin package](plugin/) | Manifest, MCP connection and instructions for using Venn in chat. |
| [Public site](site/README.md) | A separate Next.js service hosts the product walkthrough, waitlist and launch metrics. |

Read the [architecture](docs/ARCHITECTURE.md) for request flows and consent boundaries. For implementation details, see the [MCP tool reference](docs/MCP_TOOLS.md), [web API](docs/WEB_API.md), [data model](docs/DATA_MODEL.md) and [security guide](docs/SECURITY.md). The [task board](docs/tasks/README.md) tracks planned work.

## Live endpoints

| Use | URL |
| --- | --- |
| Connect Venn in ChatGPT (MCP over streamable HTTP, OAuth) | [https://app.joinvennai.com/mcp](https://app.joinvennai.com/mcp) |
| Sign in to My Venn | [https://app.joinvennai.com/app/](https://app.joinvennai.com/app/) |
| Public landing page and waitlist | [https://joinvennai.com](https://joinvennai.com) |
| Preview the weekly review with sample data | [https://app.joinvennai.com/widget-preview?view=weekly_review](https://app.joinvennai.com/widget-preview?view=weekly_review) |
| MCP OAuth discovery | [Protected resource metadata](https://app.joinvennai.com/.well-known/oauth-protected-resource/mcp) · [Authorization server metadata](https://app.joinvennai.com/.well-known/oauth-authorization-server) |
| Backend and database readiness | [https://app.joinvennai.com/readyz](https://app.joinvennai.com/readyz) |

## Development and releases

See the [developer guide](docs/DEVELOPMENT.md) for tunnel setup, two-account testing, troubleshooting, the Heldly migration and deployment settings. Development sign-in uses a shared passcode when configured. Anyone with that passcode can sign in under another development username. Production requires an external identity provider.
