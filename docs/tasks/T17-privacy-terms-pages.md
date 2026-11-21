# T17 · Privacy policy and terms pages

**Status note.** Needs input from the team before work starts:

- the name and contact email of whoever operates Heldly;
- how long memories, proposals, people notes and logs are kept;
- the companies that process data for us (hosting, sign-in provider, and OpenAI unless T13 is done).

**Goal.** Two plain pages on the site, linked from the footer and from the plugin listing. The
ChatGPT directory requires both.

## Read first

- `docs/SECURITY.md` › Privacy; `docs/DATA_MODEL.md` (table names and the Deletion section)
- `Heldly PRD.md` §8.4 and §8.5 only
- `site/public/index.html` (footer), `site/check.mjs` (how pages are checked)
- `plugin/plugin.json`

## Do

1. `site/public/privacy.html`: what is collected, why, who receives it, how long it is kept, and
   how to delete it (a memory, a person note, the whole account). State only what the code does.
2. `site/public/terms.html`: short and plain.
3. Reuse `styles.css`. No scene and no new scripts on these pages.
4. Footer links on all three pages.
5. `plugin/plugin.json`: replace the `heldly.example.com` website, privacy and terms URLs.
6. Extend `check.mjs` to run its page audit on both new pages.

## Done when

- [ ] Every statement in the policy can be traced to a file in this repository.
- [ ] `node site/check.mjs` passes, including the new pages.
- [ ] No `example.com` URL is left in `plugin/plugin.json`.
- [ ] Someone on the team has read both pages and agreed to publish them.

## Not in this task

Legal review. That is a person's job; this task gets the pages ready for it.
