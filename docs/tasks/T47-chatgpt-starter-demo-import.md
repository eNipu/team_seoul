# T47 · ChatGPT starter actions and demo contact imports

## Goal

Open Venn in ChatGPT without automatically starting onboarding. The first card gives the user a choice: guided set-up, ChatGPT memory import, or a demo contact import. Make the Instagram and LinkedIn demo imports discoverable without a social account or exported file.

## Read first

- `plugin/plugin.json`, `plugin/skills/venn-social/SKILL.md` and `docs/MCP_TOOLS.md`
- `widget/README.md` and `widget/src/components/{Welcome,DemoImport,PeopleImport}.tsx`
- `backend/app/mcp/tools.py` and `backend/app/services/people_service.py`

## Acceptance

- **Open Venn** shows the welcome card or dashboard and waits for the user to pick an action.
- Each demo opens a review of 100 fictional, AI-authored profiles, initially unchecked. No social cookie, login, or external import is used.
- A confirmation in the widget saves only the selected people as owner-only Sample notes. ChatGPT can discover the callback, but it requires the widget-only confirmation token from that review. **Remove sample data** removes notes without affecting actual people notes. Demo profiles don't count toward onboarding.
- Regular imports and the existing website LinkedIn demo still work.

## Verify

Run `make lint`, `make test`, and `npm --prefix widget run build`. In the standalone widget at `?view=welcome`, try both demos, confirm a selection, then remove the samples. After deploying, refresh the ChatGPT app's tools, start a fresh chat, and try **Open Venn**.
Open a new review for each platform, select a few profiles, click **Add**, and verify only those profiles appear as Sample notes.
