# Heldly MCP tools

Endpoint: `POST {PUBLIC_BASE_URL}/mcp` (streamable HTTP, stateless, JSON responses).
All tools require a valid OAuth bearer token. The acting user always comes from the token.

Every result has a short text summary for the model and, where useful, `structuredContent`.
Errors are returned as `isError: true` with text `CODE: message`:

| Code | Meaning |
| --- | --- |
| `UNAUTHENTICATED` | No/invalid token (normally rejected earlier with HTTP 401) |
| `FORBIDDEN` | Token lacks a scope for this tool |
| `NOT_FOUND` | Missing **or not yours** (deliberately indistinguishable) |
| `INVALID_REQUEST` | Bad input or state (expired/used proposal, own invite, …) |
| `RATE_LIMITED` | Daily limit hit (invites 30/day, connection requests 20/day) |
| `PRIVACY_VIOLATION` | Attempt to store credentials, card/ID numbers, API keys |

Scopes: `heldly.profile.read`, `heldly.profile.write`, `heldly.memories.read`,
`heldly.memories.write`, `heldly.connections.manage`. The server advertises all five in its
protected-resource metadata and requires them at the transport level; each tool additionally
checks the scopes it needs (defense in depth).

Annotations: **R** read-only, **W** write, **D** destructive (ChatGPT asks for confirmation).
**UI** = renders the widget (`_meta.ui.resourceUri = ui://heldly/app-v2.html`); the result's
`view` field tells the widget which card to show.

28 tools. A **friend** is addressed by exactly one of `connection_id` (someone on Heldly) or
`person_id` (a private note about someone who is not); results name it as `kind`
(`"connection"` \| `"person"`) + `id`.

**UI first.** The server instructions, the tool descriptions and the skill tell the model that the
first Heldly call in a conversation must render a card: the specific card if the request maps
to one, otherwise `heldly_show_dashboard` (home, or the welcome card for an empty account).
This is guidance to the model, not something the server can enforce.

## Profile

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_get_profile` | – | profile.read | R | `ProfileOut {user_id, display_name, bio, social_goals, interests, memory_count, profile_visibility, is_new}` — `is_new` until the first memory is approved. Data only: the model is told not to open a conversation with it |
| `heldly_update_profile` | `display_name?`, `bio?`, `social_goals?[]`, `profile_visibility?` | profile.write | W | `ProfileOut` |
| `heldly_delete_account` | `confirmation` = `"DELETE MY HELDLY ACCOUNT"` | profile.write | D | `{deleted: true}` |

## Memories

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_propose_memories` | `text?` (≤4000), `suggested?[]` (≤8 `{category, title, description, tags}`) | memories.write | W, UI | `{view: "memory_review", proposal_id, expires_at, proposals[{index, category, title, description, tags, suggested_visibility}], note}` — **saves nothing** |
| `heldly_save_memories` | `proposal_id`, `approvals[{index, visibility?, title?, description?}]` | memories.write | W | `{saved: MemoryOut[], count}` |
| `heldly_discard_memory_proposal` | `proposal_id` | memories.write | W | `{discarded, proposal_id}` |
| `heldly_list_memories` | `category?`, `limit?` (≤200) | memories.read | R | `{memories: MemoryOut[], count}` |
| `heldly_search_memories` | `query` (2–200 chars), `limit?` (≤50, default 10) | memories.read | R | `{memories: MemoryOut[], count}` — own memories only, best match first; every word must match (title/tags/category weigh more than description) |
| `heldly_update_memory` | `memory_id`, `title?`, `description?`, `visibility?` | memories.write | W | `MemoryOut` |
| `heldly_delete_memory` | `memory_id` | memories.write | D | `{deleted, memory_id}` |

`MemoryOut = {memory_id, category, title, description, tags, visibility, created_at}`.

