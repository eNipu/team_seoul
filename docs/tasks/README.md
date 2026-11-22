# Venn tasks

This board tracks product work. For shipped behavior and the boundaries between ChatGPT, My Venn and the public site, see the [architecture](../ARCHITECTURE.md).

## How to use

1. Read `CONTEXT.md` once. It is short and every task assumes it.
2. Take the first `todo` task below whose dependencies are `done`.
3. Read that task file and only the files it lists under **Read first**.
4. Do it, run its checks, and set its status in the table below in the same commit.

Do not read `Venn PRD.md` in full. Open a section only when a task names it.

## Board

Sizes: **S** is about two hours, **M** is about half a day.

### A. Interests: turn saved memories into a map of what the user cares about

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T01](T01-interest-clusters-service.md) | Group my memories into interests | backend | S | – | todo |
| [T02](T02-interests-tool.md) | Tool `venn_show_interests` | backend | S | T01 | todo |
| [T03](T03-friends-in-clusters.md) | Put friends into interest clusters | backend | S | T02 | todo |
| [T04](T04-interests-card.md) | Interests card in the widget | widget | M | – (uses mock data) | todo |
| [T05](T05-keep-alive-line.md) | One "keep it alive" line per friend | both | S | T03, T04 | todo |
| [T06](T06-person-cadence.md) | Check-in cadence per person | both | M | – | todo |
| [T07](T07-interests-actions.md) | Act from the Interests card | widget | S | T02, T04 | todo |

### B. Opportunities: explain how a connection could help

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T08](T08-needs-offers-categories.md) | Memory categories "Looking for" and "Offering" | both | S | – | todo |
| [T09](T09-person-needs-offers.md) | Needs and offers on people notes | both | M | – | todo |
| [T10](T10-opportunity-matching.md) | Match needs with offers | backend | M | T03, T08, T09 | todo |
| [T11](T11-opportunities-tool.md) | Tool `venn_show_opportunities` | backend | S | T10 | todo |
| [T12](T12-opportunities-card.md) | Opportunities card and Friend section | widget | M | T04 (uses mock data) | todo |

### C. Hardening

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T13](T13-drop-raw-text.md) | Stop sending the user's raw text to the server | backend | M | – | needs decision |
| [T14](T14-connection-pair-constraint.md) | Database rule for connection pairs | backend | S | – | todo |
| [T15](T15-tool-selection-prompts.md) | Prompt set for tool selection | docs | S | – | todo |
| [T16](T16-site-status.md) | Keep the site's status section true | site | S | T07, T12 | needs decision |
| [T17](T17-privacy-terms-pages.md) | Privacy policy and terms pages | site | M | – | needs input |

### D. Waitlist: build the graph before launch

Read `WAITLIST.md` before any task in this group.

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T18](T18-waitlist-pairs-model.md) | Waitlist pairs: model and API | site | M | – | done |
| [T19](T19-waitlist-pair-states.md) | Waitlist states in the hero | site | M | T18 | done |
| [T20](T20-waitlist-invitee-view.md) | What an invited person sees | site | S | T19 | done |
| [T21](T21-hero-subhead-claims.md) | Hero subhead and the claims table | site | S | – | done |
| [T22](T22-waitlist-metrics.md) | `/metrics` for pairs and for the two versions | site | S | T19 | done |
| [T23](T23-waitlist-pairs-into-venn.md) | Carry waitlist pairs into Venn | backend | M | T18 | needs decision |
| [T24](T24-people-you-know-wording.md) | Say "people you know" where Venn describes itself | both | S | – | done |
| [T25](T25-next-word.md) | The changing word under the headline | site | S | T21 | done |

### E. Scheduling and messaging: connect a calendar once, book, reach the user

