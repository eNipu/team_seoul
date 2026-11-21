# Heldly security & privacy

## Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| Acting as another user by passing ids in tool args | Identity only from the verified token (`auth_subject = "<iss>\|<sub>"`). No tool accepts a user id. |
| Reading/modifying another user's rows | Every service query filters by the caller's user id; foreign ids return `NOT_FOUND` (no existence oracle). Tests in `backend/tests/security/`. |
| The model "approving" memories on its own | Saving requires a server-issued, owner-bound, expiring, single-use `proposal_id`; only indexes from that proposal are accepted. Text like `approved: true` is meaningless to the server. |
| Prompt injection via stored memories / friends' names | Stored text is returned as data in `structuredContent`; tool descriptions and the skill tell the model it is user data. The extraction prompt wraps user text in `<user_text>` and treats it as data. Tested: injected instructions are stored verbatim and do nothing. |
| Leaking private memories to friends | Only `SHARED_WITH_CONNECTIONS`/`PUBLIC_PROFILE` memories of a *connected* friend are used for suggestions and the friend view; a friend's bio is shown only if their profile visibility is `CONNECTIONS`/`PUBLIC`; `PRIVATE` is never read on another user's behalf. Default visibility is `PRIVATE`. |
| Notes about third parties (people not on Heldly) | Created only when the user asks; owner-only on every query (foreign ids → `NOT_FOUND`); never shown to connections, never matched to Heldly accounts, never used to contact anyone; same sensitive-data filter as memories; deleted individually or with the account. |
| Storing secrets | Sensitive-data filter (passwords, API keys, card/SSN-like numbers) on proposals and on user edits → `PRIVACY_VIOLATION`. |
| Invite brute force / replay | 8-char codes from a 31-symbol alphabet (~8.5×10¹¹), 72h expiry, max uses, revocation, per-user daily rate limits; unknown/revoked/expired/used/blocked codes return an identical error. |
| Spam connection requests | Mutual consent required; one pending request per pair; 20 requests/day; blocks in both directions; reporting. |
| Unwanted outreach | Heldly never contacts anyone; it only suggests and lets the user act. |
| Token forgery / misuse | Production: JWT verified against IdP JWKS (asymmetric algs only), `iss`, `aud` (= MCP resource URL), `exp`, `iat`, `sub` required, scopes checked. Refresh tokens are not accepted as access tokens. |
| DNS rebinding / cross-origin | MCP transport security with an allow-list of hosts (`PUBLIC_BASE_URL`, `ALLOWED_HOSTS`) and origins (ChatGPT). |
| Dev auth reaching production | `AUTH_MODE=dev` raises at startup when `ENVIRONMENT=production`; production also requires `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`. |

## Authentication

- **Production (`AUTH_MODE=jwt`)**: use an OAuth 2.1 IdP that supports dynamic client
  registration (or pre-registered clients) and PKCE — e.g. Auth0, Clerk, Stytch, WorkOS,
  Supabase Auth. Configure an API/audience equal to your MCP URL
  (`https://<host>/mcp`) and the five Heldly scopes. ChatGPT discovers the IdP from
  `/.well-known/oauth-protected-resource/mcp`.
- **Development (`AUTH_MODE=dev`)**: built-in OAuth server with DCR + PKCE and a username-only
  sign-in page. Set `DEV_AUTH_SECRET` to a random value, and `DEV_AUTH_PASSCODE` whenever the
  server is reachable from the internet (e.g. through a tunnel). Anyone who can reach the dev
  sign-in page can pick any username — never use it with real user data.

## Authorization

- Transport level: the SDK rejects requests without a valid token (401 with
  `WWW-Authenticate: Bearer … resource_metadata=…`) or without the required scopes (403).
- Tool level: each tool re-checks the scopes it needs.
- Data level: ownership checks in services (memories, proposals, invites, requests, connections,
  people notes).

## Privacy

- Memories are created only from explicit user approval; users can edit, change visibility,
  delete individual memories, or delete their whole account (cascading delete).
- People notes describe someone who has not agreed to anything, so they are kept deliberately
  small (name, how you know them, free-text notes, interests, hangout dates) and strictly
  private to their author. Unlike memories they are saved without a review card, because the
  user asks for them explicitly; the skill tells the model to store only what the user said and
  no contact, health or financial details.
- Analytics events use an allow-list of event names and metadata keys (`count`, `source`,
  `category`) and never contain memory text, names or messages.
- When `OPENAI_API_KEY` is set, the user's text passed to `heldly_propose_memories` is sent to
  the OpenAI API for extraction (structured output). Without a key, a local heuristic is used.
- Logs do not include tokens or memory text.

## Operational checklist

- [ ] `ENVIRONMENT=production`, `AUTH_MODE=jwt`, `OAUTH_*` set
- [ ] HTTPS only; `PUBLIC_BASE_URL` is the public https URL
- [ ] Postgres with TLS; `alembic upgrade head` on deploy
- [ ] Least-privilege DB role (no superuser); backups enabled
- [ ] Secrets in a secret manager, not in images
- [ ] Monitor `RATE_LIMITED` / `abuse_reports`; review reports
- [ ] Privacy policy and terms URLs in `plugin/plugin.json` point at real pages
