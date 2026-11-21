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
`ui://heldly/app-v4.html` with mimeType `text/html;profile=mcp-app`.

### Demo mode

When the page isn't inside a host iframe (`window.parent === window`), the widget uses a local
mock bridge (`src/mock.ts`) instead of the ext-apps connection. It also works straight from
`dist/index.html` over `file://`.

- `?view=memory_review|dashboard|invite|activity_ideas|reconnect|friend|friend_person|welcome|`
  `people_import|people_search|group_plan|brief|brief_person|quiz|quiz_circle|memory_import|memory_review_import`
  (`friend`/`brief`/`quiz` use a Heldly connection, `friend_person`/`brief_person` a private person
  note, `quiz_circle` is the circle quiz, `memory_review_import` is a 12-item review card with
  `source: "chatgpt_memory"`, two of them already saved); no `view` → empty state with links to every demo view
- `&tab=profile|memories|friends` opens a dashboard tab
- `&theme=dark|light` forces a theme (default: `prefers-color-scheme`)
- `&flaky=1` makes every other tool call fail, so you can test the error banner and Retry
- `&nochat=1` makes `sendMessage` fail, so you can test the copy-and-paste fallbacks

The mock bridge implements every tool listed below against one in-memory store, so the demo stays
coherent while navigating (a person added on the dashboard is still there after opening a friend
and going back; imported people show up on the dashboard, in search and in the circle quiz;
follow-ups persist). `updateModelContext` and `sendMessage` are logged to the console; `openLink`
uses `window.open`. Demo invites get a real QR code from a tiny demo-only encoder
(`src/mockQr.ts`); in production the server sends the `qr` rows.

## Views

The widget renders the `structuredContent` of the latest host tool result (`ontoolresult`) and picks
a view from its `view` field. All payloads are treated as untrusted: `src/types.ts` coerces them into
typed objects with safe defaults (`parseView` and friends), and everything is rendered as text (no
`dangerouslySetInnerHTML`). While a tool is running (`ontoolinput`), the widget shows a skeleton that
roughly matches the incoming view. A tool result with `isError` shows an error banner (the leading
`CODE: ` prefix is stripped) and keeps the previous view.

| `view` | Produced by | What it shows |
| --- | --- | --- |
| `memory_review` | `heldly_propose_memories` | Proposed memories (up to 30) with a checkbox, editable title/description, visibility select. More than 3 items adds "N of M selected", **Select all** / **None** and a sticky action bar. Items with `already_saved` start unticked with an "Already in Heldly" badge. With `source: "chatgpt_memory"` the card is titled "From your ChatGPT memory" and the success state offers **Open my Heldly**. Nothing is saved until **Save selected**. |
| `memory_import` | `heldly_import_chatgpt_memory` | "Bring your ChatGPT memory with you": one checkbox per area, the always-excluded note, **Preview my ChatGPT memory** (sends a prompt into the chat), then "Check the chat" with **Choose again**, or the prompt to copy when the host refuses the message. Nothing is sent to Heldly from this card. |
| `dashboard` | `heldly_show_dashboard` | Tabs **Profile** (edit name/bio, goals, interests), **Memories** ("Sources" row for ChatGPT memory with **Import from ChatGPT** / **Import more**, search, grouped by category, "From ChatGPT" badge, edit, delete), **Friends** (search "Who do I know who…", invite, reconnect, quick actions **Import friends** / **Play a quiz** / **Plan a group hangout** (pick 2 to 6 friends), pending requests, "On Heldly", "Private notes", add a person). |
| `welcome` | `heldly_show_dashboard` (new user) | Welcome, three points about Heldly, **Import my ChatGPT memory** (secondary), goal chips (max 6), **Get started** (primary). |
| `invite` | `heldly_create_invite` | Code as a ticket, QR code ("Scan to connect", when `qr` is non-empty), copy code / copy invite message / copy link (when `link` is non-empty), expiry, uses, revoke. |
| `activity_ideas` | `heldly_suggest_activity` | Shared interests, match meter with "Why this score?", suggestion cards with **Plan it** / **We did this** / **Add to calendar**. |
| `reconnect` | `heldly_reconnection_suggestions` | Friends not seen for a while, with **Get ideas** / **Draft a message** / **We met up**. |
| `friend` | `heldly_view_friend` | Profile of a connection or a private person note, "Things to ask about" (tick off / add), interests, shared memories, hangout timeline, actions incl. **Prep for a meetup** and (connections) **Quiz**. |
| `people_import` | `heldly_propose_people_import` | Checklist of proposed people (already-added ones unchecked), Select all / None, **Add N people**, then a success state. Nothing is saved until confirmed. |
| `people_search` | `heldly_find_people` | The query, an editable search field that re-runs in place, result rows with matched labels, **Plan something together** (2+ results). |
| `group_plan` | `heldly_plan_group` | Avatar stack, "Everyone's into", partial overlaps, group ideas with **Plan it** / **Add to calendar**. |
| `brief` | `heldly_meetup_brief` | "Before you see <name>": last time, common ground, things to ask about, copyable conversation starters, notes or shared memories. |
| `quiz` | `heldly_start_quiz` | One question at a time with instant feedback, then score, verdict and (friend mode) common-ground reveal. All state is client-side. |
| anything else | | Empty state |

