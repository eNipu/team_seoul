# team_seoul design guidance

This repository builds Heldly, a consent-first social companion with a React/TypeScript
widget embedded in ChatGPT. Read `README.md` and `widget/README.md` for product and runtime
context before changing the UI.

## Design skills

Canonical skill packages live in `.agents/skills/`. Relative directory links in
`.claude/skills/` expose the same packages to Claude Code; edit the canonical files only.

- For UI implementation, screenshots, design reviews, accessibility, typography, layout,
  or light/dark appearance, read `.agents/skills/apple-design/SKILL.md` and only the
  references needed for the task. For this web widget, use its cross-platform foundations,
  not native-only Apple navigation or window conventions.
- When the user requests Nazarii's style, editorial layouts, cinematic imagery, handwritten
  accents, or less generic visual design, also read
  `.agents/skills/turbota-new-startup-design-from-nazarii/SKILL.md`.
  This is an optional visual direction, not a mandatory Heldly rebrand.
- Product requirements, consent, accessibility, and host integration take precedence over
  decorative styling. Preserve host theme support, usable narrow iframe layouts, keyboard
  access, visible focus, reduced motion, and explicit approval before saving memories.
- Read references before citing them. Bundled guidelines are supplied snapshots, not proof
  of current platform behavior; verify questionable or version-specific claims against
  official documentation. Never claim a visual or accessibility check ran unless it did.
- Do not load design skills for unrelated backend work. Do not modify the shipped
  `plugin/skills/heldly-social/` skill as part of editor configuration.

## Validation

After widget code changes, run `npm --prefix widget run typecheck` and
`npm --prefix widget run build`. Use the demo views documented in `widget/README.md`
to inspect memory review, dashboard, errors, narrow layouts, and light/dark themes.
Consult the `Makefile` for backend and repository-wide checks when those areas change.
