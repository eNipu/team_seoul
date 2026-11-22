# Venn widget (MCP Apps UI)

The embedded UI for **Venn**, shown inside ChatGPT through the MCP Apps extension.
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
`ui://venn/app-v2.html` with mimeType `text/html;profile=mcp-app`.

### Demo mode

At `/widget-preview` or when the page is outside a host iframe (`window.parent === window`), the widget uses a local
mock bridge (`src/mock.ts`) instead of the ext-apps connection. It also works straight from
`dist/index.html` over `file://`.

- `?view=memory_review|dashboard|invite|activity_ideas|reconnect|friend|friend_person|welcome|`
  `people_import|people_search|group_plan|brief|brief_person|quiz|quiz_circle|memory_import|memory_review_import|help|dashboard_setup`
  (`friend`/`brief`/`quiz` use a Venn connection, `friend_person`/`brief_person` a private person
  note, `quiz_circle` is the circle quiz, `memory_review_import` is a 12-item review card with
  `source: "chatgpt_memory"`, two of them already saved, `help` is the help card, `dashboard_setup` is a
  dashboard with memories but no people or connections, so the set-up card shows "1 of 3 done"; the plain
  `dashboard` demo has every step done and shows no set-up card); no `view` → empty state with links to every demo view
- `?view=venn|venn_empty|venn_full|this_week|this_week_empty|ask_link|answers|answers_empty|`
  `dashboard_sample|dashboard_plans|memory_review_people`
  (`venn` compares you with Jun: two shared interests; `venn_empty` is a person with no overlap;
  `venn_full` has 8 labels in every region, for layout checks; `this_week` has one action of each type,
  `this_week_empty` has no friends; `ask_link` is a question link for Maya Chen; `answers` has two
  responses, one for an existing person and one from someone new, plus three links; `answers_empty` has
  neither; `dashboard_sample` has the sample circle loaded (banner, Sample tags, sample memories);
  `dashboard_plans` has two saved plans; `memory_review_people` is a review card whose items name people,
  two of them adding new people)
- `&tab=profile|memories|friends` opens a dashboard tab
- In `?view=welcome` or `?view=dashboard`, open **Try a demo import** and choose either platform. Review 100 fictional profiles, select one or more, and confirm. The mock marks saved profiles **Sample** and supports **Remove sample data**.
- `?view=weekly_review` shows three editable weekly updates and the audience picker.
- `?view=reply_advice|reply_checklist|reply_draft|reply_discussion|reply_thread|saved_replies` shows the reply layouts and the saved-reply list
- `&theme=dark|light` forces a theme (default: `prefers-color-scheme`)
- `&flaky=1` makes every other tool call fail, so you can test the error banner and Retry
- `&nochat=1` makes `sendMessage` fail, so you can test the copy-and-paste fallbacks

