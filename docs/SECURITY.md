# Venn security & privacy

## Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| Acting as another user by passing ids in tool args | Identity only from the verified token (`auth_subject = "<iss>\|<sub>"`). No tool accepts a user id. |
| Reading/modifying another user's rows | Every service query filters by the caller's user id; foreign ids return `NOT_FOUND` (no existence oracle). Tests in `backend/tests/security/`. |
| The model "approving" memories on its own | Saving requires a server-issued, owner-bound, expiring, single-use `proposal_id`; only indexes from that proposal are accepted. Text like `approved: true` is meaningless to the server. |
| Prompt injection via stored memories / friends' names | Stored text is returned as data in `structuredContent`; tool descriptions and the skill tell the model it is user data. The extraction prompt wraps user text in `<user_text>` and treats it as data. Tested: injected instructions are stored verbatim and do nothing. |
| Leaking private memories to friends | Only `SHARED_WITH_CONNECTIONS`/`PUBLIC_PROFILE` memories of a *connected* friend are used for suggestions and the friend view; a friend's bio is shown only if their profile visibility is `CONNECTIONS`/`PUBLIC`; `PRIVATE` is never read on another user's behalf. Default visibility is `PRIVATE`. |
| Notes about third parties (people not on Venn) | Created only when the user asks; owner-only on every query (foreign ids → `NOT_FOUND`); never shown to connections, never matched to Venn accounts, never used to contact anyone; same sensitive-data filter as memories; deleted individually or with the account. |
| The model bulk-adding people the user never saw | Importing requires a server-issued, owner-bound, expiring, single-use `import_id`; only indexes from that import are accepted, and only the user's choice on the card calls `venn_import_people`. Contact details (emails, links, phone numbers) are stripped and entries with credentials or card/ID numbers are dropped before the card is shown. Max 50 per import. |
| Search, group plans, briefs or quizzes leaking what a friend kept private | All of them read a connection through the same path as the friend view: non-`PRIVATE` memories of a *connected, unblocked* friend, and the bio only if their profile allows it. Foreign or blocked ids → `NOT_FOUND`. Quiz distractors are drawn only from the caller's own memories, other friends' *shared* memories and a fixed generic pool. Tested in `backend/tests/security/`. |
| Follow-ups ("ask about…") seen or changed by someone else | Owner-only on every query; a recap cannot tick off a follow-up that belongs to a different friend; the friend never sees them. |
| Invite link / QR page used to probe codes or phish | `GET /i/{code}` is static: no database lookup, no inviter name, identical for valid and invalid codes of the right shape, 404 otherwise. The code is validated against the invite alphabet and HTML-escaped. Strict CSP (`default-src 'none'`), no scripts, `X-Frame-Options: DENY`, `no-referrer`, `no-store`. Redeeming still requires signing in and the inviter's acceptance. |
| Storing secrets | Sensitive-data filter (passwords, API keys, card/SSN-like numbers) on proposals and on user edits → `PRIVACY_VIOLATION`. |
| Invite brute force / replay | 8-char codes from a 31-symbol alphabet (~8.5×10¹¹), 72h expiry, max uses, revocation, per-user daily rate limits; unknown/revoked/expired/used/blocked codes return an identical error. |
| Spam connection requests | Mutual consent required; one pending request per pair; 20 requests/day; blocks in both directions; reporting. |
| Unwanted outreach | Venn never contacts anyone; it only suggests and lets the user act. |
| Token forgery / misuse | Production: JWT verified against IdP JWKS (asymmetric algs only), `iss`, `aud` (= MCP resource URL), `exp`, `iat`, `sub` required, scopes checked. Refresh tokens are not accepted as access tokens. |
| DNS rebinding / cross-origin | MCP transport security with an allow-list of hosts (`PUBLIC_BASE_URL`, `ALLOWED_HOSTS`) and origins (ChatGPT). |
| Dev auth reaching production | `AUTH_MODE=dev` raises at startup when `ENVIRONMENT=production`; production also requires `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`. |

## Authentication

- **Production (`AUTH_MODE=jwt`)**: use an OAuth 2.1 IdP that supports dynamic client
  registration (or pre-registered clients) and PKCE — e.g. Auth0, Clerk, Stytch, WorkOS,
  Supabase Auth. Configure an API/audience equal to your MCP URL
  (`https://<host>/mcp`) and the five Venn scopes. ChatGPT discovers the IdP from
  `/.well-known/oauth-protected-resource/mcp`.
