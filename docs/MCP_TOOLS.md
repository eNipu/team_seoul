# Venn MCP tools

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
| `PROVIDER_ERROR` | The calendar provider failed or the grant was revoked; the message says what to do |

Scopes: `venn.profile.read`, `venn.profile.write`, `venn.memories.read`,
`venn.memories.write`, `venn.connections.manage`, `venn.calendar`. The server advertises all six in its
protected-resource metadata and requires them at the transport level; each tool additionally
checks the scopes it needs (defense in depth). Tokens issued before `venn.calendar` existed
must reconnect once.

Annotations: **R** read-only, **W** write, **D** destructive (ChatGPT asks for confirmation).
**UI** = renders the widget (`_meta.ui.resourceUri = ui://venn/app-v4.html`); the result's
`view` field tells the widget which card to show.

64 tools, 21 of which render a card. A **friend** is addressed by exactly one of `connection_id` (someone on Venn) or
`person_id` (a private note about someone who is not); results name it as `kind`
(`"connection"` \| `"person"`) + `id`.

**UI first.** The server instructions, the tool descriptions and the skill tell the model that the
first Venn call in a conversation must render a card: the specific card if the request maps
to one, `venn_show_reply` for tailored social answers, or `venn_show_dashboard` for home and set-up.
The exception is a proactive `venn_find_nudge` lookup within a Venn conversation: a weak or
absent match should leave the conversation uninterrupted, not display a search card.

## Tailored replies

All four tools require `connections.manage` and publish an `outputSchema`. The `reply` argument is
a plain-text `title` (up to 100 characters) and `body` (up to 1,200), with fields selected by `kind`.
`advice`, `nudge` and `draft` use the common fields. A `nudge` proposes a small activity with one
matched person in its title and explains why in its body. **Draft an invite** requests an unsent
draft in chat; **Maybe later** dismisses the card locally. `checklist` adds one to six `steps` of up to 200
characters each. `discussion` adds one `question` of up to 200 characters. `thread` adds two to six
Venn-authored `entries` with a `title` (up to 100 characters) and `body` (up to 400) per entry.

The widget receives the render result through the MCP Apps bridge. The discussion form posts a
user-authorized turn to ChatGPT via `ui/message`. ChatGPT can call the reply tool again with the
next result or use a dedicated tool such as `venn_propose_memories` when the user asks to keep a
memory. The reply tool accepts the task-specific payload and has no conversation-history field.

| Tool | Arguments | Annotation | Result |
| --- | --- | --- | --- |
| `venn_show_reply` | `reply` | R, UI | `{view: "reply", reply}`. Displays only the task-specific answer. |
| `venn_save_reply` | `reply` | W, widget only | `{saved: true, reply_id}`. Saves the displayed reply privately when the user taps Save privately. Repeated saves return the same ID. |
| `venn_saved_replies` | – | R, UI | `{view: "saved_replies", count}`. The owner's replies are delivered most recent first in widget-only `_meta.replies[{reply_id, reply}]`. |
| `venn_delete_saved_reply` | `reply_id` | D, widget only | `{deleted: true}`. Removes the owner's saved reply. |
This is guidance to the model, not something the server can enforce.

**Guided setup.** “Open Venn” shows the first unfinished step on the card: import memories → import Instagram and/or LinkedIn contacts → find connections with similar interests. Welcome, dashboard and help carry `onboarding: { memories_ready, contacts_ready, matches_reviewed }`. Opening a review, loading a starter circle, or sending an invite does not complete a step. A user-approved non-sample memory and one confirmed platform contact suffice for the final step. An explicit search counts even if it finds no matches. Dedicated tools outside guided setup remain available. `setup[]` is the separate web checklist, not authoritative for plugin onboarding.

