# T40 · Landing page onboarding preview

**Goal.** Show how Venn works through a short preview, from reviewing memories to accepting an invitation and seeing shared interests. Keep the real waitlist available on the page.

## Read first

- `site/app/page.tsx`, `site/components/OnboardingPreview.tsx`, `site/components/Waitlist.tsx`
- `site/app/globals.css`, `site/check.mjs` › `exercisePreview`
- `site/README.md`, `docs/tasks/WAITLIST.md`

## Done when

- The updated hero fits on mobile, uses two CSS circles, and links to the preview.
- Visitors can choose sample memories, preview both sides of an invitation, see an overlap based on their choices, and restart.
- The preview stores no selections. Its final call to action leads to the real waitlist.
- The site build and browser checks pass, including the live waitlist flow against a test database.
