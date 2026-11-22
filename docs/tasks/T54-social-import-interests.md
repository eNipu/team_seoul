# T54 · Social import previews and related interests

**Goal.** Make Instagram and LinkedIn previews useful in a live walkthrough: people have varied interests, and an exact text match isn't required to find common ground.

**Done when**

- Import entry points and plugin starter prompts use the platform names. Distinguish built-in previews from connected accounts and uploaded exports without repetitive disclaimers.
- Every preview profile has several distinct interests. Previewing saves nothing to the circle; the user chooses which private notes to add. Retain source flags and cleanup.
- Recognize supported relationships between whole interest labels, not coincidences in names or private prose. Keep exact and related evidence distinguishable and respect memory read scopes.
- Exercise both platforms, the web app and plugin, with positive, unrelated and permission-limited cases.

**Walkthrough.** Save an interest such as “Photo walks”, open People → Instagram import → Preview profiles, and look for a related pair such as “Photo walks → street photography”. For LinkedIn choose Built-in preview; in the ChatGPT widget start under Preview profiles. Confirm one person to save just that private note. To rehearse the offline web flow against a local build, run `node web/scripts/shots.mjs web/scripts/social-import-rehearsal.json` with `VENN_ORIGIN` set to the static server.
