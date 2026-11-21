"""List your own LinkedIn connections from the command line.

    cd backend
    uv run python -m scripts.linkedin_connections --cookies-file ~/linkedin-cookies.json
    pbpaste | uv run python -m scripts.linkedin_connections --format csv > connections.csv

The cookies are read from a file, from standard input or from the LINKEDIN_COOKIES
environment variable, never from the command line (that would leave them in your shell
history). Accepted formats: the JSON a cookie-export browser extension copies, a
"li_at=...; JSESSIONID=..." string, or the bare li_at value.

This is the same reader the Venn website uses for "Import from LinkedIn". It reads the
list behind https://www.linkedin.com/mynetwork/invite-connect/connections/ with your
session. LinkedIn's terms do not allow automated access, so use it on your own account
and sparingly. With --details it also fetches profile details from Apify (APIFY_TOKEN).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

from app.config import get_settings
from app.services import linkedin_service
from app.services.errors import VennError


def _read_cookies(path: str | None) -> str:
    if path:
        return Path(path).expanduser().read_text()
    if os.environ.get("LINKEDIN_COOKIES"):
        return os.environ["LINKEDIN_COOKIES"]
    if sys.stdin.isatty():
        print("Paste your LinkedIn cookies, then press Ctrl-D:", file=sys.stderr)
    return sys.stdin.read()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="List your own LinkedIn connections.")
    parser.add_argument("--cookies-file", help="file holding the cookies (default: stdin or LINKEDIN_COOKIES)")
    parser.add_argument("--limit", type=int, default=200, help="how many connections to read (default 200)")
    parser.add_argument("--format", choices=("json", "csv"), default="json")
    parser.add_argument(
        "--details", type=int, default=0, metavar="N", help="fetch Apify profile details for the first N"
    )
    args = parser.parse_args(argv)
    settings = get_settings()

    try:
        page = linkedin_service.fetch_connections(_read_cookies(args.cookies_file), args.limit)
        profiles: dict[str, dict] = {}
        if args.details > 0:
            if not settings.apify_token:
                print("APIFY_TOKEN is not set; skipping profile details.", file=sys.stderr)
            else:
                profiles = linkedin_service.fetch_profiles(
                    [c.public_identifier for c in page.connections[: args.details]],
                    token=settings.apify_token,
                    actor=settings.apify_profile_actor,
                    timeout=settings.apify_timeout_seconds,
                )
    except VennError as exc:
        print(f"error: {exc.message}", file=sys.stderr)
        return 1

    rows = []
    for c in page.connections:
        person = linkedin_service.candidate(c.name, c.headline, profiles.get(c.public_identifier))
        rows.append(
            {
                "name": c.name,
                "headline": c.headline or "",
                "profile_url": c.profile_url,
                "connected_on": c.connected_on.isoformat() if c.connected_on else "",
                "notes": person.notes or "",
                "interests": person.interests,
            }
        )
    if args.format == "csv":
        writer = csv.DictWriter(sys.stdout, fieldnames=list(rows[0]) if rows else ["name"])
        writer.writeheader()
        for row in rows:
            writer.writerow({**row, "interests": "; ".join(row["interests"])})
    else:
        json.dump(rows, sys.stdout, indent=2, ensure_ascii=False)
        print()
    total = f" of {page.total}" if page.total is not None else ""
    print(f"{len(rows)}{total} connections, details for {len(profiles)}.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