The mock bridge implements every tool listed below against one in-memory store, so the demo stays
coherent while navigating (a person added on the dashboard is still there after opening a friend
and going back; imported people show up on the dashboard, in search and in the circle quiz;
follow-ups persist; loading and removing the sample circle adds and removes tagged friends and
memories; saved plans show up on the dashboard until they are done or deleted; saving answers creates
or updates the person; completing a follow-up on This week removes it). The demo story includes
Maya Chen (college roommate; photography, pottery, trail running) and the memory "Photo walks with
Maya", so searching "photography" finds her through that memory. `updateModelContext` and `sendMessage` are logged to the console; `openLink`
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
| `reply` | `venn_show_reply` | Advice, steps, a copyable draft, a discussion with **Reply in ChatGPT**, or a thread recap with ordered entries. **Save privately** keeps the displayed card. |
| `saved_replies` | `venn_saved_replies` | Open or delete your saved replies. Also available through the bookmark button in the header. |
| `memory_review` | `venn_propose_memories` | Select drafts and set visibility for the selected updates. **Edit** opens per-item wording and visibility controls. More than 3 items adds bulk selection and a sticky action bar. Previously saved drafts start unchecked. `weekly_update: true` and `source: "chatgpt_memory"` have their own headings. The confirmation lists the saved records and offers **Open my Venn**. |
| `memory_import` | `venn_import_chatgpt_memory` | "Bring your ChatGPT memory with you": one checkbox per area, the always-excluded note, **Preview my ChatGPT memory** (sends a prompt into the chat), then "Check the chat" with **Choose again**, or the prompt to copy when the host refuses the message. Nothing is sent to Venn from this card. |
| `dashboard` | `venn_show_dashboard` | "Finish setting up" card above the tabs while a set-up step is open (see "Set-up"). Tabs **Profile** (edit name/bio, at-a-glance tiles for memories / friends / requests that open the matching tab, goals, interests), **Memories** ("Sources" row for ChatGPT memory with **Import from ChatGPT** / **Import more**, search, grouped by category, "From ChatGPT" badge, edit, delete), **Friends** (search "Who do I know who…", invite, reconnect, quick actions **Import friends** / **Play a quiz** / **Plan a group hangout** (pick 2 to 6 friends), pending requests, "On Venn", "Private notes", add a person). |
| `welcome` | `venn_show_dashboard` (new user) | **Start here** offers **Set up Venn**, **Import my ChatGPT memory**, and **Try a demo import**; guided set-up does not start automatically. Goal chips and the numbered set-up path are optional. |
| `help` | `venn_help` | "How Venn helps": the set-up card (while a step is open), topics with an icon, a description and "try it" examples that are sent into the chat ("Sent — continue in the chat", or the text with **Copy** when the host refuses), then "Your data". `note` is model-facing and not shown. |
| `invite` | `venn_create_invite` | Code as a ticket, QR code ("Scan to connect", when `qr` is non-empty), copy code / copy invite message / copy link (when `link` is non-empty), expiry, uses, revoke. |
| `activity_ideas` | `venn_suggest_activity` | Shared interests, match ring (`match_score`) with "Why this score?", suggestion cards with **Plan it** / **We did this** / **Add to calendar**. |
| `reconnect` | `venn_reconnection_suggestions` | Friends not seen for a while, each with a "days since" figure and a bar relative to the longest gap in the list, with **Get ideas** / **Draft a message** / **We met up**. |
| `friend` | `venn_view_friend` | Profile of a connection or a private person note, "Things to ask about" (tick off / add), interests, shared memories, hangout timeline, actions incl. **Prep for a meetup** and (connections) **Quiz**. |
| `people_import` | `venn_propose_people_import`, `venn_preview_demo_people_import` | Checklist, **Select all** / **Clear**, and explicit confirmation. Demos start with nothing selected, disable already-added profiles, and save private Sample notes. |
| `people_search` | `venn_find_people` | The query, an editable search field that re-runs in place, result rows with matched labels, **Plan something together** (2+ results). |
| `group_plan` | `venn_plan_group` | Avatar stack, "Everyone's into", partial overlaps, group ideas with **Plan it** / **Add to calendar**. |
| `brief` | `venn_meetup_brief` | "Before you see <name>": last time, common ground, things to ask about, copyable conversation starters, notes or shared memories. |
| `quiz` | `venn_start_quiz` | One question at a time with instant feedback, then score, verdict and (friend mode) common-ground reveal. All state is client-side. |
| `venn` | `venn_compare` | The Venn card: `summary` as the headline, two overlapping circles (you / the friend) with a count per region and, from about 390 px of width, up to three labels per region ("+N more" beyond that); the complete lists as chip groups **In common**, **Only you**, **Only <name>**; **Get more ideas**, **Open <name>**; the 0–2 suggestions with **Add to calendar** / **Save plan**. With nothing shared the lens is drawn dashed and the group says so. |
| `this_week` | `venn_this_week` | Up to three action rows (reach out / follow up / make a plan) with the friend, `title`, `reason` and, depending on the row: a draft message with **Copy message** / **Ask ChatGPT to rewrite**; the follow-up with **Done**; the suggestion with **Add to calendar** / **Save plan**. Every row has **We talked**, **We met up** and **Open <name>**. Ends with "Venn never sends anything for you." Empty state shows `empty_reason` with **Add people** and **Try with sample friends**. |
| `ask_link` | `venn_create_question_link` | Question link as a ticket, QR code ("Scan to answer"), **Copy link** / **Copy message**, the questions the friend will be asked, expiry, the no-account note, **See answers**, **Revoke link** (inline confirm). |
| `answers` | `venn_review_answers` | One card per response: who answered and when, a name field (new person) or "Updates your note on <name>", each answer as a checkbox (on by default) with its question and a "Saves as" tag, **Save selected** / **Discard** (inline confirm); after saving, what was added and **Open <name>**. Below, the question links with Active / Expired, **Copy link**, **Revoke**, and **Create a link**. Answer text is rendered as plain text. |
| anything else | | Empty state |

