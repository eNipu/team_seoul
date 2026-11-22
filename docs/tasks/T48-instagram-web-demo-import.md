# T48 · Instagram demo import on the web

**Goal.** Let people try the fictional Instagram import in the web app as well as in ChatGPT, without linking an Instagram account.

**Read first**

- [Website](../../web/README.md), [web API](../WEB_API.md), and [T47](T47-chatgpt-starter-demo-import.md)
- `web/src/pages/People.tsx`, `web/src/pages/ImportReview.tsx`, `backend/app/web/api.py`, and `backend/app/services/people_service.py`

**Done when**

- **People → Instagram demo import** previews the 100 fictional Instagram-style profiles from the existing server fixture, with no credentials or external service.
- The review starts with nothing selected. Users can pick profiles or select all, then confirm.
- Imported profiles are private Sample notes and **Home → Remove sample data** removes them without deleting ordinary contacts.
- The importer also works in the browser-only demo. The LinkedIn and ChatGPT import flows still work as before.