## Profile

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_get_profile` | – | profile.read | R | `ProfileOut {user_id, display_name, bio, social_goals, interests, memory_count, profile_visibility, is_new}` — `is_new` until the first memory is approved. Data only: the model is told not to open a conversation with it |
| `venn_update_profile` | `display_name?`, `bio?`, `social_goals?[]`, `profile_visibility?` | profile.write | W | `ProfileOut` |
| `venn_delete_account` | `confirmation` = `"DELETE MY VENN ACCOUNT"` | profile.write | D | `{deleted: true}` |
| `venn_get_availability` | – | profile.read | R | `AvailabilityOut {timezone, work_days[], day_start, day_end, buffer_minutes, min_notice_minutes, default_length_minutes, is_default}` — when the user takes meetings. `work_days` uses Monday = 0; times are local `HH:MM`. `is_default` until the first save |
| `venn_set_availability` | `timezone?` (IANA), `work_days?[]`, `day_start?`, `day_end?`, `buffer_minutes?` (0–60), `min_notice_minutes?` (0–10080), `default_length_minutes?` (15–120) | profile.write | W | `AvailabilityOut`. Only the given fields change |
| `venn_calendar_status` | – | calendar | R | `CalendarStatusOut {connected, provider, account_email, calendar_ids[], connect_url}` — `connect_url` only when not connected: `/calendar/connect?state=…`, valid 10 minutes, opened in the browser. The callback page says "Calendar connected" |
| `venn_disconnect_calendar` | – | calendar | D | `{disconnected}` — revokes the grant at the provider and deletes it |

## Memories

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_propose_memories` | `text?` (≤4000), `suggested?[]` (`{category, title, description, tags}`; ≤8, or ≤30 for an import), `source?` (`conversation` default \| `chatgpt_memory`), `weekly_update?` | memories.write | W, UI | `{view: "memory_review", proposal_id, expires_at, source, weekly_update?, proposals[{index, category, title, description, tags, suggested_visibility, already_saved}], note}` — creates a draft for approval. `already_saved` means the user already has a memory with that title. |
| `venn_import_chatgpt_memory` | – | memories.read | R, UI | `{view: "memory_import", areas[{value, label, description, selected}], always_excluded, imported_count, max_items, note}` — a chooser card; takes no data and saves nothing (see below) |
| `venn_save_memories` | `proposal_id`, `approvals[{index, visibility?, title?, description?}]` | memories.write | W | `{saved: MemoryOut[], count, people_added}` |
| `venn_discard_memory_proposal` | `proposal_id` | memories.write | W | `{discarded, proposal_id}` |
| `venn_list_memories` | `category?`, `limit?` (≤200) | memories.read | R | `{memories: MemoryOut[], count}` |
| `venn_search_memories` | `query` (2–200 chars), `limit?` (≤50, default 10) | memories.read | R | `{memories: MemoryOut[], count}` — own memories only, best match first; every word must match (title/tags/category weigh more than description) |
| `venn_update_memory` | `memory_id`, `title?`, `description?`, `visibility?` | memories.write | W | `MemoryOut` |
| `venn_delete_memory` | `memory_id` | memories.write | D | `{deleted, memory_id}` |

`MemoryOut = {memory_id, category, title, description, tags, visibility, source, created_at}`;
`source` is `"chatgpt_memory"` for imported memories, otherwise `null`. Categories: `INTEREST`,
`DISLIKE`, `PREFERENCE`, `EXPERIENCE`, `WORK`, `PERSONAL_MEMORY`, `SOCIAL_GOAL`,
`RELATIONSHIP_CONTEXT`.

For weekly updates, set `weekly_update: true` and pass `suggested` candidates based on this
conversation. The card starts private. Approving it saves the selected records with their chosen
visibility and returns them. On hosts that support model context updates, the widget passes back
the saved IDs, titles, and visibilities.

### Importing from ChatGPT memory

An MCP server cannot read ChatGPT's saved memories or other chats; only the model can see what
it remembers. So the import is a conversation, with Venn's cards at both ends:

1. `venn_import_chatgpt_memory` shows a card with six areas (interests, preferences, work,
   goals, experiences ticked; personal life unticked). Health, money, passwords and ID numbers
   are not offered.
2. "Preview my ChatGPT memory" posts a message into the chat (`ui/message`) asking ChatGPT to
   **list in the chat** what it remembers in those areas — up to three numbered items per turn, at most 30 total — and to send
   nothing to Venn yet.
3. The user says which ones to keep ("all except 3 and 7").
4. ChatGPT calls `venn_propose_memories` with `source: "chatgpt_memory"` and only those items.
   The usual review card appears, labelled as an import.
5. The user confirms; `venn_save_memories` stores them with `source = "chatgpt_memory"`.
   Items left unticked are deleted with the proposal.

Steps 2–4 are instructions to the model (tool descriptions, server instructions, skill, and the
message the card sends). The server cannot verify that the list was shown in the chat first; what
it does enforce is that nothing is saved without the user's confirmation on the card or in chat.

