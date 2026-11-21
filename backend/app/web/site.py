"""Serves the Venn website (the single-page app built from web/) at /app.

Files that exist in the build are returned as they are; every other path under /app/ returns
index.html, so the app can use ordinary URLs such as /app/people. The page and the API share
one origin, which is why the session cookie needs no cross-site settings.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response

from app.branding import page
from app.config import Settings

# The build has no inline scripts; styles may be inline (React style attributes).
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
HEADERS = {
    "Content-Security-Policy": CSP,
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def _not_built() -> str:
    return page(
        "Venn",
        """<h1>The Venn website isn't built yet</h1>
<p>Run <code>make build-web</code> in the repository, then reload this page.</p>""",
    )


def _file(root: Path, relative: str) -> Path | None:
    """The build file for `relative`, or None. Never leaves the build directory."""
    if not relative or relative.endswith("/"):
        return None
    try:
        base = root.resolve()
        target = (base / relative).resolve()
    except OSError:
        return None
    if target == base or not target.is_relative_to(base) or not target.is_file():
        return None
    return target


def install_site(app: FastAPI, settings: Settings) -> None:
    root = settings.web_dist_path

    def index() -> Response:
        html = root / "index.html"
        if not html.is_file():
            return HTMLResponse(_not_built(), status_code=503, headers={**HEADERS, "Cache-Control": "no-store"})
        return FileResponse(html, media_type="text/html", headers={**HEADERS, "Cache-Control": "no-store"})

    @app.get("/", include_in_schema=False)
    def home() -> Response:
        return RedirectResponse("/app/", status_code=307)

    @app.get("/app", include_in_schema=False)
    def app_root() -> Response:
        return RedirectResponse("/app/", status_code=307)

    @app.get("/app/{path:path}", include_in_schema=False)
    def app_path(path: str) -> Response:
        found = _file(root, path)
        if found is None or found.name == "index.html":
            if path.startswith("assets/"):
                # A missing build file must not come back as HTML.
                return Response("Not found", status_code=404, media_type="text/plain", headers=HEADERS)
            return index()
        cache = "public, max-age=31536000, immutable" if path.startswith("assets/") else "no-cache"
        media_type = mimetypes.guess_type(found.name)[0] or "application/octet-stream"
        return FileResponse(found, media_type=media_type, headers={**HEADERS, "Cache-Control": cache})
