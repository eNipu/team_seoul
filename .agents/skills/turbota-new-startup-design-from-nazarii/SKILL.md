---
name: turbota-new-startup-design-from-nazarii
description: >-
  Optional Nazarii-inspired editorial design direction for Venn in team_seoul.
  Use when the user asks for Nazarii's style, cinematic imagery, editorial layouts,
  handwritten accents, or a less generic interface. Adapt the visual principles
  to the existing React widget; do not import TURBOTA branding or product content.
---

# Nazarii-inspired design for Venn

## Source and scope

Adapted from the user-supplied `turbota-new-startup-design-from-nazarii` design skill.
The original describes TURBOTA's People First Merch Studio, not Venn.
This project-local edition keeps its transferable design principles, not the original
company's copy, private conversations, screenshots, fonts, or implementation assets.
No redistribution license was supplied; this adaptation does not grant rights to the
original materials. Confirm permissions before publishing source materials or assets.

This package is self-contained. It does not require the original author's private
repositories, home-directory files, external skills, fonts, or backend services.

## Apply the direction deliberately

1. Read `README.md`, `widget/README.md`, and the relevant existing components and styles.
   Identify the audience, the screen's single job, and the existing host theme.
2. State a one-sentence visual direction tied to Venn: helping people maintain
   meaningful relationships while retaining control of their information.
3. Define a small set of semantic color roles, type sizes, spacing, and one signature
   element before editing. Preserve existing tokens where they already do the job.
4. Use only the principles that improve this screen:
   - Clear editorial hierarchy: a readable heading first, then supporting content.
   - Generous space and stable aligned grids rather than tilted or noisy cards.
   - One restrained accent; the source's yellow `#efe24a` is inspiration, not a required
     brand color. Measure contrast before using any color combination.
   - Expressive display type only where it fits. Keep controls and body text easy to
     read; avoid giant headings and tiny editorial captions in compact widget views.
   - At most one purposeful handwritten gesture or brief annotation in a view, never
     essential instructions, privacy information, or the only label on a control.
   - Authentic imagery only when it serves the task. A social dashboard does not need
     a cinematic hero or gallery. Never fabricate photos of real users or friends.
   - Fewer decorative accessories, less copy, and a clear next action.
5. Adapt to the embedded React/TypeScript widget rather than copying source components.
   Do not add font downloads, animation libraries, image services, or map dependencies
   merely to reproduce the original website.

## Boundaries

- Keep Venn's own names, content, and workflows. Do not introduce merch catalogs,
  maker maps, WhatsApp buttons, TURBOTA slogans, or claims from the original project.
- Respect the ChatGPT host's light/dark appearance; a white-only reference is not an
  instruction to remove theme support.
- Never hide consent, visibility choices, errors, or destructive-action confirmation
  for the sake of minimalism.
- Controls need accessible labels, visible keyboard focus, comfortable targets, and
  readable text. Motion must respect reduced-motion preferences.
- Do not use the original Aeonik or other third-party font assets without a verified
  license. Use the existing type stack or explicitly approved alternatives.

## Review and handoff

Review the result with the sibling `apple-design` skill, applying web foundations rather
than native Apple conventions. Resolve accessibility and interaction problems before polish.

Run the widget's typecheck and build after code changes. Inspect narrow and wide layouts,
light/dark appearance, empty/loading/error states, and keyboard access where possible.
Report which checks actually ran and which still need a human or browser.
If the user asks only for critique or a proposal, do not modify UI code.
