# T16 · Keep the site's status section true

**Goal.** The public page lists a feature under "Works today" only once it works, and stops
listing it under "In development" when it ships.

Do this once when group A is done, and again when group B is done.

**Needs a decision first.** The Venn landing page (`site/app/page.tsx`) has no "Works today" /
"In development" section any more; it only says "Venn is in development" under the preview.
Decide whether to bring a status section back or to keep this task to the claims table in
`site/README.md`. Steps 1 to 3 below describe the old section.

## Read first

- `site/README.md` › "What the copy may claim", "Deploy"
- `site/app/page.tsx` and `site/components/ChatPreview.tsx` (the old `#status` section is gone)

## Do

1. When T07 is merged: move "Interest clusters" to "Works today", and drop "as shown above".
2. When T12 is merged: move "Suggestions for how a connection could help" the same way.
3. If "In development" becomes empty, replace its list with the top two lines of
   `docs/tasks/BACKLOG.md` › Next candidates, in plain words.
4. Update the claims table in `site/README.md`.
5. Run the checks, deploy, and check the live copy.

## Done when

- [ ] Every line under "Works today" names something a user can do in ChatGPT today.
- [ ] `npm --prefix site run build && node site/check.mjs` passes locally.
- [ ] `node site/check.mjs --url https://site-production-4ef8eb52.up.railway.app/` passes after the deploy.

## Not in this task

Redesign or new sections.