## Home

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_show_dashboard` | – | profile.read, memories.read, connections.manage | R, UI | `{view: "dashboard", profile, memories[], connections[{connection_id, user_id, display_name, since, last_interaction_at}], people[Person], pending_requests[{request_id, sender_display_name, created_at}]}` — or, for an account with no memories, friends, requests or goals, `{view: "welcome", display_name, goal_options[{value, label}]}` |

## Invites & connections

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_create_invite` | `max_uses?` (1–20, default 5), `note?` | connections | W, UI | `{view: "invite", code, expires_at, max_uses, share_text, note}` |
| `heldly_list_invites` | – | connections | R | `{invites[]}` |
| `heldly_revoke_invite` | `code` | connections | W | `{revoked}` |
| `heldly_redeem_invite` | `code` | connections | W | `{status: PENDING\|ALREADY_PENDING\|ALREADY_CONNECTED, request_id, inviter_display_name, message}` |
| `heldly_list_connections` | – | connections | R | `{connections[], pending_requests[], outgoing_pending_count}` |
| `heldly_respond_to_connection` | `request_id`, `accept` | connections | W | `{request_id, status: ACCEPTED\|REJECTED, connection_id}` |
| `heldly_remove_connection` | `connection_id` | connections | D | `{removed, connection_id}` |
| `heldly_block_user` | `connection_id?` \| `request_id?` | connections | D | `{blocked}` |
| `heldly_report_user` | `reason`, `connection_id?` \| `request_id?` | connections | W | `{reported}` |

Unknown, revoked, expired, exhausted and blocked invite codes all return the same
`NOT_FOUND: invite code is invalid or expired`.

## People who are not on Heldly

Private, owner-only notes about friends who don't use Heldly, so they can get activity ideas
and reconnection nudges too. Never shared with anyone, never used to contact the person.

| Tool | Args | Scope | | Returns |
|---|---|---|---|---|
| `heldly_list_people` | – | connections | R | `{people: Person[], count}` |
| `heldly_add_person` | `name` (≤80), `relationship?` (≤80), `notes?` (≤1000), `interests?[]` (≤12 × ≤40), `last_met_days_ago?` | connections | W | `Person` |
| `heldly_update_person` | `person_id`, `name?`, `relationship?`, `notes?`, `interests?[]` — omitted = unchanged, `""`/`[]` clears | connections | W | `Person` |
| `heldly_delete_person` | `person_id` | connections | D | `{deleted, person_id}` |

`Person = {person_id, name, relationship, notes, interests[], last_interaction_at, created_at}`.
Limit: 200 people per user. Credentials and card/ID numbers are refused (`PRIVACY_VIOLATION`).

## Relationship maintenance

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_view_friend` | `connection_id` \| `person_id` | connections, memories.read | R, UI | `{view: "friend", kind, id, display_name, on_heldly, since, last_interaction_at, bio, relationship, notes, interests[], shared_interests[], shared_memories[{category, title, description, tags}], recent_interactions[{occurred_at, activity}], note}` |
| `heldly_suggest_activity` | `connection_id` \| `person_id` | connections, memories.read | R, UI | `{view: "activity_ideas", kind, id, display_name, shared_interests, match_score, score_explanation, suggestions[{title, description, grounded_in, suggested_action}], note}` |
| `heldly_log_interaction` | `connection_id` \| `person_id`, `activity?` (≤120) | connections | W | `{recorded, kind, id, last_interaction_at}` |
| `heldly_reconnection_suggestions` | `min_days?` (default 21), `limit?` (default 5) | connections, memories.read | R, UI | `{view: "reconnect", min_days, candidates[{kind, id, display_name, days_since_last_interaction, last_activity, reason, suggested_activity}]}` — connections and people together, longest gap first |

For a connection, the friend view and suggestions only use their `SHARED_WITH_CONNECTIONS`/
`PUBLIC_PROFILE` memories (and their `bio` only if their profile visibility is `CONNECTIONS` or
`PUBLIC`) plus the caller's own memories. For a person, they use the caller's own note. Shared
interests ignore filler words ("loves", "really", …). Heldly never contacts anyone.

## Resource

| URI | MIME | Content |
| --- | --- | --- |
| `ui://heldly/app-v2.html` | `text/html;profile=mcp-app` | The widget bundle (`widget/dist/index.html`) |

## Trying it locally

```bash
make dev
npx @modelcontextprotocol/inspector   # connect to http://localhost:8081/mcp, complete the dev OAuth flow
```
