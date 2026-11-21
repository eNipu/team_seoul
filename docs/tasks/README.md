# Venn tasks

The product work, cut into small tasks so nobody (person or model) has to read the full PRD.

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

T04 and T12 can start right away, in parallel with the backend tasks, because the shapes they
render are fixed in `CONTRACTS.md`.

## Order

Group D is done except T23, which waits for an identity provider. The hero now says "You already
know your next customer" and "business partner", so the shortest path to making that true is
T08, T09, T01, T02, T03, T10, T11, then T04 and T12. T05, T06 and T07 wait.

## Keeping this folder small

- One task is one pull request. If a task will not fit in 45 lines, split it.
- Status lives only in the table above, never inside a task file.
- A shape used by both backend and widget is written once, in `CONTRACTS.md`. The waitlist's
  rules, shape and copy are written once, in `WAITLIST.md`.
- A new idea goes into `BACKLOG.md` as one line. It becomes a task file when someone will do it next.
- When a whole group (A, B or C) is done, delete its task files. Git keeps the history.
