"""The page behind an invite link / QR code.

One headline, one button that opens ChatGPT with the redeem prompt, one quiet line. It is static:
no database lookup, no inviter name, and the same response for any well-formed code, so it reveals
nothing about whether a code exists. Redeeming still requires signing in to Venn inside ChatGPT,
and redeeming connects both people at once.
"""

from __future__ import annotations

import html
import re
from urllib.parse import quote

_CODE = re.compile(r"^[A-Z0-9]{4}-?[A-Z0-9]{4}$")

# Venn landing look: white, black heavy headline, one black pill, yellow used once (the mark).
# Plain string (not a format template), so braces are literal CSS. No scripts, fonts or images,
# so the page works under `default-src 'none'; style-src 'unsafe-inline'`.
_CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #000; }
body { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; justify-content: center;
  padding: 32px 24px calc(32px + env(safe-area-inset-bottom));
  font: 17px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased; }
main { width: 100%; max-width: 440px; margin: 0 auto; }
.mark { display: block; width: 44px; height: 44px; margin: 0 0 28px; }
h1 { margin: 0 0 32px; font-size: clamp(40px, 12vw, 60px); line-height: 1.02; font-weight: 900;
  letter-spacing: -0.035em; overflow-wrap: break-word; }
.pill { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 56px;
  padding: 16px 28px; border-radius: 999px; background: #000; color: #fff; text-decoration: none;
  font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
.pill:hover { background: #222; }
.pill:focus-visible { outline: 3px solid #000; outline-offset: 3px; }
.quiet { margin: 16px 0 0; color: #555; font-size: 15px; text-align: center; }
@media (prefers-reduced-motion: no-preference) { .pill { transition: background .15s ease; } }
"""

# Two overlapping circles; the overlap is the single use of the brand yellow. Decorative.
_MARK = (
    '<svg class="mark" viewBox="0 0 44 44" aria-hidden="true" focusable="false">'
    '<circle cx="16" cy="22" r="13" fill="none" stroke="#000" stroke-width="3"/>'
    '<circle cx="28" cy="22" r="13" fill="none" stroke="#000" stroke-width="3"/>'
    '<path d="M22 10.4a13 13 0 0 1 0 23.2 13 13 0 0 1 0-23.2z" fill="#FFD400"/>'
    "</svg>"
)


def normalize(code: str) -> str | None:
    """`abcd2345` / `ABCD-2345` -> `ABCD-2345`; anything else -> None."""
    candidate = (code or "").strip().upper()
    if not _CODE.fullmatch(candidate):
        return None
    bare = candidate.replace("-", "")
    return f"{bare[:4]}-{bare[4:]}"


def render_invite_page(code: str) -> str | None:
    pretty = normalize(code)
    if pretty is None:
        return None
    prompt = f"Redeem Venn invite {pretty}"
    chatgpt_url = html.escape(f"https://chatgpt.com/?q={quote(prompt)}", quote=True)
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="robots" content="noindex">\n<meta name="theme-color" content="#ffffff">\n'
        f"<title>A friend wants you closer · Venn</title>\n<style>{_CSS}</style>\n</head>\n<body>\n<main>\n"
        f"{_MARK}\n"
        "<h1>A friend wants you closer.</h1>\n"
        f'<a class="pill" href="{chatgpt_url}" rel="noopener noreferrer">Add Venn in ChatGPT</a>\n'
        '<p class="quiet">Free. Only what you both choose is shared.</p>\n'
        "</main>\n</body>\n</html>\n"
    )