## Home

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_show_dashboard` | – | profile.read, memories.read, connections.manage | R, UI | `{view: "dashboard", profile, memories[], connections[{connection_id, user_id, display_name, since, last_interaction_at}], people[Person], pending_requests[{request_id, sender_display_name, created_at}]}` — or, for an account with no memories, friends, requests or goals, `{view: "welcome", display_name, goal_options[{value, label}], setup[]}`. The dashboard has `setup[{key, title, description, done}]` too (keys `about_you`, `your_people`, `connect`). |
| `venn_find_interest_matches` | `limit?` (1–20, default 10) | memories.read, connections.manage | UI | `{view: "interest_matches", matches[]}`. Each entry has `kind, id, display_name, interest_matches[{my_label, their_label, kind}]`. Exact before related; no messages or invitations. Records the lookup for setup. |
| `venn_help` | – | profile.read, memories.read, connections.manage | R, UI | `{view: "help", display_name, topics[{key, title, description, examples[]}], setup[], privacy[], note}` — what Venn can do, with example requests the user can tap (the widget sends the example as a chat message). Topic keys: `setup`, `memories`, `people`, `connect`, `stay_close`, `quiz`. Changes nothing. The widget header has a Help button that opens this card from any other card. |

## Invites & connections

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_create_invite` | `max_uses?` (1–20, default 5), `note?` | connections | W, UI | `{view: "invite", code, expires_at, max_uses, share_text, note, link, qr[]}` — `link` is `{PUBLIC_BASE_URL}/i/{CODE}`; `qr` is that link as a QR code, one string of `0`/`1` per row (`1` = dark, no quiet zone) |
| `venn_list_invites` | – | connections | R | `{invites[]}` |
| `venn_revoke_invite` | `code` | connections | W | `{revoked}` |
| `venn_redeem_invite` | `code` | connections | W | `{status: PENDING\|ALREADY_PENDING\|ALREADY_CONNECTED, request_id, inviter_display_name, message}` |
| `venn_list_connections` | – | connections | R | `{connections[], pending_requests[], outgoing_pending_count}` |
| `venn_respond_to_connection` | `request_id`, `accept` | connections | W | `{request_id, status: ACCEPTED\|REJECTED, connection_id}` |
| `venn_remove_connection` | `connection_id` | connections | D | `{removed, connection_id}` |
| `venn_block_user` | `connection_id?` \| `request_id?` | connections | D | `{blocked}` |
| `venn_report_user` | `reason`, `connection_id?` \| `request_id?` | connections | W | `{reported}` |

Unknown, revoked, expired, exhausted and blocked invite codes all return the same
`NOT_FOUND: invite code is invalid or expired`.

`GET /i/{CODE}` is a small public page for the person who receives a link or scans the QR code:
it shows the code, how to redeem it, and a button that opens ChatGPT with the redeem prompt
filled in. It is static — it never looks the code up, so it shows no inviter name and cannot be
used to test whether a code is valid. Malformed codes get a 404.

## People who are not on Venn

Private, owner-only notes about friends who don't use Venn, so they can get activity ideas
and reconnection nudges too. Never shared with anyone, never used to contact the person.

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_list_people` | – | connections | R | `{people: Person[], count}` |
| `venn_add_person` | `name` (≤80), `relationship?` (≤80), `notes?` (≤1000), `interests?[]` (≤12 × ≤40), `last_met_days_ago?` | connections | W | `Person` |
| `venn_update_person` | `person_id`, `name?`, `relationship?`, `notes?`, `interests?[]` — omitted = unchanged, `""`/`[]` clears | connections | W | `Person` |
| `venn_delete_person` | `person_id` | connections | D | `{deleted, person_id}` |

`Person = {person_id, name, relationship, notes, interests[], last_interaction_at, created_at}`.
Limit: 500 people per user. Credentials and card/ID numbers are refused (`PRIVACY_VIOLATION`).

### Importing several people at once

The user pastes a list, uploads a contacts file or just talks; the model turns that into
candidates and the user picks who to add on a card. Same shape as the memory flow: the
candidates are stored server-side, so nothing can be added that the user was not shown.

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_propose_people_import` | `people[]` (1–50 `{name, relationship?, notes?, interests?[], last_met_days_ago?}`), `source?` (≤60) | connections | W, UI | `{view: "people_import", import_id, expires_at, source, candidates[{index, name, relationship, notes, interests[], last_met_days_ago, already_added, existing_relationships[], shared_interests[]}], skipped, note}` — **adds nobody** |
| `venn_import_people` | `import_id`, `indexes[]` (1–50) | connections | W | `{imported: Person[], count}`; regular imports only |
| `venn_preview_demo_people_import` | `platform`: `"instagram"` or `"linkedin"` | connections | W, UI | `people_import` with `demo_platform` and 100 fictional candidates. Adds nobody; no social login or external API. Result `_meta` carries the review's confirmation token for the widget |
| `venn_import_demo_people` | `import_id`, `indexes[]` (1–100), `confirmation_token` | connections | W, widget callback | `{imported: Person[], count}`. Only the widget's **Add** button sends the token and selected indexes. Saves owner-only preview notes; **Clear preview data** clears them |