Read `SCHEDULING.md` before any task in this group.

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T26](T26-scheduling-rules.md) | Rules for acting on the user's behalf | docs | S | – | done |
| [T27](T27-availability.md) | Working hours, buffers and notice | backend | S | T26 | done |
| [T28](T28-slot-finder.md) | Find free slots for two people | backend | S | T26 | done |
| [T29](T29-calendar-connect.md) | Connect Google Calendar | backend | M | T26 | done |
| [T30](T30-find-meeting-times.md) | Tool `venn_find_meeting_times` | backend | M | T27, T28, T29 | todo |
| [T31](T31-propose-and-respond.md) | Propose times, accept or decline, standing rules | backend | M | T30 | todo |
| [T32](T32-book-and-cancel.md) | Book on the calendar, cancel | backend | M | T31 | todo |
| [T33](T33-scheduler-card.md) | Scheduler card | widget | M | T30 (uses mock data) | todo |
| [T34](T34-message-channels.md) | Link email, Telegram or WhatsApp | backend | M | T26 | todo |
| [T35](T35-senders-and-outbox.md) | Senders and the outbox | backend | M | T34 | todo |
| [T36](T36-meeting-notifications.md) | Tell people about their meetings | backend | S | T31, T35 | todo |
| [T37](T37-reply-to-book.md) | Reply on Telegram or WhatsApp to pick a time | backend | M | T32, T36 | todo |
| [T38](T38-schedule-skill-and-docs.md) | Teach the model to schedule; update the docs | docs | S | T32, T36 | todo |

### F. ChatGPT experience

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T39](T39-chatgpt-replies.md) | Tailored replies inside ChatGPT | both | M | – | done |
| [T40](T40-site-onboarding.md) | Landing page onboarding preview | site | M | – | done |
| [T41](T41-venn-conversation-cards.md) | Venn discussion and thread cards | both | M | T39 | done |
| [T42](T42-landing-connections.md) | Landing-page navigation and connection map | site | M | T40 | done |
| [T43](T43-chatgpt-preview-distribution.md) | ChatGPT widget preview and account entry | both | M | T41, T42 | done |
| [T44](T44-product-navigation.md) | Focused landing page and live ChatGPT review | both | M | T43 | done |
| [T45](T45-plugin-weekly-review.md) | Review and save weekly updates in ChatGPT | both | M | – | done |
| [T47](T47-chatgpt-starter-demo-import.md) | Add ChatGPT starter actions and demo contact imports | both | S | T46 | done |
| [T51](T51-onboarding-question.md) | Ask a default question on the first Venn interaction | backend | S | – | done |
| [T52](T52-people-radar.md) | Review people on a radar with shared interests | both | S | T51 | done |

### G. Website experience

| ID | Task | Area | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [T46](T46-linkedin-demo-import.md) | Preview and import fictional LinkedIn connections | web + backend | S | – | done |
| [T48](T48-instagram-web-demo-import.md) | Preview and import fictional Instagram profiles on the web | web + backend | S | T46, T47 | done |
| [T49](T49-proactive-suggestions.md) | Suggest a person and a plan before the user asks | web + widget + backend | M | T39 | done |
| [T50](T50-actionable-home-setup.md) | Complete unfinished setup steps from Home | web | S | – | done |
| [T53](T53-venn-overlap.md) | Venn Overlap: nearby plans with mutual introductions | web + backend | L | – | done |
| [T54](T54-social-import-interests.md) | Social import previews and related interests | web + plugin + backend | M | T48, T52 | done |

T04 and T12 can start right away, in parallel with the backend tasks, because the shapes they
render are fixed in `CONTRACTS.md`.

## Order

Group D is done except T23, which waits for an identity provider. For interest and opportunity
matching, start with T08, T09, T01, T02, T03, T10 and T11, with T04 and T12 available in parallel.
T05, T06 and T07 wait.

Group E runs alongside it in two tracks: calendar (T29, T30, T31, T32, with T33 in parallel)
and messaging (T34, T35), joined by T36 and T37. T38 closes it.

## Keeping this folder small

- One task is one pull request. If a task will not fit in 45 lines, split it.
- Status lives only in the table above, never inside a task file.
- A shape used by both backend and widget is written once, in `CONTRACTS.md`. The waitlist's
  rules, shape and copy are written once, in `WAITLIST.md`; scheduling and messaging, in
  `SCHEDULING.md`.
- A new idea goes into `BACKLOG.md` as one line. It becomes a task file when someone will do it next.
- When a whole group (A, B or C) is done, delete its task files. Git keeps the history.
