"""The page the browser lands on after connecting (or failing to connect) a calendar."""

from __future__ import annotations

import html

from app.branding import page

HEADERS = {
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
}


def render_connected(account_email: str) -> str:
    email = html.escape(account_email)
    return page(
        "Calendar connected",
        f"""<h1>Calendar connected</h1>
<p>Venn can now see when <strong>{email}</strong> is free. It reads free and busy times only,
never what your events are.</p>
<p>Go back to your chat to find a time.</p>
<small>You can disconnect at any time: ask Venn to disconnect your calendar.</small>""",
    )


def render_failed(reason: str) -> str:
    return page(
        "Calendar not connected",
        f"""<h1>Calendar not connected</h1>
<p>{html.escape(reason)}</p>
<p>Nothing was saved. You can ask Venn in your chat for a new link.</p>""",
    )
