# T46 · Demo LinkedIn import

**Goal.** Show the complete LinkedIn import flow in a product demo without cookies, an export file, or a real contact list.

**Read first**

- [Website](../../web/README.md) and [LinkedIn endpoints](../WEB_API.md)
- `web/src/pages/LinkedInImport.tsx`, `web/src/pages/ImportReview.tsx`, and `backend/app/services/people_service.py`

**Done when**

- The LinkedIn importer can preview 100 fictional AI-generated profiles without an external service.
- Users can change the selection and must confirm before any private people notes are added.
- Demo profiles carry the Sample badge and can be removed from Home without deleting real notes.
- Existing file and session imports retain their limits; the flow also works in browser-only demo mode.