- **Development (`AUTH_MODE=dev`)**: built-in OAuth server with DCR + PKCE and a username-only
  sign-in page. Set `DEV_AUTH_SECRET` to a random value, and `DEV_AUTH_PASSCODE` whenever the
  server is reachable from the internet (e.g. through a tunnel). Anyone who can reach the dev
  sign-in page can pick any username — never use it with real user data.
- **Website**: in development the website signs in with the same username (and passcode) and gets
  an HttpOnly, SameSite=Lax session cookie signed with `DEV_AUTH_SECRET`; there are no per-account
  passwords, so the same warning applies. In production the website sends a bearer token from
  the same IdP; a hosted sign-in screen for that is not built yet. Every changing request must
  carry `X-Venn-Request: 1`, which a cross-site form cannot set. Signing in never creates an
  account without an explicit choice, on the website or on the ChatGPT connect page.

## Authorization

- Transport level: the SDK rejects requests without a valid token (401 with
  `WWW-Authenticate: Bearer … resource_metadata=…`) or without the required scopes (403).
- Tool level: each tool re-checks the scopes it needs.
- Data level: ownership checks in services (memories, proposals, invites, requests, connections,
  people notes, imports, follow-ups, plans, question links and answers). The website routes call
  the same services, so the same checks apply; another user's ids answer 404.
- Question links: the public page shows only the asker's display name; unknown, expired, revoked
  and used-up links look the same. It runs no scripts, requires a consent box, strips contact
  details, drops sensitive answers, and is capped per link and per owner. Answers are data for
  the owner's review, never instructions, and nothing is saved to a note until the owner approves.

## Privacy

- Memories are created only from explicit user approval; users can edit, change visibility,
  delete individual memories, or delete their whole account (cascading delete).
- Importing from ChatGPT memory: Venn's server cannot read ChatGPT's memory and never
  receives it wholesale. ChatGPT lists what it remembers in the chat; only the items the user
  picks there are sent to `venn_propose_memories`, and only the ones confirmed on the card are
  saved. Picked-but-unconfirmed items sit in the proposal for at most 24 hours and are deleted
  when the user confirms or discards. Health, money, credentials and ID numbers are not offered
  as areas, the model is told to leave them out, and the server drops credential and card/ID
  patterns. The "list in the chat first" step is guidance to the model, not something the server
  can verify — the guarantee the server gives is that nothing is saved without confirmation.
- People notes describe someone who has not agreed to anything, so they are kept deliberately
  small (name, how you know them, free-text notes, interests, hangout dates) and strictly
  private to their author. Unlike memories they are saved without a review card, because the
  user asks for them explicitly; the skill tells the model to store only what the user said and
  no contact, health or financial details.
- Importing several people goes through a review card (the user picks who to add); the model
  is told to leave out phone numbers, emails and addresses, and the server strips them anyway.
  A contacts file the user uploads is read by ChatGPT, not by Venn — Venn only receives the
  candidates the model extracted.
- Follow-ups and meetup recaps are private to the user. A recap can add to a *person* note; it
  never writes anything about another Venn user beyond the user's own follow-ups.
- Quizzes are built only from what friends chose to share with connections. Scores stay in the
  widget and are not stored; "Tell <name> my score" only drafts a message for the user to send.
- "Add to calendar" opens a prefilled Google Calendar link in the user's browser. Venn has no
  calendar access and sends nothing to Google itself.
- Analytics events use an allow-list of event names and metadata keys (`count`, `source`,
  `category`) and never contain memory text, names or messages.
- When `OPENAI_API_KEY` is set, the user's text passed to `venn_propose_memories` is sent to
  the OpenAI API for extraction (structured output). Without a key, a local heuristic is used.
- Logs do not include tokens or memory text.

## Operational checklist

- [ ] `ENVIRONMENT=production`, `AUTH_MODE=jwt`, `OAUTH_*` set
- [ ] HTTPS only; `PUBLIC_BASE_URL` is the public https URL
- [ ] Postgres with TLS; `alembic upgrade head` on deploy
- [ ] Least-privilege DB role (no superuser); backups enabled
- [ ] Secrets in a secret manager, not in images
- [ ] Monitor `RATE_LIMITED` / `abuse_reports`; review reports
- [ ] Demo data is not present (`make seed` refuses to run outside dev auth; `make seed-remove` cleans up)
- [ ] Privacy policy and terms URLs in `plugin/plugin.json` point at real pages
