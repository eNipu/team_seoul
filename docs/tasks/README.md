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

T04 and T12 can start right away, in parallel with the backend tasks, because the shapes they
render are fixed in `CONTRACTS.md`.

## Keeping this folder small

- One task is one pull request. If a task will not fit in 45 lines, split it.
- Status lives only in the table above, never inside a task file.
- A shape used by both backend and widget is written once, in `CONTRACTS.md`.
- A new idea goes into `BACKLOG.md` as one line. It becomes a task file when someone will do it next.
- When a whole group (A, B or C) is done, delete its task files. Git keeps the history.
