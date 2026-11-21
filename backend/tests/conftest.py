from __future__ import annotations

import itertools
import os
from collections.abc import Iterator
from typing import Any

import pytest
from starlette.testclient import TestClient

from app.config import ALL_SCOPES, Settings
from app.db.database import Base, get_engine, session_scope
from app.main import create_app

BASE_URL = "http://localhost:8081"
ACCEPT = "application/json, text/event-stream"
# Set TEST_DATABASE_URL=postgresql://... to run the suite against Postgres (tables are reset per test).
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        database_url=TEST_DATABASE_URL or f"sqlite:///{tmp_path / 'venn_test.db'}",
        public_base_url=BASE_URL,
        auth_mode="dev",
        dev_auth_secret="test-secret-test-secret-test-secret-123",  # noqa: S106
        openai_api_key=None,
        widget_path=tmp_path / "missing-widget.html",
        web_dist_path=tmp_path / "web-dist",
    )


@pytest.fixture
def client(settings) -> Iterator[TestClient]:
    app = create_app(settings)
    if TEST_DATABASE_URL:
        Base.metadata.drop_all(get_engine())
        Base.metadata.create_all(get_engine())
    with TestClient(app, base_url=BASE_URL) as c:
        c.app_state = app.state  # type: ignore[attr-defined]
        yield c


@pytest.fixture
def db():
    """A DB session bound to the test app's engine (use after `client`)."""
    with session_scope() as s:
        yield s


class MCPUser:
    """Calls MCP tools over HTTP as one authenticated user."""

    _ids = itertools.count(1)

    def __init__(self, client: TestClient, token: str):
        self.client = client
        self.token = token

    def rpc(self, method: str, params: dict | None = None, token: str | None = None) -> Any:
        headers = {"accept": ACCEPT}
        tok = self.token if token is None else token
        if tok:
            headers["authorization"] = f"Bearer {tok}"
        resp = self.client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "id": next(self._ids), "method": method, "params": params or {}},
            headers=headers,
        )
        return resp

    def call(self, tool: str, **arguments: Any) -> dict:
        resp = self.rpc("tools/call", {"name": tool, "arguments": arguments})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "result" in body, body
        return body["result"]

    def ok(self, tool: str, **arguments: Any) -> dict:
        result = self.call(tool, **arguments)
        assert not result.get("isError"), result["content"][0]["text"]
        return result.get("structuredContent") or {}

    def err(self, tool: str, **arguments: Any) -> str:
        result = self.call(tool, **arguments)
        assert result.get("isError"), result
        return result["content"][0]["text"]


def mint_token(client: TestClient, username: str, scopes: list[str] | None = None, name: str | None = None) -> str:
    provider = client.app_state.dev_provider  # type: ignore[attr-defined]
    return provider._issue("test-client", username, scopes or list(ALL_SCOPES), name or username.title()).access_token


@pytest.fixture
def make_user(client):
    def _make(username: str, scopes: list[str] | None = None, name: str | None = None) -> MCPUser:
        return MCPUser(client, mint_token(client, username, scopes, name))

    return _make


@pytest.fixture
def alice(make_user) -> MCPUser:
    return make_user("alice", name="Alice")


@pytest.fixture
def bob(make_user) -> MCPUser:
    return make_user("bob", name="Bob")


@pytest.fixture
def carol(make_user) -> MCPUser:
    return make_user("carol", name="Carol")


WEB_HEADERS = {"X-Venn-Request": "1"}


class WebUser:
    """Uses the website's API as one signed-in person (own cookie jar, same app)."""

    def __init__(self, client: TestClient, username: str | None = None, name: str | None = None):
        self.http = TestClient(client.app, base_url=BASE_URL)
        self.username = username
        if username:
            body = {"username": username, "display_name": name or username.title(), "create": True}
            resp = self.http.post("/api/v1/session", json=body, headers=WEB_HEADERS)
            assert resp.status_code == 200, resp.text

    def get(self, path: str, **params: Any) -> Any:
        return self.http.get(f"/api/v1{path}", params=params or None)

    def send(self, method: str, path: str, body: dict | None = None, headers: dict | None = None) -> Any:
        return self.http.request(
            method, f"/api/v1{path}", json=body, headers=WEB_HEADERS if headers is None else headers
        )

    def ok(self, method: str, path: str, body: dict | None = None, **params: Any) -> dict:
        resp = self.get(path, **params) if method == "GET" else self.send(method, path, body)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def err(self, method: str, path: str, body: dict | None = None, **params: Any) -> tuple[int, str]:
        resp = self.get(path, **params) if method == "GET" else self.send(method, path, body)
        assert resp.status_code >= 400, resp.text
        return resp.status_code, resp.json()["error"]["code"]


@pytest.fixture
def web(client):
    def _make(username: str | None = None, name: str | None = None) -> WebUser:
        return WebUser(client, username, name)

    return _make
