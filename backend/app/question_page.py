"""The public page behind an ask-a-friend link (`/q/{token}`).

A friend without an account answers four short questions for the person who shared the link.
The page is plain HTML with a normal form post: no scripts, no cookies, nothing from other sites.
Unknown, expired, revoked and used-up links all get the same "not available" page.
"""

from __future__ import annotations

import html

from app.branding import page
from app.services.question_service import MAX_ANSWER_LEN, MAX_NAME_LEN, QUESTIONS, PublicLink

HEADERS = {
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
}

# Two overlapping speech bubbles. Decorative.
_ART = (
    '<svg class="art" viewBox="0 0 220 96" aria-hidden="true" focusable="false">'
    '<rect x="26" y="12" width="104" height="52" rx="18" fill="#E86A4A" opacity=".18"/>'
    '<path d="M48 62l-6 16 20-16z" fill="#E86A4A" opacity=".18"/>'
    '<rect x="92" y="30" width="104" height="52" rx="18" fill="#E86A4A"/>'
    '<path d="M172 80l8 12-22-12z" fill="#E86A4A"/>'
    '<circle cx="122" cy="56" r="5" fill="#fff"/><circle cx="144" cy="56" r="5" fill="#fff"/>'
    '<circle cx="166" cy="56" r="5" fill="#fff"/>'
    '<rect x="44" y="28" width="40" height="6" rx="3" fill="#E86A4A" opacity=".55"/>'
    "</svg>"
)


def _e(value: str | None) -> str:
    return html.escape(value or "", quote=True)


def render_form(link: PublicLink, error: str | None = None, values: dict[str, str] | None = None) -> str:
    values = values or {}
    asker = _e(link.asker)
    name = _e(values.get("name") or link.for_name)
    fields = "\n".join(
        f'<label>{_e(q.text)}<input name="{q.key}" maxlength="{MAX_ANSWER_LEN}" autocomplete="off" '
        f'placeholder="{_e(q.placeholder)}" value="{_e(values.get(q.key))}"></label>'
        for q in QUESTIONS
    )
    problem = f'<p class="err" role="alert">{_e(error)}</p>\n' if error else ""
    return page(
        f"{asker} has four quick questions for you",
        f"""{_ART}
<h1>{asker} has four quick questions for you</h1>
<p>{asker} uses Venn to remember what their friends are into. Answer what you like and skip the rest.</p>
{problem}<form method="post" autocomplete="off">
<label>Your name<input name="name" maxlength="{MAX_NAME_LEN}" required value="{name}"></label>
{fields}
<div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1"></label></div>
<ul class="facts">
  <li style="padding:0"><strong>What happens to your answers</strong></li>
  <li>Only {asker} sees them.</li>
  <li>{asker} reviews them and chooses what to keep in their own private notes.</li>
  <li>Venn will not contact you, and you don't need an account.</li>
  <li>Please leave out passwords, health and money details.</li>
</ul>
<label class="check"><input type="checkbox" name="consent" value="yes" required>
<span>I agree to share these answers with {asker}.</span></label>
<button type="submit">Send my answers</button>
</form>""",
    )


def render_thanks(asker: str) -> str:
    name = _e(asker)
    return page(
        "Thanks — your answers were sent",
        f"""{_ART}
<h1>Thanks! Your answers are with {name}.</h1>
<p>{name} will look through them and decide what to keep. Nothing else happens, and you can close this page.</p>
<small>Want to remember what your own friends are into? <a class="quiet" href="/app">Try Venn</a></small>""",
    )


def render_unavailable() -> str:
    return page(
        "This link isn't available",
        """<h1>This link isn't available</h1>
<p>It may have expired, been used already, or been turned off. Ask your friend to send a new one.</p>""",
    )
