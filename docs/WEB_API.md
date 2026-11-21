# Venn web API

Venn is one service with two ways in: the ChatGPT plugin (MCP tools at `/mcp`) and the Venn website
(`web/`, served at `/app`). Both sign in to the same Venn account and call the same backend services,
so the approval, ownership and visibility rules are identical. This file describes the website's side:
sign-in and the JSON API under `/api/v1`.

What carries over between ChatGPT and the website: everything saved to Venn (approved memories, people,
plans, follow-ups, connections). What does not: ChatGPT conversations and ChatGPT's own memory. Venn only
ever holds what the user approved or typed in themselves.

## Sign-in

| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/session` | | `{signed_in, auth_mode, sign_in_available, passcode_required, display_name, username}` — never an error; `display_name` and `username` are null when signed out |
| `POST /api/v1/session` | `{username, display_name?, passcode?, create?}` | `{signed_in: true, user_id, display_name, username, created}` and sets the session cookie |
| `DELETE /api/v1/session` | | `{signed_out: true}` and clears the cookie |

- `POST /api/v1/session` with a username that has no Venn account yet answers 404 `NOT_FOUND` unless
  `create` is true. The page then offers "Create account". An account is never created silently.
- Usernames are 2–32 characters: lower-case letters, digits, `.`, `_`, `-`, starting with a letter or digit.
- The session is a cookie named `venn_session`: HttpOnly, SameSite=Lax, Secure when the site is served over
  HTTPS, valid for 30 days. It carries the same account identity that ChatGPT's access token carries, so both
  resolve to the same Venn user.
- With `AUTH_MODE=dev`, sign-in asks for a username (plus `DEV_AUTH_PASSCODE` when set; `passcode_required`
  says so). The same username is used when ChatGPT connects, and the ChatGPT connect page offers
  "Continue as …" when the browser is already signed in to the website. Wrong passcodes are rate-limited
  (429 `RATE_LIMITED`).
- With `AUTH_MODE=jwt` there is no cookie sign-in (`sign_in_available` is false). The API accepts
  `Authorization: Bearer <access token>` from the configured issuer (the same issuer ChatGPT uses), which
  resolves to the same account.

## Conventions

- JSON in, JSON out. Timestamps are ISO 8601 in UTC.
- Every request that changes something (`POST`, `PATCH`, `DELETE`) must send the header `X-Venn-Request: 1`
  and, with a body, `Content-Type: application/json`. Requests without the header are refused with 403. This,
  with the SameSite cookie, is the cross-site request protection.
- Errors: `{"error": {"code": "NOT_FOUND", "message": "person not found"}}` with status
  401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 400 `INVALID_REQUEST`, 422 `PRIVACY_VIOLATION`,
  429 `RATE_LIMITED`. Something that belongs to another account is reported as `NOT_FOUND`.
- `{kind}` is `connection` or `person`; `{id}` is the connection id or person id.
- Payload shapes are the same objects the MCP tools return (see `docs/MCP_TOOLS.md`).

## Routes

### Account
| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/me` | | `{user_id, display_name, username, auth_mode, mcp_url, profile: Profile}` (`username` is null outside dev sign-in) |
| `PATCH /api/v1/me` | `{display_name?, bio?, social_goals?}` | `Profile` |
| `DELETE /api/v1/me` | `{confirmation: "DELETE MY VENN ACCOUNT"}` | `{deleted: true}` and the session is cleared |
| `GET /api/v1/home` | | the home payload: `view: "dashboard"` or `view: "welcome"` |
| `GET /api/v1/help` | | the help payload (`view: "help"`) |

### Memories
| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/memories?q=&category=` | | `{memories: Memory[], count}`; with `q`, a keyword search |
| `POST /api/v1/memories` | `{category, title, description, tags?, visibility?, people?}` | `{memory: Memory, people_added: Person[]}` |
| `PATCH /api/v1/memories/{memory_id}` | `{title?, description?, visibility?}` | `Memory` |
| `DELETE /api/v1/memories/{memory_id}` | | `{deleted: true, memory_id}` |

A memory typed on the website is saved directly, because the user wrote and submitted it themselves. The same
limits and refusals apply as in ChatGPT (no credentials or financial/ID numbers). `people` names who the memory is about; names that are not in the user's circle yet are
added as private notes, and the form must say so before saving.

### People (private notes about friends who are not on Venn)
| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/people` | | `{people: Person[], count}` |
| `POST /api/v1/people` | `{name, relationship?, notes?, interests?, last_met_days_ago?}` | `Person` |
| `PATCH /api/v1/people/{person_id}` | `{name?, relationship?, notes?, interests?}` (`""` or `[]` clears) | `Person` |
| `DELETE /api/v1/people/{person_id}` | | `{deleted: true, person_id}` |
| `POST /api/v1/people/import-preview` | `{people: [{name, relationship?, notes?, interests?, last_met_days_ago?}], source?}` (1–50) | the people-import payload (`view: "people_import"`) |
| `POST /api/v1/people/import` | `{import_id, indexes: number[]}` | `{imported: Person[], count}` |

### Import from LinkedIn (website only)

| Route | Body | Returns |
|---|---|---|
| `POST /api/v1/linkedin/connections` | `{cookies}`: the user's LinkedIn session cookies (cookie-export JSON, `li_at=…; JSESSIONID=…`, or the bare `li_at` value) | `{connections: [{public_identifier, name, headline, profile_url, connected_on, already_added}], count, total, truncated, details_available, max_details, max_import}` |
| `POST /api/v1/linkedin/import-preview` | `{people: [{public_identifier, name, headline?}]}` (1–50) | the people-import payload plus `details_for` and `details_error`; confirm with `POST /api/v1/people/import` |

