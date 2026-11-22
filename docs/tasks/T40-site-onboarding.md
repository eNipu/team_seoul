# T40 · Website onboarding preview

**Goal.** Show how Venn works through a short preview on /how-it-works, from reviewing memories to accepting a sample invitation and seeing shared interests. Keep the real waitlist available on the homepage.

## Read first

- `site/app/how-it-works/page.tsx`, `site/components/OnboardingPreview.tsx`, `site/components/Waitlist.tsx`
- `site/app/globals.css`, `site/check.mjs` › `exercisePreview`
- `site/README.md`, `docs/tasks/WAITLIST.md`

## Done when

- The homepage links to /how-it-works, and the preview fits on mobile.
- Visitors can choose sample memories, preview both sides of an invitation, see an overlap based on their choices, and restart. One SVG illustrates the steps and respects reduced motion.
- The preview stores no selections. Its final call to action leads to the real waitlist.
- The site build and browser checks pass, including the live waitlist flow against a test database.
