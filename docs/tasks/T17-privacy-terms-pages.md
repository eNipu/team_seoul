# T17 · Privacy policy and terms pages

**Status note.** Needs input from the team before work starts:

- the name and contact email of whoever operates Venn;
- how long memories, proposals, people notes and logs are kept;
- the companies that process data for us (hosting, sign-in provider, and OpenAI unless T13 is done);
- how long waitlist emails are kept and how someone asks to be removed. The site has collected
  them since the Venn landing page went in (`waitlist_signups`, see `site/README.md`).

**Goal.** Two plain pages on the site, linked from the footer and from the plugin listing. The
ChatGPT directory requires both.

## Read first

- `docs/SECURITY.md` › Privacy; `docs/DATA_MODEL.md` (table names and the Deletion section)
- `Venn PRD.md` §8.4 and §8.5 only
- `site/app/page.tsx` (footer), `site/check.mjs` (how pages are checked), `site/README.md` ›
  Waitlist, Analytics
- `plugin/plugin.json`

## Do

1. `site/app/privacy/page.tsx`: what is collected, why, who receives it, how long it is kept, and
   how to delete it (a memory, a person note, the whole account, a waitlist email). Cover the
   site's own page-view counting too. State only what the code does.
2. `site/app/terms/page.tsx`: short and plain.
3. Reuse `globals.css` and the kit. No scene and no client components on these pages.
4. Footer links on all three pages.
5. `plugin/plugin.json`: replace the `venn.example.com` website, privacy and terms URLs.
6. Extend `check.mjs` to run its page audit on both new pages.

## Done when

- [ ] Every statement in the policy can be traced to a file in this repository.
- [ ] `npm --prefix site run build && node site/check.mjs` passes, including the new pages.
- [ ] No `example.com` URL is left in `plugin/plugin.json`.
- [ ] Someone on the team has read both pages and agreed to publish them.

## Not in this task

Legal review. That is a person's job; this task gets the pages ready for it.
