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
**UI** = renders the widget (`_meta.ui.resourceUri = ui://heldly/app-v1.html`).

## Profile

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_get_profile` | – | profile.read | R | `ProfileOut {user_id, display_name, bio, social_goals, interests, memory_count, profile_visibility, is_new}` — `is_new` until the first memory is approved |
| `heldly_update_profile` | `display_name?`, `bio?`, `social_goals?[]`, `profile_visibility?` | profile.write | W | `ProfileOut` |
| `heldly_delete_account` | `confirmation` = `"DELETE MY HELDLY ACCOUNT"` | profile.write | D | `{deleted: true}` |

## Memories

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_propose_memories` | `text?` (≤4000), `suggested?[]` (≤8 `{category, title, description, tags}`) | memories.write | W, UI | `{view: "memory_review", proposal_id, expires_at, proposals[{index, category, title, description, tags, suggested_visibility}], note}` — **saves nothing** |
| `heldly_save_memories` | `proposal_id`, `approvals[{index, visibility?, title?, description?}]` | memories.write | W | `{saved: MemoryOut[], count}` |
| `heldly_discard_memory_proposal` | `proposal_id` | memories.write | W | `{discarded, proposal_id}` |
| `heldly_list_memories` | `category?`, `limit?` (≤200) | memories.read | R | `{memories: MemoryOut[], count}` |
| `heldly_update_memory` | `memory_id`, `title?`, `description?`, `visibility?` | memories.write | W | `MemoryOut` |
| `heldly_delete_memory` | `memory_id` | memories.write | D | `{deleted, memory_id}` |

`MemoryOut = {memory_id, category, title, description, tags, visibility, created_at}`.

## Dashboard

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_show_dashboard` | – | profile.read, memories.read, connections.manage | R, UI | `{view: "dashboard", profile, memories[], connections[{connection_id, user_id, display_name, since, last_interaction_at}], pending_requests[{request_id, sender_display_name, created_at}]}` |

## Invites & connections

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_create_invite` | `max_uses?` (1–20, default 5), `note?` | connections | W | `{code, expires_at, max_uses, share_text, note}` |
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

## Relationship maintenance

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `heldly_suggest_activity` | `connection_id` | connections, memories.read | R | `{connection_id, friend_display_name, shared_interests, match_score, score_explanation, suggestions[{title, description, grounded_in, suggested_action}], note}` |
| `heldly_log_interaction` | `connection_id`, `activity?` | connections | W | `{connection_id, recorded, last_interaction_at}` |
| `heldly_reconnection_suggestions` | `min_days?` (default 21), `limit?` (default 5) | connections | R | `{candidates[{connection_id, display_name, days_since_last_interaction, last_activity, reason, suggested_activity}]}` |

Suggestions only use the friend's `SHARED_WITH_CONNECTIONS`/`PUBLIC_PROFILE` memories and the
caller's own memories. Heldly never contacts anyone.

## Resource

| URI | MIME | Content |
| --- | --- | --- |
| `ui://heldly/app-v1.html` | `text/html;profile=mcp-app` | The widget bundle (`widget/dist/index.html`) |

## Trying it locally

```bash
make dev
npx @modelcontextprotocol/inspector   # connect to http://localhost:8000/mcp, complete the dev OAuth flow
```
