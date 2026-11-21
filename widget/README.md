# Heldly widget (MCP Apps UI)

The embedded UI for **Heldly**, shown inside ChatGPT through the MCP Apps extension.
It's built with React 19, TypeScript, Vite 8 and `vite-plugin-singlefile`, and talks to the host with
[`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) (v2.0.4).

## Build & dev

```bash
npm install
npm run build      # tsc --noEmit && vite build → dist/index.html (one self-contained file)
npm run typecheck
npm run dev        # local demo harness
```

The Python server reads `widget/dist/index.html` and serves it as MCP resource
`ui://heldly/app-v2.html` with mimeType `text/html;profile=mcp-app`.

### Demo mode

When the page isn't inside a host iframe (`window.parent === window`), the widget uses a local
mock bridge (`src/mock.ts`) instead of the ext-apps connection. It also works straight from
`dist/index.html` over `file://`.

- `?view=memory_review|dashboard|invite|activity_ideas|reconnect|friend|friend_person|welcome`
  (`friend` is a Heldly connection, `friend_person` a private person note); no `view` → empty state
  with links to every demo view
- `&tab=profile|memories|friends` opens a dashboard tab
- `&theme=dark|light` forces a theme (default: `prefers-color-scheme`)
- `&flaky=1` makes every other tool call fail, so you can test the error banner and Retry

The mock bridge implements every tool listed below against one in-memory store, so the demo stays
coherent while navigating (a person added on the dashboard is still there after opening a friend
and going back). `updateModelContext` and `sendMessage` are logged to the console.

## Views

The widget renders the `structuredContent` of the latest host tool result (`ontoolresult`) and picks
a view from its `view` field. All payloads are treated as untrusted: `src/types.ts` coerces them into
typed objects with safe defaults (`parseView` and friends), and everything is rendered as text (no
`dangerouslySetInnerHTML`). While a tool is running (`ontoolinput`), the widget shows a skeleton that
roughly matches the incoming view. A tool result with `isError` shows an error banner (the leading
`CODE: ` prefix is stripped) and keeps the previous view.

| `view` | Produced by | What it shows |
| --- | --- | --- |
| `memory_review` | `heldly_propose_memories` | Proposed memories with a checkbox, editable title/description, visibility select. Nothing is saved until **Save selected**. |
| `dashboard` | `heldly_show_dashboard` | Tabs **Profile** (edit name/bio, goals, interests), **Memories** (search, grouped by category, edit, delete), **Friends** (pending requests, "On Heldly", "Private notes", add a person, invite, reconnect). |
| `welcome` | `heldly_show_dashboard` (new user) | Welcome, three points about Heldly, goal chips (max 6), **Get started**. |
| `invite` | `heldly_create_invite` | Code as a ticket, copy code / copy invite message, expiry, uses, revoke. |
| `activity_ideas` | `heldly_suggest_activity` | Shared interests, match meter with "Why this score?", suggestion cards with **Plan it** / **We did this**. |
| `reconnect` | `heldly_reconnection_suggestions` | Friends not seen for a while, with **Get ideas** / **Draft a message** / **We met up**. |
| `friend` | `heldly_view_friend` | Profile of a connection or a private person note, interests, shared memories, hangout timeline, actions. |
| anything else | | Empty state |

### Navigation

`App.tsx` keeps a small view stack. `openView(tool, args)` calls a tool, parses the result with
`parseView` and pushes it; **Back** in the header pops. A result delivered by the host resets the
stack to that one view. After going back, the revealed view is refreshed in the background
(`dashboard` → `heldly_show_dashboard {}`, `reconnect` → `heldly_reconnection_suggestions {}`,
`friend` → `heldly_view_friend`); the stale view stays visible, and is kept if the refresh fails.

### Contract summary

A friend is `{ kind: "connection" | "person", id }`. `friendArg(kind, id)` in `src/types.ts` turns
it into `{ connection_id: id }` or `{ person_id: id }`. Dates are ISO 8601 strings.

```
memory_review  { proposal_id, expires_at, proposals: [{ index, category, title, description, tags, suggested_visibility }] }
dashboard      { profile, memories: [Memory], connections: [Connection], people: [Person], pending_requests: [PendingRequest] }
welcome        { display_name, goal_options: [{ value, label }] }
invite         { code, expires_at, max_uses, share_text, note }
activity_ideas { kind, id, display_name, shared_interests, match_score (0..1), score_explanation,
                 suggestions: [{ title, description, grounded_in, suggested_action }], note }
reconnect      { min_days, candidates: [{ kind, id, display_name, days_since_last_interaction,
                 last_activity, reason, suggested_activity }] }
friend         { kind, id, display_name, on_heldly, since, last_interaction_at, bio, relationship, notes,
                 interests, shared_interests, shared_memories: [{ category, title, description, tags }],
                 recent_interactions: [{ occurred_at, activity }] }

Profile        { user_id, display_name, bio, social_goals, interests, memory_count, profile_visibility }
Memory         { memory_id, category, title, description, tags, visibility, created_at }
Connection     { connection_id, user_id, display_name, since, last_interaction_at }
Person         { person_id, name, relationship, notes, interests, last_interaction_at, created_at }
PendingRequest { request_id, sender_display_name, created_at }
```

Counts shown in the UI are derived from the arrays (`memories.length`, `connections.length +
people.length`), not from `profile.memory_count`.

## Tool calls made by the widget

| Trigger | Tool | Arguments | Expected `structuredContent` |
| --- | --- | --- | --- |
| Save selected | `heldly_save_memories` | `{ proposal_id, approvals: [{ index, visibility, title, description }] }` | `{ saved: Memory[], count }` |
| Back to dashboard; after accepting a request | `heldly_show_dashboard` | `{}` | `dashboard` view |
| Edit profile | `heldly_update_profile` | `{ display_name?, bio? }` (changed fields only) | Profile |
| Welcome → Get started | `heldly_update_profile` | `{ social_goals: string[] }` | Profile (result ignored) |
| Edit memory | `heldly_update_memory` | `{ memory_id, title?, description?, visibility? }` | Memory |
| Delete memory | `heldly_delete_memory` | `{ memory_id }` | `{ deleted: true, memory_id }` |
| Accept / Decline | `heldly_respond_to_connection` | `{ request_id, accept }` | `{ request_id, status, connection_id }` |
| Add a person | `heldly_add_person` | `{ name, relationship?, notes?, interests? }` | Person |
| Edit person | `heldly_update_person` | `{ person_id, name?, relationship?, notes?, interests? }` | Person |
| Delete person | `heldly_delete_person` | `{ person_id }` | `{ deleted: true, person_id }` |
| Remove connection | `heldly_remove_connection` | `{ connection_id }` | `{ removed: true, connection_id }` |
| Open a friend | `heldly_view_friend` | friendArg | `friend` view |
| Get ideas | `heldly_suggest_activity` | friendArg | `activity_ideas` view |
| Who should I reconnect with? | `heldly_reconnection_suggestions` | `{}` | `reconnect` view |
| We did this / We met up / Log a hangout | `heldly_log_interaction` | `{ ...friendArg, activity? }` | `{ recorded: true, kind, id, last_interaction_at }` |
| Invite a friend | `heldly_create_invite` | `{}` | `invite` view |
| Revoke code | `heldly_revoke_invite` | `{ code }` | `{ revoked: true }` |

Error text is taken from `content[].text` when the result has `isError: true`. Failed actions keep
the local state and show a banner with **Retry**. Buttons are disabled while a call is in flight.

## Host interactions (feature-detected)

- `updateModelContext`: after saving (`Saved N memories to Heldly profile: <titles>`) or discarding
  (`User discarded the proposed memories.`) proposed memories.
- `sendMessage`: **Plan it** (`Help me plan "<title>" with <name>. I will reach out myself.`),
  **Draft a message** (`Help me draft a short, warm message to reconnect with <name>. I will send it myself.`)
  and **Get started** (`Let's set up Heldly. Ask me a few questions about my interests and the people I want to stay close to.`).
  If the host doesn't support `message`, the widget shows the text to type in chat instead.
- Clipboard (invite): `navigator.clipboard.writeText`, then a hidden textarea + `execCommand("copy")`,
  then the text is selected with a "Press Ctrl/Cmd+C to copy" hint.
- Theme: `hostContext.theme` is applied with `applyDocumentTheme` (`data-theme` on `<html>`). Without
  it, the widget follows `prefers-color-scheme`.

## Layout

```
src/main.tsx               React entry
src/App.tsx                host connection / mock selection, view stack, skeletons, empty state
src/mcp/client.ts          wrapper around ext-apps App (HostBridge interface)
src/mock.ts                demo store + mock bridge (all tools)
src/types.ts               data contract, friendArg, defensive parsers, formatters
src/components/common.tsx  Avatar, useAction (busy / retry), chat prompts, copyText, small UI bits
src/components/            MemoryReview, Dashboard (+ MemoriesTab, FriendsTab), Friend, PersonForm,
                           Invite, ActivityIdeas, Reconnect, Welcome, ErrorBanner
src/styles.css             all styles; design tokens as CSS variables (light/dark)
```
