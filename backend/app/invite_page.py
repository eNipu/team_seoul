"""The page behind an invite link / QR code.

It only shows the code and how to redeem it in ChatGPT. It is static: no database lookup, no
inviter name, and the same response for any well-formed code, so it reveals nothing about
whether a code exists. Redeeming still requires signing in to Heldly inside ChatGPT.
"""

from __future__ import annotations

import html
import re
from urllib.parse import quote

_CODE = re.compile(r"^[A-Z0-9]{4}-?[A-Z0-9]{4}$")

_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>You're invited to connect on Heldly</title>
<style>
  :root {{ color-scheme: light dark; --fg: #1d1d1f; --muted: #6e6e73; --bg: #f5f5f7; --card: #fff; --accent: #0a66d8; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --fg: #f5f5f7; --muted: #a1a1a6; --bg: #111113; --card: #1c1c1e; --accent: #4c9cff; }}
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--bg);
    color: var(--fg); font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
  main {{ width: 100%; max-width: 420px; background: var(--card); border-radius: 20px; padding: 28px; }}
  h1 {{ font-size: 24px; line-height: 1.2; margin: 0 0 8px; }}
  p {{ margin: 0 0 16px; color: var(--muted); }}
  .code {{ font: 600 30px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.08em; text-align: center;
    padding: 18px; border-radius: 14px; background: var(--bg); color: var(--fg); margin: 0 0 20px; user-select: all; }}
  ol {{ margin: 0 0 20px; padding-left: 20px; color: var(--fg); }}
  li {{ margin-bottom: 6px; }}
  a.button {{ display: block; text-align: center; text-decoration: none; font-weight: 600; padding: 14px;
    border-radius: 14px; background: var(--accent); color: #fff; }}
  a.button:focus-visible {{ outline: 3px solid var(--fg); outline-offset: 2px; }}
  small {{ display: block; margin-top: 16px; color: var(--muted); }}
</style>
</head>
<body>
<main>
  <h1>A friend wants to connect on Heldly</h1>
  <p>Heldly helps friends stay close, inside ChatGPT. Use this invite code:</p>
  <div class="code" aria-label="Invite code">{code}</div>
  <ol>
    <li>Open ChatGPT with the Heldly app added.</li>
    <li>Say: <strong>Redeem Heldly invite {code}</strong></li>
    <li>Your friend gets a request and decides whether to accept.</li>
  </ol>
  <a class="button" href="{chatgpt_url}" rel="noopener noreferrer">Open in ChatGPT</a>
  <small>Only redeem codes from people you know. Codes expire and can be revoked.</small>
</main>
</body>
</html>
"""


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
    return _PAGE.format(
        code=html.escape(pretty),
        chatgpt_url=html.escape(f"https://chatgpt.com/?q={quote(prompt)}", quote=True),
    )
