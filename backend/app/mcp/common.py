"""Shared helpers for MCP tool handlers: auth + DB unit of work + result shaping."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterable
from typing import Any, TypeVar

import anyio
from mcp_types import CallToolResult, TextContent, ToolAnnotations
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.context import current_token, resolve_user
from app.db.database import session_scope
from app.models import User
from app.services.errors import VennError

log = logging.getLogger("venn.mcp")

T = TypeVar("T")

WIDGET_URI = "ui://venn/app-v4.html"

# Scopes
PROFILE_READ = "venn.profile.read"
PROFILE_WRITE = "venn.profile.write"
MEMORIES_READ = "venn.memories.read"
MEMORIES_WRITE = "venn.memories.write"
CONNECTIONS = "venn.connections.manage"
CALENDAR = "venn.calendar"

READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=False)
WRITE = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)
WRITE_IDEMPOTENT = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False
)
DESTRUCTIVE = ToolAnnotations(read_only_hint=False, destructive_hint=True, open_world_hint=False)


def invocation_meta(invoking: str, invoked: str, *, widget_accessible: bool = False) -> dict[str, Any]:
    """ChatGPT status strings (+ legacy widget-accessibility flag) for a tool descriptor."""
    meta: dict[str, Any] = {
        "openai/toolInvocation/invoking": invoking,
        "openai/toolInvocation/invoked": invoked,
    }
    if widget_accessible:
        meta["openai/widgetAccessible"] = True
    return meta


def ui_meta(invoking: str, invoked: str) -> dict[str, Any]:
    """Extra _meta for UI-bound (render) tools; Apps.tool() adds `ui.resourceUri` itself."""
    return {
        **invocation_meta(invoking, invoked, widget_accessible=True),
        "openai/outputTemplate": WIDGET_URI,  # ChatGPT compatibility alias of ui.resourceUri
    }


def app_only_meta(invoking: str, invoked: str) -> dict[str, Any]:
    return {
        **invocation_meta(invoking, invoked, widget_accessible=True),
        "ui": {"visibility": ["app"]},
        "openai/visibility": "private",
    }


async def run_as_user[T](scopes: Iterable[str], fn: Callable[[Session, User, bool], T]) -> T:
    """Authenticate (from the verified token only), then run `fn(db, user, created)` in a thread."""
    token = current_token(scopes)

    def work() -> T:
        with session_scope() as db:
            user, created = resolve_user(db, token)
            return fn(db, user, created)

    return await anyio.to_thread.run_sync(work)


def _dump(data: BaseModel | dict | None) -> dict | None:
    if data is None:
        return None
    if isinstance(data, BaseModel):
        return data.model_dump(mode="json")
    return json.loads(json.dumps(data, default=str))


def ok(text: str, data: BaseModel | dict | None = None, meta: dict | None = None) -> CallToolResult:
    """Success result: short text for the model + structuredContent for model and widget."""
    return CallToolResult(content=[TextContent(type="text", text=text)], structured_content=_dump(data), meta=meta)


def error(exc: VennError) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=str(exc))], is_error=True)


async def guarded(coro_fn: Callable[[], Any]) -> CallToolResult:
    """Run a tool body, converting domain errors into is_error tool results."""
    try:
        return await coro_fn()
    except VennError as exc:
        log.info("tool error %s", exc.code)
        return error(exc)
