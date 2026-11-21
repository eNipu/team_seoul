# T40 · Landing page onboarding preview

**Goal.** A visitor can try getting into Venn in four taps, after the team's prototype: connect
memories, invite a +1, see their side, and land in a shared circle. Little text, a drawing that
carries the story, and the real waitlist one tap away.

## Read first

- `site/app/page.tsx`, `site/components/OnboardingPreview.tsx`, `site/components/Waitlist.tsx`
- `site/app/globals.css` › Onboarding, `site/check.mjs` › `exercisePreview`
- `site/README.md` › Hero and onboarding, `docs/tasks/WAITLIST.md`

## Decisions

- One inline SVG stage for every step; its parts move between steps with CSS transitions. No
  images, canvas or animation library. Nothing loops; with reduced motion each step just appears.
- The hero is "Venn. Connect your AI memories." / "Build your inner circle." with the rolling
  line from T25 under it. Its 3D scene is replaced by the CSS circles, so three.js is gone.
- The preview stores nothing and uses a made-up person, Maya.

## Done when

- [x] The hero, with the rolling line, fits at 360 x 640 in every waitlist state.
- [x] Visitors tick memories, send an invite, accept as Maya, see the overlap their choices make,
      go back and restart; the last step links to the real waitlist.
- [x] `npm --prefix site run build && node site/check.mjs` passes with `DATABASE_URL` set.