The first route reads the list behind `linkedin.com/mynetwork/invite-connect/connections/` with the
user's own session (`app/services/linkedin_service.py`) and saves nothing. The second fetches profile
details for the picked people from the Apify actor in `APIFY_PROFILE_ACTOR` when `APIFY_TOKEN` is set
(first 25), otherwise uses name and headline. People are added only by the normal import confirmation,
so they are ordinary people notes: the ChatGPT plugin finds them like any other. Errors: `400` cookies
not accepted, `429` LinkedIn or Venn rate limit (6 reads per hour per account), `502 UPSTREAM_ERROR`.
The same reader is available from the command line: `uv run python -m scripts.linkedin_connections`.

### Friends (connections and people together)
| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/friends` | | `{friends: FriendSummary[], count}` |
| `GET /api/v1/friends/{kind}/{id}` | | the friend payload (`view: "friend"`) |
| `GET /api/v1/friends/{kind}/{id}/venn` | | the Venn card payload (`view: "venn"`) |
| `GET /api/v1/friends/{kind}/{id}/ideas` | | the activity ideas payload (`view: "activity_ideas"`) |
| `GET /api/v1/friends/{kind}/{id}/brief` | | the meetup brief payload (`view: "brief"`) |
| `POST /api/v1/friends/{kind}/{id}/interactions` | `{activity?}` | `{recorded: true, kind, id, last_interaction_at}` |
| `POST /api/v1/friends/{kind}/{id}/follow-ups` | `{text}` | `FollowUp` |

`FriendSummary = {kind, id, display_name, on_venn, relationship|null, interests: string[],
last_interaction_at|null, since, is_sample, open_follow_ups: number}`

### Search, this week, reconnecting
| Route | Returns |
|---|---|
| `GET /api/v1/search?q=` | the people-search payload (`view: "people_search"`), including `why` per result and matching `memories` |
| `GET /api/v1/this-week` | the this-week payload (`view: "this_week"`) |
| `GET /api/v1/reconnect` | the reconnect payload (`view: "reconnect"`) |
| `GET /api/v1/quiz?connection_id=` | the quiz payload (`view: "quiz"`); without `connection_id`, a quiz on the whole circle |

### Follow-ups
| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/follow-ups` | | `{follow_ups: [{follow_up_id, text, created_at, kind, id, display_name}], count}` — every open follow-up, oldest first |
| `POST /api/v1/follow-ups/{follow_up_id}/done` | | `{done: true, follow_up_id}` |

### Plans
| Route | Body | Returns |
|---|---|---|
| `GET /api/v1/plans?status=` | | `{plans: Plan[], count}`; `status` is `planned` (default), `done` or `all` |
| `POST /api/v1/plans` | `{title, details?, planned_for?, connection_ids?, person_ids?}` | `Plan` |
| `POST /api/v1/plans/{plan_id}/done` | | `{done: true, plan_id, logged}` — also logs a hangout with every member |
| `DELETE /api/v1/plans/{plan_id}` | | `{deleted: true, plan_id}` |

`Plan = {plan_id, title, details|null, planned_for|null, status: "planned"|"done",
members: [{kind, id, display_name}], created_at}`

### Connecting with friends on Venn
| Route | Body | Returns |
|---|---|---|
| `POST /api/v1/invites` | `{max_uses?}` | the invite payload (`view: "invite"`) |
| `POST /api/v1/invites/redeem` | `{code}` | `{status, request_id, inviter_display_name, message}` |
| `POST /api/v1/requests/{request_id}` | `{accept: boolean}` | `{request_id, status, connection_id}` |

### Answers from friends without an account
| Route | Body | Returns |
|---|---|---|
| `POST /api/v1/question-links` | `{person_id?, name?}` | the ask-link payload (`view: "ask_link"`) |
| `DELETE /api/v1/question-links/{link_id}` | | `{revoked: true, link_id}` |
| `GET /api/v1/answers` | | the answers payload (`view: "answers"`) |
| `POST /api/v1/answers/{response_id}/save` | `{keys: string[], name?}` | `{saved: true, response_id, person: Person, added_interests: string[], follow_up: FollowUp|null}` |
| `DELETE /api/v1/answers/{response_id}` | | `{discarded: true, response_id}` |

The public page a friend opens is `GET /q/{token}` (no account, no cookie). It shows who is asking, four short
questions and what happens to the answers; `POST /q/{token}` stores them for the owner's review. Nothing from
that page is saved to the owner's notes until the owner approves it.

### Sample circle
| Route | Returns |
|---|---|
| `POST /api/v1/sample` | `{loaded: true, connections, people, pending_requests, memories_added}` |
| `DELETE /api/v1/sample` | `{removed: true, friends, people, memories}` |

## The website

The website is the single-page app in `web/`. The backend serves its build (`web/dist`) at `/app`: files under
`/app/assets/` are served as they are, and every other path under `/app/` returns `index.html`, so the app uses
ordinary URLs such as `/app/people`. `GET /` redirects to `/app`. The page and the API share one origin, so the
session cookie needs no cross-site settings. The marketing page in `site/` is separate and is not served by the
backend.