The demo confirmation callback is visible in tool discovery so ChatGPT can route widget calls.
Confirming still requires the initiating account and that review's unused, unexpired proposal
and widget-only token (`_meta["venn/demoImportConfirmation"]`, not in model-visible content).

Emails, links and phone numbers are stripped from names, relationships and notes; entries
containing credentials or card/ID numbers are dropped and counted in `skipped`. `already_added`
marks a name the user already has a note for. Review shows the saved relationship clues alongside the proposed clue. The user can explicitly select a namesake to create a separate private note with its own ID. An import is owner-only, single-use and expires
after 24 hours. With memory-read permission, all import previews return `interest_matches: [{my_label, their_label, kind}]` (`exact` or `related`); `shared_interests` remains exact-only. Related matches use a curated whole-label vocabulary, not bios or substrings. Both profile lists show both sides of a related match and put stronger matches first without changing the indexes used to confirm.

## Relationship maintenance

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_view_friend` | `connection_id` \| `person_id` | connections, memories.read | R, UI | `{view: "friend", kind, id, display_name, on_venn, since, last_interaction_at, bio, relationship, notes, interests[], shared_interests[], shared_memories[{category, title, description, tags}], recent_interactions[{occurred_at, activity}], follow_ups[FollowUp], note}` |
| `venn_suggest_activity` | `connection_id` \| `person_id` | connections, memories.read | R, UI | `{view: "activity_ideas", kind, id, display_name, shared_interests, match_score, score_explanation, suggestions[{title, description, grounded_in, suggested_action}], note}` |
| `venn_log_interaction` | `connection_id` \| `person_id`, `activity?` (≤120) | connections | W | `{recorded, kind, id, last_interaction_at}` |
| `venn_reconnection_suggestions` | `min_days?` (default 21), `limit?` (default 5) | connections, memories.read | R, UI | `{view: "reconnect", min_days, candidates[{kind, id, display_name, days_since_last_interaction, last_activity, reason, suggested_activity}]}` — connections and people together, longest gap first |

For a connection, the friend view and suggestions only use their `SHARED_WITH_CONNECTIONS`/
`PUBLIC_PROFILE` memories (and their `bio` only if their profile visibility is `CONNECTIONS` or
`PUBLIC`) plus the caller's own memories. For a person, they use the caller's own note. Shared
interests ignore filler words ("loves", "really", …). Venn never contacts anyone.

## Finding people and planning for a group

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_find_nudge` | `topic` (1–80), `connection_id?` or `person_id?` (first guest for group follow-up) | connections, memories.read | R, model only | `{match: null}` or `{match: {kind, id, display_name, source, evidence, reason}}`. Pass a concrete activity topic, not chat text. Returns at most one grounded match; no widget template. |
| `venn_find_people` | `query` (2–120), `limit?` (≤20, default 8) | connections, memories.read | R, UI | `{view: "people_search", query, results[{kind, id, display_name, on_venn, relationship, matched[], snippet, last_interaction_at}], count, searched, note}` |
| `venn_plan_group` | `connection_ids?[]`, `person_ids?[]` (2–6 friends in total), `activity_topic?` | connections, memories.read | R, UI | `{view: "group_plan", members[{kind, id, display_name, interests[]}], common_to_all[], common_to_some[{interest, members[]}], suggestions[{title, description, grounded_in, suggested_action}], note}` |

"Who do I know who…" searches the caller's own notes (name, relationship, notes, interests)
and what each connection chose to share (non-private memories, and the bio if their profile
allows it). Any query word may match; results that match more words come first. Matching is
by word stem ("climbs" finds "climbing"), with no model call. `searched` is how many friends
were looked at. In a group plan the caller counts as a member, named `You`. On a group follow-up,
keep the initial person and pass the original activity topic. A suggestion can pair two different
people’s interests; `grounded_in` identifies whose interest supports each part of the idea.

