# Recipes for the Venn site

Markup and CSS that match what is already in `site/`. Class names here exist in
`site/app/globals.css` or `widget/src/venn-kit.css` unless a recipe says it is new.

## A new landing section

Sections alternate white (`--surface`) and grey (`--bg`). Put the new one where it keeps the
alternation, give it a labelled heading, and reuse `.section-intro` for a centered opening.

```tsx
<section className="showcase" aria-labelledby="how-title">
  <div className="wrap">
    <div className="section-intro">
      <span className="eyebrow">Short label</span>
      <h2 id="how-title">One sentence, with a full stop.</h2>
      <p>One or two lines that say what happens here.</p>
    </div>
    {/* content, at most 30rem wide if it is a single column */}
  </div>
</section>
```

`.showcase` is the grey band with the larger padding; `.principles` is the white one. If the new
section needs its own name, add a class under a new banner in `globals.css` and copy only the
`background` and `padding-block` lines from the one it resembles. `.section-intro h2` already
sets the `h2` size; a bare `h2` elsewhere needs the same `clamp()` (see `.closing h2`).

Do not add a section for a feature that does not appear in the claims table in `site/README.md`.

## A new page

`app/metrics/page.tsx` is the model: `SiteHeader` with a short `note`, one `main.wrap`, one `h1`,
left-aligned. Its `.metrics*` classes are for the dashboard, so a different kind of page gets its
own wrapper. The `.doc` classes below are new; add them under a new banner in `globals.css`.

```tsx
import SiteHeader from "@/components/SiteHeader";

export default function PrivacyPage() {
  return (
    <div className="doc">
      <SiteHeader note="Privacy" />
      <main className="wrap">
        <h1 className="doc__title">Privacy</h1>
        <p className="doc__lede">What Venn keeps, in one sentence.</p>
        {/* prose, or .panel blocks */}
      </main>
    </div>
  );
}
```

```css
.doc {
  min-height: 100dvh;
  padding-bottom: 64px;
}
.doc__title {
  margin-block: 16px 6px;
  font-size: clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem);
}
.doc__lede {
  margin-bottom: 24px;
  color: var(--text-2);
}
.doc main > * {
  max-width: 40rem;
}
```

The title scale is the one `.metrics__title` uses: a secondary page does not repeat the hero's
headline size. Use a white page for prose and `background: var(--bg)` with white `.panel` blocks
for data, as `/metrics` does.

`check.mjs` audits only `/` and `/metrics`. Add the new route to it (an `open()` and `run(audit)`
at one phone and one desktop viewport, as the `/metrics` block does) so the same rules apply.

## A text link

There is no inline link style on the site yet: every link so far is a `.btn`. The check requires
each `a[href]` to be at least 44 x 44px, so a bare link inside a sentence or the footer fails.

Prefer a button-shaped link when the link is an action:

```tsx
<a className="btn" href="#inside">See it inside ChatGPT</a>
```

For a quiet standalone link (for example in the footer), this is a new class; add it under the
footer banner:

```css
.site-footer a {
  display: inline-flex;
  align-items: center;
  min-width: 44px;
  min-height: 44px;
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
```

The underline carries the affordance because the page has no link color. Use `--text`, not
`--muted`, so the link is distinguishable from the text around it. Keep links out of running
paragraphs on the landing page; put the destination on its own line instead.

## A status or error under a control

Follow `Waitlist.tsx`: one note element whose text and role change, so the layout does not jump.

```tsx
<p
  id="thing-note"
  className={`waitlist__note${error ? " waitlist__note--error" : ""}`}
  role={error ? "alert" : undefined}
>
  {error ?? "The promise this control makes."}
</p>
```

Point the input at it with `aria-describedby`, set `aria-invalid` only while there is an error,
and mark the field wrapper with the `--invalid` modifier. When a result replaces the form, give
the result `role="status"`, `tabIndex={-1}`, and move focus to it with `{ preventScroll: true }`.

## A product card on the page

A card that shows what Venn looks like inside ChatGPT uses kit classes for everything inside the
panel, so it stays identical to the widget.

```tsx
<section className="panel preview-card" aria-labelledby="card-title">
  <div className="preview-card__head">
    <VennMark size={22} />
    <span className="preview-card__brand">Venn</span>
    <span className="badge">Card name</span>
  </div>
  <div>
    <h3 id="card-title">What the member decides here</h3>
    <p className="muted small">One line of context.</p>
  </div>
  {/* .pick rows, a .venn-pair, or a .card */}
  <p className="lock-note">{/* lock icon */}Nothing is shared until you approve it</p>
  <button type="button" className="btn btn--primary btn--block">Verb the result</button>
</section>
```

Keep the consent line and the "Venn never sends anything for you" line wherever a card saves or
drafts something. If the card needs a primitive the kit lacks, add it to
`widget/src/venn-kit.css` and build both the widget and the site.

## Two people and what they share

`.venn-pair` is the small version of the hero figure. Circle A is the visitor, circle B the other
person, and the label names the overlap in one or two words.

```tsx
<div className="venn-pair" aria-hidden="true">
  <span className="venn-pair__who venn-pair__who--a">You</span>
  <span className="venn-pair__who venn-pair__who--b">TM</span>
  <span className="venn-pair__shared">Berlin</span>
</div>
```

It is decorative, so the same fact must also be in text next to it or in an `.sr-only` caption.
Resize it with the `--who` and `--overlap` custom properties, not with `transform: scale`.
Use it once per view.