The `dashboard` view also shows, above the tabs: **Try a demo import**; the sample banner with
**Remove sample data** (inline confirm) while `sample_loaded` is true; a **This week** tile; a highlighted
"N answers waiting for your review" tile when `pending_answers > 0`; and a **Plans** section when `plans`
is non-empty (title, date or "No date yet", members, **Done**, delete with inline confirm). The Friends tab
adds **Ask a friend**, a Common ground shortcut on every friend row, "Sample" tags, and **Try with sample
friends** in its empty state; **Play a quiz** shows when connections + people ≥ 2. `welcome` offers **Try
with sample friends**. `memory_review` shows "About: <names>" and "Also adds <names> to your people";
`people_search` shows each result's `why` (in place of the matched labels and snippet, which remain the
fallback when `why` is empty) and a "From your memories" group. The friend view adds **Common ground** and,
for private notes, **Ask them a few questions**.

### Navigation

`App.tsx` keeps a small view stack. `openView(tool, args)` calls a tool, parses the result with
`parseView` and pushes it; **Back** in the header pops. A result delivered by the host resets the
stack to that one view. After going back, the revealed view is refreshed in the background
(`dashboard` / `welcome` → `venn_show_dashboard {}`, `reconnect` → `venn_reconnection_suggestions {}`,
`friend` → `venn_view_friend`, `brief` → `venn_meetup_brief`, `people_search` →
`venn_find_people {query}`, `help` → `venn_help {}`, `venn` → `venn_compare`, `this_week` →
`venn_this_week {}`, `answers` → `venn_review_answers {}`; `ask_link` is not refreshed, because
calling `venn_create_question_link` again would mint a second link); the stale view stays visible, and is kept if the refresh fails.
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
dashboard      { profile, memories: [Memory], connections: [Connection], people: [Person], pending_requests: [PendingRequest],
                 setup: [SetupStep] }
welcome        { display_name, goal_options: [{ value, label }], setup: [SetupStep] }
help           { display_name, topics: [{ key, title, description, examples (0..4) }] (1..10),
                 setup: [SetupStep], privacy: string[], note }   note is model-facing and not shown
                 known topic keys: setup, memories, people, connect, stay_close, quiz, privacy (others get a generic icon)
invite         { code, expires_at, max_uses, share_text, note, link, qr: string[] }
               qr = rows of '0'/'1' ('1' = dark); must be a square grid or it is ignored. link must be http(s).
activity_ideas { kind, id, display_name, shared_interests, match_score (0..1), score_explanation,
                 suggestions: [{ title, description, grounded_in, suggested_action }], note }
reconnect      { min_days, candidates: [{ kind, id, display_name, days_since_last_interaction,
                 last_activity, reason, suggested_activity }] }
friend         { kind, id, display_name, on_venn, since, last_interaction_at, bio, relationship, notes,
                 interests, shared_interests, shared_memories: [{ category, title, description, tags }],
                 recent_interactions: [{ occurred_at, activity }], follow_ups: [FollowUp] }
people_import  { import_id, expires_at, source, demo_platform: "instagram" | "linkedin" | null,
                 candidates: [{ index, name, relationship, notes, interests, last_met_days_ago, already_added }], skipped, note }
people_search  { query, results: [{ kind, id, display_name, on_venn, relationship, matched, snippet,
                 last_interaction_at }], count, searched, note }
