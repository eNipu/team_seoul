---
name: venn-design
description: >-
  Venn's brand and product design rules for every surface: the ChatGPT widget (widget/),
  the landing site (site/), Meta ads and any new screen, card, onboarding step or copy.
  Use FIRST for any UI, visual, onboarding or copy change, design review, or when someone
  asks "make it cleaner / simpler / sexier / like the landing / like Boardy". Records the
  decisions the founder made on 22.11.2026 and the process to check work before showing it.
---

# Venn design

Venn keeps you close to your partner and friends from inside ChatGPT. Consumer first:
couples and friends who drifted apart. "Hooking up is easy. Try sustaining a relationship."

## The look (copy it, don't reinvent it)

The landing page at joinvennai.com is the reference. Every surface looks like it.

- **Paper and ink.** White or #f5f5f7 surfaces, black text, one black pill button.
  No dark gradient cards, no glow, no orbs, no colored shadows, no gradient text.
- **Logo:** the hand-drawn yellow `venn.` sticker (`site/public/brand/venn-logo-sticker.png`,
  widget copy `widget/src/venn-logo.webp`), slightly tilted. Never the old coral dot.
- **Yellow `#FFD400` is the one bright element per screen.** Use it for exactly one thing:
  the highlighter on one phrase, *or* the "moment" card, *or* the selected state. Never two.
- **The moment card** is the signature: a ChatGPT chat where the user asks something and
  a yellow card answers with a real-sounding person, ending "Shared by Emma's AI · via venn".
  It is the product preview; put it where Boardy puts its inbox preview.
- **Type:** heavy, tight headlines (letter-spacing about -0.04em), short. Body 15-16px, #424245.

## Copy

- Lines the founder loves (keep the wording): "Connect your AI memories." /
  "Build your inner circle." / "Connecting is easy. Keeping is hard." /
  "Hooking up is easy. Try sustaining a relationship." / "Send the spark."
- One sentence per screen. If a screen needs a helper line, the headline is wrong.
- Concrete people and moments ("Emma from uni is in Berlin on Saturday") beat abstractions
  ("AI memory", "signals", "network"). "Venn knows 10 things about you" reads creepy: say
  what the user gets, not what Venn has.
- Privacy in four words where it matters ("Only you see these"), not paragraphs.

## The user journey (approved by the founder, 22.11.2026)

Three steps, everything after the first click happens inside ChatGPT:

1. **Get Venn into ChatGPT.** Today the landing (joinvennai.com) is an email waitlist and
   people wait for an invite. **Keep it that way until the product is ready;** a separate
   landing with one "Add Venn to ChatGPT" button comes later, with the full process.
2. **Connect** inside ChatGPT: pick your person, one tap imports what ChatGPT remembers,
   saved private.
3. **Send the spark.** Your person taps the link, adds Venn in their ChatGPT and you are
   connected at once (redeeming an invite connects both; no "accept request" step).

Then the product is **"Venn tells you when"**: proactive moment cards inside ChatGPT.
**A moment is a recommendation from signals, never a reminder.** A friend's AI-shared update
(working on, looking for, plans, in town) meets your need or context right now, and Venn
recommends one action. Like the Meta ads: "Remember Alex from your accelerator? He shared last
week his company is looking for exactly what you sell." + "Shared by Alex's AI · via venn" ->
"Say hi". Never "Check in with X", "It's been a while" or "Follow up with X" as the headline.
Off the main path, never required:
- **Web app** (app.joinvennai.com): see and edit everything, reached from one quiet
  "Open my Venn" link. Not a step, not a dashboard people must visit.
- **Import contacts** (LinkedIn, Instagram, lists): later, as "Add more people".

Any new screen must fit one of these places. If it adds a step to the main path, cut it.

## Flow (ChatGPT onboarding, modelled on Boardy)

Boardy's onboarding is the benchmark users call "the best onboarding ever": brand on top,
`01 / 03` counter, one big question, choice cards, one button, and a live preview of the
outcome (its inbox). Venn's version, in `widget/src/components/{Welcome,QuickImport,Invite}.tsx`:

1. `01 / 03` **Who do you want to be closer to?** Four choice cards; tapping one moves on.
2. `02 / 03` **Connect your AI memories.** One button, Connect. It imports what ChatGPT
   remembers and saves it PRIVATE with no preview (`quick_import`). Under it, the moment
   card for the chosen circle. Secondary: Back, and "Preview first" (the old review path).
3. `03 / 03` **You're in.** Top three saved memories in yellow, then "Invite your partner /
   best friend…". Review all sits behind a quiet link.
4. **Send the spark.** The invite message shown as a yellow chat bubble, then Copy/Send invite.
   QR code behind a link.

Rules: one primary and at most one secondary action; anything else goes behind a quiet
link or `<details>`; default over choice; no dashboards in onboarding.

## How to check work before showing it (mandatory)

Theory is cheap; screenshots are evidence.

1. Render it: `cd widget && npx vite` then `/?view=welcome|memory_quick_import|invite`
   (mock bridge), or `node site/check.mjs` for the site. Screenshot at 375 and 800 wide.
2. Run unslop rules (one bright element, quiet chrome, 4px spacing, no filler, no
   exclamation marks, no hype words, no emoji icons).
3. Judge it against a working reference (Boardy, Locket, the live landing), side by side,
   with a senior critic (the OpenAI API with screenshots attached, not your subscription). Every claim points at a
   visible pixel difference. Fix the top issues and re-shoot. Stop when it is simpler, not
   when it is fancier.
4. When the founder says "too complicated", remove things. Do not restyle.

## Where things live

- Widget onboarding: `widget/src/components/onboarding.css`, `Welcome.tsx`,
  `QuickImport.tsx`, `Invite.tsx`, `widget/src/onboardingCircle.ts` (choices + demo copy).
- Backend contract: `venn_propose_memories(quick_import=true, source="chatgpt_memory")`
  sets `structuredContent.quick_import`; the card saves everything PRIVATE.
- Landing: `site/` (details in `.agents/skills/venn-site-design`).
- Ads: hand-drawn yellow marks on white, real moments, provenance line
  "Shared by X's AI · via venn". Less text beats more text.