### Navigation

`App.tsx` keeps a small view stack. `openView(tool, args)` calls a tool, parses the result with
`parseView` and pushes it; **Back** in the header pops. A result delivered by the host resets the
stack to that one view. After going back, the revealed view is refreshed in the background
(`dashboard` → `heldly_show_dashboard {}`, `reconnect` → `heldly_reconnection_suggestions {}`,
`friend` → `heldly_view_friend`, `brief` → `heldly_meetup_brief`, `people_search` →
`heldly_find_people {query}`); the stale view stays visible, and is kept if the refresh fails.
`replaceView(tool, args)` swaps the current view without adding a Back step (search re-runs,
quiz **Play again**).

### Contract summary

A friend is `{ kind: "connection" | "person", id }`. `friendArg(kind, id)` in `src/types.ts` turns
it into `{ connection_id: id }` or `{ person_id: id }`. Dates are ISO 8601 strings.

```
memory_review  { proposal_id, expires_at, source: "conversation" | "chatgpt_memory",
                 proposals: [{ index, category, title, description, tags, suggested_visibility, already_saved }], note }
                 source missing/unknown = "conversation"; already_saved missing = false
memory_import  { areas: [{ value, label, description, selected }] (1..10), always_excluded,
                 imported_count, max_items, note }   note is model-facing and not shown
dashboard      { profile, memories: [Memory], connections: [Connection], people: [Person], pending_requests: [PendingRequest] }
welcome        { display_name, goal_options: [{ value, label }] }
invite         { code, expires_at, max_uses, share_text, note, link, qr: string[] }
               qr = rows of '0'/'1' ('1' = dark); must be a square grid or it is ignored. link must be http(s).
activity_ideas { kind, id, display_name, shared_interests, match_score (0..1), score_explanation,
                 suggestions: [{ title, description, grounded_in, suggested_action }], note }
reconnect      { min_days, candidates: [{ kind, id, display_name, days_since_last_interaction,
                 last_activity, reason, suggested_activity }] }
friend         { kind, id, display_name, on_heldly, since, last_interaction_at, bio, relationship, notes,
                 interests, shared_interests, shared_memories: [{ category, title, description, tags }],
                 recent_interactions: [{ occurred_at, activity }], follow_ups: [FollowUp] }
people_import  { import_id, expires_at, source, candidates: [{ index, name, relationship, notes, interests,
                 last_met_days_ago, already_added }], skipped, note }
people_search  { query, results: [{ kind, id, display_name, on_heldly, relationship, matched, snippet,
                 last_interaction_at }], count, searched, note }
group_plan     { members: [{ kind, id, display_name, interests }], common_to_all,
                 common_to_some: [{ interest, members }], suggestions: [Suggestion], note }
brief          { kind, id, display_name, on_heldly, relationship, notes, last_interaction_at, last_activity,
                 days_since_last_interaction, interests, shared_interests, shared_memories,
                 things_to_ask: [FollowUp], conversation_starters, note }
quiz           { mode: "friend" | "circle", kind, id, display_name, title,
                 questions: [{ prompt, options (2-4), answer_index, explanation }],
                 common_ground, next: { title, description } | null, note }

Profile        { user_id, display_name, bio, social_goals, interests, memory_count, profile_visibility }
Memory         { memory_id, category, title, description, tags, visibility, created_at,
                 source: "chatgpt_memory" | null }   missing/unknown = null
Connection     { connection_id, user_id, display_name, since, last_interaction_at }
Person         { person_id, name, relationship, notes, interests, last_interaction_at, created_at }
PendingRequest { request_id, sender_display_name, created_at }
FollowUp       { follow_up_id, text, created_at }
```

Memory categories: `INTEREST`, `DISLIKE`, `PREFERENCE`, `EXPERIENCE`, `PERSONAL_MEMORY`, `SOCIAL_GOAL`,
`RELATIONSHIP_CONTEXT` and `WORK` ("Work & projects", 💼). Unknown categories fall back to
`PERSONAL_MEMORY`.

Counts shown in the UI are derived from the arrays (`memories.length`, `connections.length +
people.length`), not from `profile.memory_count`.

## Tool calls made by the widget