group_plan     { members: [{ kind, id, display_name, interests }], common_to_all,
                 common_to_some: [{ interest, members }], suggestions: [Suggestion], note }
brief          { kind, id, display_name, on_venn, relationship, notes, last_interaction_at, last_activity,
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
SetupStep      { key: "about_you" | "your_people" | "connect", title, description, done }
                 missing/invalid = empty list; steps with unknown keys are dropped
```

Memory categories: `INTEREST`, `DISLIKE`, `PREFERENCE`, `EXPERIENCE`, `PERSONAL_MEMORY`, `SOCIAL_GOAL`,
`RELATIONSHIP_CONTEXT` and `WORK` ("Work & projects"). Unknown categories fall back to
`PERSONAL_MEMORY`.

Counts shown in the UI are derived from the arrays (`memories.length`, `connections.length +
people.length`), not from `profile.memory_count`.

### Set-up

`setup` drives onboarding. The dashboard and the help card show a "Finish setting up" card (progress
ring, "N of 3 done", the steps) while at least one step is open, and nothing once all are done; the
welcome card shows the same steps as a numbered path. The actions are fixed per step key: `about_you`
→ **Import from ChatGPT** (opens the import card) and **Answer a few questions** (chat prompt);
`your_people` → **Add your people** (chat prompt); `connect` → **Invite a friend** (opens the invite
card). The first open step gets the primary button, later open steps a secondary one, done steps none.
After a chat prompt is accepted the step shows "Continue in the chat"; if the host refuses, the text is
shown with **Copy**. The card is updated whenever the dashboard payload is refreshed (after **Back**,
or after an action that returns a dashboard).

## Tool calls made by the widget

| Trigger | Tool | Arguments | Expected `structuredContent` |
| --- | --- | --- | --- |
| Approve selected updates | `venn_save_memories` | `{ proposal_id, approvals: [{ index, visibility, title, description }] }` | `{ saved: Memory[], count, people_added }` |
| Discard memory draft | `venn_discard_memory_proposal` | `{ proposal_id }` | `{ discarded: true, proposal_id }` |
| Back to dashboard; after accepting a request; **Open my Venn** (after a memory review) | `venn_show_dashboard` | `{}` | `dashboard` view |
| Header **Help** (every view except `help`) | `venn_help` | `{}` | `help` view |
| Set-up → Invite a friend | `venn_create_invite` | `{}` | `invite` view |
| Welcome → Import my ChatGPT memory; Set-up → Import from ChatGPT; Memories tab → Import from ChatGPT / Import more | `venn_import_chatgpt_memory` | `{}` | `memory_import` view |
| Edit profile | `venn_update_profile` | `{ display_name?, bio? }` (changed fields only) | Profile |
| Welcome → Set up Venn | `venn_update_profile` | `{ social_goals: string[] }` (if selected) | Profile (result ignored) |
| Edit memory | `venn_update_memory` | `{ memory_id, title?, description?, visibility? }` | Memory |
| Delete memory | `venn_delete_memory` | `{ memory_id }` | `{ deleted: true, memory_id }` |
| Accept / Decline | `venn_respond_to_connection` | `{ request_id, accept }` | `{ request_id, status, connection_id }` |
| Add a person | `venn_add_person` | `{ name, relationship?, notes?, interests? }` | Person |
| Edit person | `venn_update_person` | `{ person_id, name?, relationship?, notes?, interests? }` | Person |
| Delete person | `venn_delete_person` | `{ person_id }` | `{ deleted: true, person_id }` |
| Remove connection | `venn_remove_connection` | `{ connection_id }` | `{ removed: true, connection_id }` |
| Open a friend | `venn_view_friend` | friendArg | `friend` view |
| Get ideas | `venn_suggest_activity` | friendArg | `activity_ideas` view |
| Who should I reconnect with? | `venn_reconnection_suggestions` | `{}` | `reconnect` view |
| We did this / We met up / Log a hangout | `venn_log_interaction` | `{ ...friendArg, activity? }` | `{ recorded: true, kind, id, last_interaction_at }` |
| Invite a friend | `venn_create_invite` | `{}` | `invite` view |
| Revoke code | `venn_revoke_invite` | `{ code }` | `{ revoked: true }` |
| Try a demo import → Instagram / LinkedIn demo | `venn_preview_demo_people_import` | `{ platform: "instagram" or "linkedin" }` | `people_import` view |
| Add N sample profiles | `venn_import_demo_people` (app only) | `{ import_id, indexes: number[] }` | `{ imported: Person[], count }` |
| Add N people (regular import) | `venn_import_people` | `{ import_id, indexes: number[] }` | `{ imported: Person[], count }` |
| Friends tab search; search again | `venn_find_people` | `{ query }` | `people_search` view |
| Plan a group hangout; Plan something together | `venn_plan_group` | `{ connection_ids: string[], person_ids: string[] }` (2 to 6 in total) | `group_plan` view |
| Prep for a meetup | `venn_meetup_brief` | friendArg | `brief` view |
| Quiz (friend); Play a quiz / Play again | `venn_start_quiz` | `{ connection_id }` or `{}` | `quiz` view |
| Tick off a thing to ask | `venn_complete_follow_up` | `{ follow_up_id }` | `{ done: true, follow_up_id }` |
| Common ground (friend view, friend rows) | `venn_compare` | friendArg | `venn` view |
| Dashboard → This week | `venn_this_week` | `{}` | `this_week` view |
| Try with sample friends (welcome, Friends tab empty state, This week empty state) | `venn_load_sample_circle` | `{}` | `{ loaded: true, … }`, then `venn_show_dashboard` |
| Remove sample data | `venn_remove_sample_circle` | `{}` | `{ removed: true, … }`, then `venn_show_dashboard` |
| Ask a friend; Ask them a few questions; Create a link | `venn_create_question_link` | `{}` or `{ person_id }` | `ask_link` view |
| N answers waiting for your review; See answers | `venn_review_answers` | `{}` | `answers` view |
| Save selected (answers) | `venn_save_answers` | `{ response_id, keys: string[], name? }` (`name` only for a new person) | `{ saved: true, response_id, person, added_interests, follow_up }` |
| Discard (answers) | `venn_discard_answers` | `{ response_id }` | `{ discarded: true, response_id }` |
| Revoke link | `venn_revoke_question_link` | `{ link_id }` | `{ revoked: true, link_id }` |
| Save plan | `venn_save_plan` | `{ title, details?, planned_for?, connection_ids?, person_ids? }` (`planned_for` only when the user picked a time in the calendar picker) | Plan |
| Plans → Done | `venn_complete_plan` | `{ plan_id }` | `{ done: true, plan_id, logged }`, then `venn_show_dashboard` |
| Plans → delete | `venn_delete_plan` | `{ plan_id }` | `{ deleted: true, plan_id }`, then `venn_show_dashboard` |
| We talked / We met up (This week) | `venn_log_interaction` | `{ ...friendArg, activity: "Talked" \| "Met up" }` | `{ recorded: true, … }` |
| Add a thing to ask | `venn_add_follow_up` | `{ ...friendArg, text }` (max 200 chars) | FollowUp |

`venn_propose_people_import` and `venn_propose_memories` are called by the model, not by the widget.

### Importing ChatGPT memory

The Venn server cannot read ChatGPT's memory, so the import goes through the chat:

1. `memory_import` card: the user ticks areas and presses **Preview my ChatGPT memory**.
2. The widget sends `buildMemoryImportPrompt(areas, selectedValues, maxItems)` (pure, in
   `src/memoryImport.ts`) with `sendMessage`. The prompt lists the ticked areas as `- <label>: <description>`
   in payload order, adds `Leave out these areas: <label>, <label>.` only when some area is unticked,
   and asks ChatGPT to list at most `max_items` items in the chat without sending anything to Venn.
3. The user tells ChatGPT which ones to keep; ChatGPT calls `venn_propose_memories` with
   `source: "chatgpt_memory"` for just those.
4. The `memory_review` card shows them ("From your ChatGPT memory"); the user confirms with the
   unchanged `venn_save_memories` call, and the saved memories carry `source: "chatgpt_memory"`.

If `sendMessage` is refused, the card shows the prompt in a read-only box with **Copy** and
"Paste this into the chat to start."

Error text is taken from `content[].text` when the result has `isError: true`. Failed actions keep
the local state and show a banner with **Retry**. Buttons are disabled while a call is in flight.

## Host interactions (feature-detected)

- `requestDisplayMode`: the header offers fullscreen and a return to inline when the host advertises those modes. Fullscreen applies the host's safe-area insets and keeps ChatGPT's composer available for follow-up questions.
- `updateModelContext`: after saving (`Saved N memories to Venn profile: <titles>`) or discarding
  (`User discarded the proposed memories.`) proposed memories.
- `sendMessage`: **Plan it** (`Help me plan "<title>" with <name>. I will reach out myself.`),
  **Draft a message** (`Help me draft a short, warm message to reconnect with <name>. I will send it myself.`)
  and **Set up Venn** (`Let's set up Venn. Start with my first unfinished step and ask me one question at a time.`).
  Also **Import friends** (`I'd like to import my friends into Venn. I'll paste a list, upload a contacts file, or just tell you about them.`),
  group **Plan it** (`Help me plan "<title>" with <names>. I will reach out to everyone myself.`) and
  **Tell <name> my score** (`I just scored X out of N on Venn's "How well do you know <name>?" quiz. Help me draft a short, playful message telling <name> my score. I will send it myself.`).
  Set-up **Answer a few questions** (`Let's set up Venn. Ask me a few questions about what I enjoy and what I like to avoid.`)
  and **Add your people** (`I'd like to add my friends to Venn. I'll paste a list, upload a contacts file, or just tell you about them.`);
  a help example sends its own text unchanged.
  This week **Ask ChatGPT to rewrite** (`Rewrite this message to <name> in my voice, keep it short: “<draft>”`);
  the button disappears when the host refuses the message.
  **Preview my ChatGPT memory** sends the import prompt described under "Importing ChatGPT memory".
  If the host doesn't support `message`, the widget shows the text to type in chat instead.
  A discussion's **Reply in ChatGPT** posts the answer to the chat and uses the same copy fallback.
- `openLink` (`app.openLink({ url })`, needs the host's `openLinks` capability): **Add to calendar**
  opens a prefilled Google Calendar link built by `buildCalendarUrl` in `src/calendar.ts`
  (default next Saturday 11:00 local, 2 hours). If the host refuses, the widget shows the link itself.
- Clipboard (invite, conversation starters, import prompt, question link, draft messages): `navigator.clipboard.writeText`, then a hidden textarea + `execCommand("copy")`,
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
src/components/common.tsx  Avatar, useAction (busy / retry), chat prompts, copyText, CopyButton, ChatFallback, Ring, small UI bits
src/components/icons.tsx   the icon set (Icon), category icons, the Venn mark (BrandMark) and spot illustrations (Illustration); all inline SVG
src/components/Setup.tsx   "Finish setting up" card and the per-step actions (shared by Dashboard, Welcome and Help)
src/components/Help.tsx    help card
src/components/VennCard.tsx      the Venn card (inline SVG diagram + chip groups)
src/components/ThisWeek.tsx      this week's action rows
src/components/AskLink.tsx       question link card
src/components/Answers.tsx       answers review + question links
src/components/DashboardHome.tsx sample banner, This week / answers tiles, Plans section
src/components/PlanTools.tsx     "Add to calendar" + "Save plan" for suggestion cards, SuggestionBody
src/components/            MemoryReview, MemoryImport, Dashboard (+ MemoriesTab, FriendsTab), Friend, PersonForm,
                           Invite (+ QrCode), ActivityIdeas, Reconnect, Welcome, ErrorBanner,
                           PeopleImport, PeopleSearch, GroupPlan, Brief, Quiz,
                           FollowUps ("Things to ask about"), CalendarPicker
src/venn-kit.css           design tokens (light/dark) and the shared primitives: panel, card, buttons, badge,
                           chip, avatar, check, checklist rows, the Venn pair. The public site owns its own kit.
src/styles.css             everything else; imports venn-kit.css
```
