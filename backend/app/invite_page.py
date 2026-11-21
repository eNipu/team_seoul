"""The page behind an invite link / QR code.

It only shows the code and how to redeem it in ChatGPT. It is static: no database lookup, no
inviter name, and the same response for any well-formed code, so it reveals nothing about
whether a code exists. Redeeming still requires signing in to Heldly inside ChatGPT.
"""

from __future__ import annotations

import html
import re
from urllib.parse import quote

from app.branding import HEART_PATH, page

_CODE = re.compile(r"^[A-Z0-9]{4}-?[A-Z0-9]{4}$")

# Two people connected by a heart. Decorative.
_ART = (
    '<svg class="art" viewBox="0 0 220 96" aria-hidden="true" focusable="false">'
    '<path d="M62 60 Q110 14 158 60" fill="none" stroke="#E86A4A" stroke-width="2.5" stroke-linecap="round" '
    'stroke-dasharray="1 8" opacity=".7"/>'
    '<circle cx="50" cy="56" r="28" fill="#E86A4A" opacity=".16"/>'
    '<circle cx="50" cy="48" r="10" fill="#E86A4A"/>'
    '<path d="M31 76a19 19 0 0 1 38 0z" fill="#E86A4A"/>'
    '<circle cx="170" cy="56" r="28" fill="#F2B544" opacity=".2"/>'
    '<circle cx="170" cy="48" r="10" fill="#F2B544"/>'
    '<path d="M151 76a19 19 0 0 1 38 0z" fill="#F2B544"/>'
    '<circle cx="110" cy="30" r="17" fill="#E86A4A"/>'
    f'<path fill="#fff" transform="translate(92.4 11.5) scale(.55)" d="{HEART_PATH}"/>'
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
    prompt = f"Redeem Heldly invite {pretty}"
    code = html.escape(pretty)
    chatgpt_url = html.escape(f"https://chatgpt.com/?q={quote(prompt)}", quote=True)
    return page(
        "You're invited to connect on Heldly",
        f"""{_ART}
<h1>A friend wants to connect on Heldly</h1>
<p>Heldly helps friends stay close, inside ChatGPT. Use this invite code:</p>
<div class="code" aria-label="Invite code">{code}</div>
<ol class="steps">
  <li>Open ChatGPT with the Heldly app added.</li>
  <li>Say: <strong>Redeem Heldly invite {code}</strong></li>
  <li>Your friend gets a request and decides whether to accept.</li>
</ol>
<a class="button" href="{chatgpt_url}" rel="noopener noreferrer">Open in ChatGPT</a>
<small>Only redeem codes from people you know. Codes expire and can be revoked.</small>""",
    )
