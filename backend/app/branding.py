"""Look of the few HTML pages the server renders itself (invite link, dev sign-in).

Self-contained on purpose: no scripts, fonts, images or other requests, so the pages work under
`default-src 'none'`.
"""

from __future__ import annotations

BRAND = "#E86A4A"
HEART_PATH = (
    "M32 47s-15-8.6-15-19.2C17 22.4 21 19 25.3 19c2.9 0 5.3 1.6 6.7 3.9 "
    "1.4-2.3 3.8-3.9 6.7-3.9C43 19 47 22.4 47 27.8 47 38.4 32 47 32 47z"
)
"""Heart on a 64x64 grid, used in the invite page illustration."""

# Two overlapping circles on the brand tile, same as plugin/assets/*.svg and the widget header.
# Decorative: the word "Venn" is always next to it.
MARK_SVG = (
    '<svg class="mark" viewBox="0 0 64 64" width="32" height="32" aria-hidden="true" focusable="false">'
    '<rect width="64" height="64" rx="15" fill="#E86A4A"/>'
    '<circle cx="23.5" cy="32" r="17" fill="#fff" fill-opacity=".5"/>'
    '<circle cx="40.5" cy="32" r="17" fill="#fff" fill-opacity=".5"/>'
    '<path fill="#fff" d="M32 17.28a17 17 0 0 1 0 29.44 17 17 0 0 1 0-29.44z"/>'
    "</svg>"
)

# Plain string (not a format template), so braces are literal CSS.
PAGE_CSS = """
:root { color-scheme: light dark; --fg: #1d1d1f; --muted: #5f5f66; --bg: #f6f3f1; --card: #ffffff;
  --line: #e7e2de; --field: #faf8f6; --accent: #c4472a; --accent-fg: #ffffff; --tint: #fdf0ec; --tint-fg: #9c3219;
  --shadow: 0 1px 2px rgba(60, 30, 20, .06), 0 12px 32px rgba(60, 30, 20, .08); }
@media (prefers-color-scheme: dark) {
  :root { --fg: #f5f5f7; --muted: #a9a9b2; --bg: #121113; --card: #1c1b1e; --line: #2e2c31; --field: #232226;
    --accent: #f08467; --accent-fg: #1a0d09; --tint: #2e1c17; --tint-fg: #f6a48d; --shadow: none; }
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg);
  color: var(--fg); font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased; }
main { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--line); border-radius: 24px;
  padding: 28px 24px 24px; box-shadow: var(--shadow); }
.brand { display: flex; align-items: center; gap: 10px; margin: 0 0 24px; font-weight: 650; font-size: 17px;
  letter-spacing: -0.01em; }
.mark { display: block; border-radius: 9px; }
.art { display: block; width: 100%; max-width: 220px; height: auto; margin: 0 auto 20px; }
h1 { font-size: 26px; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 8px; font-weight: 700; }
p { margin: 0 0 20px; color: var(--muted); }
.code { font: 650 30px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.1em;
  text-align: center; padding: 20px 12px; border-radius: 16px; background: var(--tint); color: var(--tint-fg);
  border: 1.5px dashed currentColor; margin: 0 0 24px; user-select: all; overflow-wrap: anywhere; }
ol.steps { list-style: none; counter-reset: step; margin: 0 0 24px; padding: 0; }
ol.steps li { counter-increment: step; position: relative; padding: 2px 0 2px 40px; margin-bottom: 12px; }
ol.steps li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 28px; height: 28px;
  border-radius: 50%; background: var(--tint); color: var(--tint-fg); font-weight: 650; font-size: 14px;
  display: grid; place-items: center; }
.button, button { display: block; width: 100%; text-align: center; text-decoration: none; font: inherit;
  font-weight: 650; padding: 14px 16px; min-height: 48px; border: 0; border-radius: 14px; background: var(--accent);
  color: var(--accent-fg); cursor: pointer; }
.button:hover, button:hover { filter: brightness(1.06); }
.button:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid var(--fg); outline-offset: 2px; }
small { display: block; margin-top: 16px; color: var(--muted); font-size: 13px; line-height: 1.45; text-align: center; }
label { display: block; margin: 0 0 16px; font-size: 14px; font-weight: 600; }
input { display: block; width: 100%; margin-top: 6px; padding: 12px 14px; min-height: 48px; font: inherit;
  font-weight: 400; color: var(--fg); background: var(--field); border: 1px solid var(--line); border-radius: 12px; }
input::placeholder { color: var(--muted); opacity: .7; }
.note { display: flex; gap: 8px; align-items: flex-start; background: var(--tint); color: var(--tint-fg);
  padding: 10px 12px; border-radius: 12px; font-size: 14px; margin: 0 0 20px; }
.err { color: #b3261e; background: #fdecea; padding: 10px 12px; border-radius: 12px; font-size: 14px;
  font-weight: 600; margin: 0 0 20px; }
@media (prefers-color-scheme: dark) { .err { color: #ffb4ab; background: #3a1512; } }
input[type="checkbox"] { display: inline-block; width: 22px; min-width: 22px; height: 22px; min-height: 0;
  margin: 1px 0 0; padding: 0; accent-color: var(--accent); }
label.check { display: flex; gap: 12px; align-items: flex-start; font-weight: 500; font-size: 15px; margin: 0 0 20px; }
label .hint { display: block; font-weight: 400; color: var(--muted); font-size: 13px; margin-top: 2px; }
.facts { list-style: none; margin: 0 0 20px; padding: 14px 16px; border-radius: 14px; background: var(--field);
  border: 1px solid var(--line); font-size: 14px; color: var(--muted); }
.facts strong { display: block; color: var(--fg); margin-bottom: 6px; }
.facts li { position: relative; padding-left: 18px; margin-top: 4px; }
.facts li::before { content: ""; position: absolute; left: 2px; top: .6em; width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); }
.hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
a.quiet { color: var(--tint-fg); font-weight: 600; }
@media (max-width: 360px) { main { padding: 24px 18px 20px; } h1 { font-size: 23px; } .code { font-size: 25px; } }
"""


def page(title: str, body: str, *, noindex: bool = True) -> str:
    """Wrap `body` (trusted HTML: callers escape what they interpolate) in the shared page shell."""
    robots = '<meta name="robots" content="noindex">\n' if noindex else ""
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"{robots}<title>{title}</title>\n<style>{PAGE_CSS}</style>\n</head>\n<body>\n<main>\n"
        f'<div class="brand">{MARK_SVG}<span>Venn</span></div>\n{body}\n</main>\n</body>\n</html>\n'
    )