## Before and after a meetup

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_meetup_brief` | `connection_id` \| `person_id` | connections, memories.read | R, UI | `{view: "brief", kind, id, display_name, on_venn, relationship, notes, last_interaction_at, last_activity, days_since_last_interaction, interests[], shared_interests[], shared_memories[], things_to_ask[FollowUp], conversation_starters[], note}` |
| `venn_recap_meetup` | `connection_id` \| `person_id`, `activity?` (≤120), `follow_ups?[]` (≤5 × ≤200), `notes_to_add?` (≤500), `new_interests?[]`, `done_follow_up_ids?[]` | connections | W | `{recorded, kind, id, last_interaction_at, follow_ups[FollowUp], notes_updated}` |
| `venn_add_follow_up` | `text` (≤200), `connection_id` \| `person_id` | connections | W | `FollowUp` |
| `venn_complete_follow_up` | `follow_up_id` | connections | W | `{done, follow_up_id}` |

`FollowUp = {follow_up_id, text, created_at}` — something the user wants to ask about next time.
Follow-ups are private to the user (up to 20 open per friend). A recap logs the hangout, ticks
off `done_follow_up_ids`, adds new follow-ups and, for a person, appends `notes_to_add` to the
note and merges `new_interests`. It is all-or-nothing: if the note would pass 1000 characters,
nothing is recorded. For a connection `notes_to_add` and `new_interests` are ignored
(`notes_updated: false`), because Venn keeps no private notes about other users.

## Quiz

| Tool | Args | Scope | | Returns |
| --- | --- | --- | --- | --- |
| `venn_start_quiz` | `connection_id?` | connections, memories.read | R, UI | `{view: "quiz", mode: "friend"\|"circle", kind, id, display_name, title, questions[{prompt, options[], answer_index, explanation}], common_ground[], next{title, description}, note}` |

With `connection_id`: "How well do you know …?" — up to five questions built from what that
friend shares with connections; wrong options come from the caller's own memories, other
friends' shared memories and a generic pool, and never overlap the right answer. Without
arguments: "Who's who in your circle?" — which friend is into what, across connections and
people notes. Both need at least three questions' worth of material, otherwise
`INVALID_REQUEST`. Private memories are never used. The widget keeps score; nothing is stored.
The answers are in the payload, so the model is told not to reveal them before the user plays.

## Common ground, this week, plans

| Tool | Scope | Kind | Notes |
| --- | --- | --- | --- |
| `venn_compare {connection_id \| person_id}` | connections + memories.read | R, UI | `view: "venn"`: `you_only`, `shared`, `them_only`, `summary`, up to two grounded `suggestions`. Built from the user's memories and what they know about the friend (their notes, or what a connection chose to share). |
| `venn_this_week {}` | connections + memories.read | R, UI | `view: "this_week"`: up to three `actions` (`reach_out` with a `draft_message`, `follow_up`, `plan`). Drafts are for the user to copy; nothing is sent. |
| `venn_save_plan {title, details?, planned_for?, connection_ids?, person_ids?}` | connections | W | → `Plan`. Up to 6 members, all of them the user's own friends. |
| `venn_list_plans {}` | connections | R | open plans |
| `venn_complete_plan {plan_id}` | connections | W | marks it done and logs a hangout with every member |
| `venn_delete_plan {plan_id}` | connections | D | |

`venn_find_people` results carry `why` (e.g. `From your memory “Photo walks with Maya”.`) and the user's own
matching `memories`. A memory names who it is about in `people`; approving it adds unknown names as private notes,
and the review card says so (`new_people`) before the user approves.

## Answers from a friend without an account

| Tool | Scope | Kind | Notes |
| --- | --- | --- | --- |
| `venn_create_question_link {person_id?, name?}` | connections | W, UI | `view: "ask_link"`: a link (and QR) to four short questions. Expires after 14 days; one response when made for a person, otherwise up to 10. |
| `venn_review_answers {}` | connections | R, UI | `view: "answers"`: responses waiting for review, and the active links |
| `venn_save_answers {response_id, keys, name?}` | connections | W | saves the chosen answers to that person's note (interests, note lines, a thing to ask); creates the person if needed |
| `venn_discard_answers {response_id}` | connections | D | |
| `venn_revoke_question_link {link_id}` | connections | D | |

The friend's page is `GET /q/{token}`: no account, no scripts, a required consent box. Answers are stored for the
owner's review only; nothing reaches the owner's notes until they approve it.

## Sample friends

| Tool | Scope | Kind | Notes |
| --- | --- | --- | --- |
| `venn_load_sample_circle {}` | connections + memories.write | W | adds made-up friends, notes and (if the account has none) memories, all marked as samples |
| `venn_remove_sample_circle {}` | connections + memories.write | D | removes exactly those; the user's own data is untouched |

## Resource

| URI | MIME | Content |
| --- | --- | --- |
| `ui://venn/app-v4.html` | `text/html;profile=mcp-app` | The widget bundle (`widget/dist/index.html`) |
| `ui://venn/app-v2.html`, `ui://venn/app-v3.html` | `text/html;profile=mcp-app` | Compatibility aliases for older cards |

## Trying it locally

```bash
make dev
npx @modelcontextprotocol/inspector   # connect to http://localhost:8081/mcp, complete the dev OAuth flow
```
