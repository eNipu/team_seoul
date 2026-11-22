# T42 · Landing-page navigation and connection map

**Goal.** Keep the landing page's copy and palette while making the waitlist easy to reach
and showing how an approved signal finds its way to a connection.

## Read first

- `site/app/page.tsx`, `site/components/OnboardingPreview.tsx`, `site/app/globals.css`
- `site/check.mjs`, `site/README.md`, `docs/tasks/WAITLIST.md`

## Done when

- The signup fits on the smallest tested phone. The chat example and use cases remain reachable.
- Section links move the view and keyboard focus to the preview, the signup section, and the top.
  Reduced-motion visitors reach each section without smooth scrolling.
- The map animates only approved routes. Maya receives a match only when it was shared.
- The site build and Chrome checks pass, including both waitlist flows against a test database.