| Trigger | Tool | Arguments | Expected `structuredContent` |
| --- | --- | --- | --- |
| Save selected | `heldly_save_memories` | `{ proposal_id, approvals: [{ index, visibility, title, description }] }` | `{ saved: Memory[], count }` |
| Back to dashboard; after accepting a request; **Open my Heldly** (after an import) | `heldly_show_dashboard` | `{}` | `dashboard` view |
| Welcome → Import my ChatGPT memory; Memories tab → Import from ChatGPT / Import more | `heldly_import_chatgpt_memory` | `{}` | `memory_import` view |
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
| Add N people (import) | `heldly_import_people` | `{ import_id, indexes: number[] }` | `{ imported: Person[], count }` |
| Friends tab search; search again | `heldly_find_people` | `{ query }` | `people_search` view |
| Plan a group hangout; Plan something together | `heldly_plan_group` | `{ connection_ids: string[], person_ids: string[] }` (2 to 6 in total) | `group_plan` view |
| Prep for a meetup | `heldly_meetup_brief` | friendArg | `brief` view |
| Quiz (friend); Play a quiz / Play again | `heldly_start_quiz` | `{ connection_id }` or `{}` | `quiz` view |
| Tick off a thing to ask | `heldly_complete_follow_up` | `{ follow_up_id }` | `{ done: true, follow_up_id }` |
| Add a thing to ask | `heldly_add_follow_up` | `{ ...friendArg, text }` (max 200 chars) | FollowUp |

`heldly_propose_people_import` and `heldly_propose_memories` are called by the model, not by the widget.

### Importing ChatGPT memory

The Heldly server cannot read ChatGPT's memory, so the import goes through the chat:

1. `memory_import` card: the user ticks areas and presses **Preview my ChatGPT memory**.
2. The widget sends `buildMemoryImportPrompt(areas, selectedValues, maxItems)` (pure, in
   `src/memoryImport.ts`) with `sendMessage`. The prompt lists the ticked areas as `- <label>: <description>`
   in payload order, adds `Leave out these areas: <label>, <label>.` only when some area is unticked,
   and asks ChatGPT to list at most `max_items` items in the chat without sending anything to Heldly.
3. The user tells ChatGPT which ones to keep; ChatGPT calls `heldly_propose_memories` with
   `source: "chatgpt_memory"` for just those.
4. The `memory_review` card shows them ("From your ChatGPT memory"); the user confirms with the
   unchanged `heldly_save_memories` call, and the saved memories carry `source: "chatgpt_memory"`.

If `sendMessage` is refused, the card shows the prompt in a read-only box with **Copy** and
"Paste this into the chat to start."

Error text is taken from `content[].text` when the result has `isError: true`. Failed actions keep
the local state and show a banner with **Retry**. Buttons are disabled while a call is in flight.

## Host interactions (feature-detected)

- `updateModelContext`: after saving (`Saved N memories to Heldly profile: <titles>`) or discarding
  (`User discarded the proposed memories.`) proposed memories.
- `sendMessage`: **Plan it** (`Help me plan "<title>" with <name>. I will reach out myself.`),
  **Draft a message** (`Help me draft a short, warm message to reconnect with <name>. I will send it myself.`)
  and **Get started** (`Let's set up Heldly. Ask me a few questions about my interests and the people I want to stay close to.`).
  Also **Import friends** (`I'd like to import my friends into Heldly. I'll paste a list, upload a contacts file, or just tell you about them.`),
  group **Plan it** (`Help me plan "<title>" with <names>. I will reach out to everyone myself.`) and
  **Tell <name> my score** (`I just scored X out of N on Heldly's "How well do you know <name>?" quiz. Help me draft a short, playful message telling <name> my score. I will send it myself.`).
  **Preview my ChatGPT memory** sends the import prompt described under "Importing ChatGPT memory".
  If the host doesn't support `message`, the widget shows the text to type in chat instead.
- `openLink` (`app.openLink({ url })`, needs the host's `openLinks` capability): **Add to calendar**
  opens a prefilled Google Calendar link built by `buildCalendarUrl` in `src/calendar.ts`
  (default next Saturday 11:00 local, 2 hours). If the host refuses, the widget shows the link itself.
- Clipboard (invite, conversation starters, import prompt): `navigator.clipboard.writeText`, then a hidden textarea + `execCommand("copy")`,
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
src/calendar.ts            pure Google Calendar URL builder + date helpers
src/memoryImport.ts        pure prompt builder for the ChatGPT memory import
src/mockQr.ts              demo-only QR encoder for mock invites
src/components/common.tsx  Avatar, useAction (busy / retry), chat prompts, copyText, small UI bits
src/components/            MemoryReview, MemoryImport, Dashboard (+ MemoriesTab, FriendsTab), Friend, PersonForm,
                           Invite (+ QrCode), ActivityIdeas, Reconnect, Welcome, ErrorBanner,
                           PeopleImport, PeopleSearch, GroupPlan, Brief, Quiz,
                           FollowUps ("Things to ask about"), CalendarPicker
src/styles.css             all styles; design tokens as CSS variables (light/dark)
```
