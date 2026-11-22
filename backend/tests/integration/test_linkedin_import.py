"""LinkedIn import: the cookie reader, the connections parser and the website routes.

LinkedIn and Apify are replaced by canned responses; nothing here touches the network.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import httpx
import pytest

from app.services import linkedin_service as li
from app.services.errors import InvalidRequest, RateLimited

LI_AT = "AQEDAT" + "x" * 40


def _page(people: list[tuple[str, str, str, object]], total: int) -> dict:
    included, refs = [], []
    for i, (identifier, first, last, headline) in enumerate(people):
        profile = f"urn:li:fsd_profile:{identifier}"
        row = f"urn:li:fsd_connection:{identifier}"
        refs.append(row)
        included.append(
            {
                "$type": "com.linkedin.voyager.dash.identity.profile.Profile",
                "entityUrn": profile,
                "firstName": first,
                "lastName": last,
                "headline": headline,
                "publicIdentifier": identifier,
            }
        )
        included.append(
            {
                "$type": "com.linkedin.voyager.dash.relationships.Connection",
                "entityUrn": row,
                "createdAt": 1_700_000_000_000 + i,
                "*connectedMemberResolutionResult": profile,
            }
        )
    return {"data": {"*elements": refs, "paging": {"total": total, "start": 0, "count": 40}}, "included": included}


def _linkedin(pages: dict[int, dict], seen: list[httpx.Request] | None = None, status: int = 200) -> httpx.Client:
    def handle(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        if status != 200:
            return httpx.Response(status, text="no")
        return httpx.Response(200, json=pages.get(int(request.url.params["start"]), _page([], 0)))

    return httpx.Client(transport=httpx.MockTransport(handle))


def test_cookies_are_read_from_every_pasted_format() -> None:
    exported = json.dumps(
        [
            {"domain": ".www.linkedin.com", "name": "JSESSIONID", "value": '"ajax:123"'},
            {"domain": ".linkedin.com", "name": "li_at", "value": LI_AT},
            {"domain": ".example.com", "name": "other", "value": "nope"},
        ]
    )
    assert li.parse_cookies(exported) == {"JSESSIONID": '"ajax:123"', "li_at": LI_AT}
    assert li.parse_cookies(f'Cookie: li_at={LI_AT}; JSESSIONID="ajax:9"')["JSESSIONID"] == '"ajax:9"'
    bare = li.parse_cookies(LI_AT)
    assert bare["li_at"] == LI_AT and bare["JSESSIONID"].startswith('"ajax:')
    # Nothing pasted can add a header line to the request.
    sneaky = li.parse_cookies(f"li_at={LI_AT}\r\nevil: 1; x=a\tb")
    assert set(sneaky) == {"li_at", "JSESSIONID"} and "\r" not in "".join(sneaky.values())
    for bad in ("", "hello there", "JSESSIONID=x; lang=en", "[1, 2"):
        with pytest.raises(InvalidRequest):
            li.parse_cookies(bad)


def test_connections_are_read_page_by_page_with_the_session() -> None:
    first = [(f"p{i}", "Pat", str(i), "Engineer") for i in range(40)]
    second = [("maya-chen", "Maya", "Chen", {"text": "Photographer at  Lens"}), ("bad id!", "No", "One", "x")]
    seen: list[httpx.Request] = []
    client = _linkedin({0: _page(first, 41), 40: _page(second, 41)}, seen)
    page = li.fetch_connections(f'li_at={LI_AT}; JSESSIONID="ajax:42"', 100, client=client, pause=lambda _: None)

    assert len(page.connections) == 41 and page.total == 41 and not page.truncated
    maya = page.connections[-1]
    assert (maya.name, maya.headline, maya.profile_url) == (
        "Maya Chen",
        "Photographer at Lens",
        "https://www.linkedin.com/in/maya-chen",
    )
    assert maya.connected_on is not None
    assert [r.url.params["start"] for r in seen] == ["0", "40"]
    assert seen[0].headers["csrf-token"] == "ajax:42" and LI_AT in seen[0].headers["cookie"]

    short = li.fetch_connections(LI_AT, 10, client=_linkedin({0: _page(first, 41)}), pause=lambda _: None)
    assert len(short.connections) == 10 and short.truncated


def test_what_was_already_read_survives_linkedin_cutting_us_off() -> None:
    answers = [httpx.Response(200, json=_page([(f"p{i}", "Pat", str(i), "Engineer") for i in range(40)], 400))]
    answers.append(httpx.Response(302, headers=[("set-cookie", "li_at=delete me; Path=/")]))
    client = httpx.Client(transport=httpx.MockTransport(lambda _: answers.pop(0) if answers else answers[0]))
    page = li.fetch_connections(LI_AT, 200, client=client, pause=lambda _: None)
    assert len(page.connections) == 40 and page.truncated
    assert page.stopped is not None and "signed this session out" in page.stopped


def test_a_rejected_session_and_a_rate_limit_are_told_apart() -> None:
    with pytest.raises(InvalidRequest) as rejected:
        li.fetch_connections(LI_AT, 10, client=_linkedin({}, status=403))
    assert LI_AT not in rejected.value.message
    with pytest.raises(InvalidRequest):
        li.fetch_connections(LI_AT, 10, client=_linkedin({}, status=302))
    with pytest.raises(RateLimited):
        li.fetch_connections(LI_AT, 10, client=_linkedin({}, status=429))


PROFILE = {
    "publicIdentifier": "maya-chen",
    "headline": "Photographer at Lens",
    "about": "I shoot street photography. Reach me at maya@example.com",
    "location": {"linkedinText": "Berlin, Germany"},
    "topSkills": "Photography • Street Photography",
    "skills": [{"name": "Photography"}, {"name": "Editing"}],
    "currentPosition": [{"companyName": "Lens"}],
    "experience": [{"position": "Photographer", "companyName": "Lens"}],
    "education": [{"schoolName": "UdK Berlin"}],
    "query": {"publicIdentifier": "maya-chen"},
}


def test_profile_details_come_from_apify_and_become_notes() -> None:
    sent: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(201, json=[PROFILE, {"query": {"publicIdentifier": "stranger"}}])

    client = httpx.Client(transport=httpx.MockTransport(handle))
    profiles = li.fetch_profiles(["maya-chen", "tom"], token="t0ken", actor="ACTOR", timeout=5, client=client)  # noqa: S106
    assert list(profiles) == ["maya-chen"]
    body = json.loads(sent[0].content)
    assert body["queries"] == ["https://www.linkedin.com/in/maya-chen", "https://www.linkedin.com/in/tom"]
    assert sent[0].headers["authorization"] == "Bearer t0ken" and "/acts/ACTOR/" in str(sent[0].url)

    person = li.candidate("Maya Chen", "old headline", profiles["maya-chen"])
    assert person.relationship == "LinkedIn connection"
    assert person.interests == ["Photography", "Street Photography", "Editing"]
    for expected in (
        "Photographer at Lens.",
        "Based in Berlin, Germany.",
        "Studied at UdK Berlin.",
        "street photography",
    ):
        assert expected in person.notes
    assert li.candidate("Tom Becker", "Engineer").notes == "Engineer."


def test_website_lists_connections_then_imports_only_the_picked_ones(web, alice, monkeypatch) -> None:
    pasted: list[str] = []

    def fake_fetch(raw: str, limit: int) -> li.ConnectionPage:
        pasted.append(raw)
        people = [li.Connection("maya-chen", "Maya Chen", "Photographer at Lens", None)]
        people.append(li.Connection("tom-b", "Tom Becker", "Engineer", None))
        return li.ConnectionPage(people, 2, False)

    monkeypatch.setattr(li, "fetch_connections", fake_fetch)
    me = web("alice")
    assert me.err("POST", "/linkedin/connections", {"cookies": "nonsense words"}) == (400, "INVALID_REQUEST")
    listed = me.ok("POST", "/linkedin/connections", {"cookies": LI_AT})
    assert [c["name"] for c in listed["connections"]] == ["Maya Chen", "Tom Becker"]
    assert listed["details_available"] is False and pasted == [LI_AT]
    assert me.ok("GET", "/people")["count"] == 0  # listing saves nobody

    pick = {"public_identifier": "maya-chen", "name": "Maya Chen", "headline": "Photographer at Lens"}
    preview = me.ok("POST", "/linkedin/import-preview", {"people": [pick]})
    assert preview["source"] == "linkedin" and preview["details_for"] == 0
    assert preview["candidates"][0]["notes"] == "Photographer at Lens."
    assert me.ok("POST", "/people/import", {"import_id": preview["import_id"], "indexes": [0]})["count"] == 1

    # The same Venn account in ChatGPT finds her; the connection that was not picked is nowhere.
    found = alice.ok("venn_find_people", query="photographer")
    assert [r["display_name"] for r in found["results"]] == ["Maya Chen"]
    assert alice.ok("venn_find_people", query="engineer")["results"] == []
    again = me.ok("POST", "/linkedin/connections", {"cookies": LI_AT})
    assert [c["already_added"] for c in again["connections"]] == [True, False]

    signed_out = web()
    assert signed_out.err("POST", "/linkedin/connections", {"cookies": LI_AT})[0] == 401


EXPORT = """Notes:
"Some email addresses may be missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Maya,Chen,https://www.linkedin.com/in/maya-chen,,Lens Studio,Photographer,"01 Mar 2024"
Tom,Becker,https://www.linkedin.com/in/tom-becker/,tom@example.com,,Engineer,"02 Apr 2023"
,,,,,,
Sofia,Rossi,,,Tavola,,"05 May 2022"
"""


def test_the_linkedin_export_file_is_the_other_way_in(web) -> None:
    me = web("alice")
    listed = me.ok("POST", "/linkedin/export", {"csv": EXPORT})
    assert [(c["name"], c["headline"], c["public_identifier"]) for c in listed["connections"]] == [
        ("Maya Chen", "Photographer at Lens Studio", "maya-chen"),
        ("Tom Becker", "Engineer", "tom-becker"),
        ("Sofia Rossi", "Tavola", None),
    ]
    assert me.err("POST", "/linkedin/export", {"csv": "name;job\nx;y"}) == (400, "INVALID_REQUEST")

    picked = [{k: c[k] for k in ("public_identifier", "name", "headline")} for c in listed["connections"][1:]]
    preview = me.ok("POST", "/linkedin/import-preview", {"people": picked})
    assert [c["name"] for c in preview["candidates"]] == ["Tom Becker", "Sofia Rossi"]
    assert me.ok("POST", "/people/import", {"import_id": preview["import_id"], "indexes": [0, 1]})["count"] == 2


def test_demo_imports_100_private_samples_only_after_confirmation(web, alice, monkeypatch) -> None:
    def no_external_call(*args, **kwargs):
        pytest.fail("The demo must not contact LinkedIn or Apify")

    monkeypatch.setattr(li, "fetch_connections", no_external_call)
    monkeypatch.setattr(li, "fetch_profiles", no_external_call)
    assert web().err("POST", "/linkedin/demo-preview")[0] == 401
    me, other = web("alice"), web("bob")
    real = me.ok("POST", "/people", {"name": "My real friend"})
    preview = me.ok("POST", "/linkedin/demo-preview")
    candidates = preview["candidates"]
    assert preview["source"] == "linkedin_demo" and preview["skipped"] == 0
    assert len(candidates) == len({c["name"].lower() for c in candidates}) == 100
    assert all(not c["already_added"] for c in candidates)
    assert me.ok("GET", "/people")["count"] == 1
    assert alice.ok("venn_find_people", query=candidates[0]["name"])["results"] == []

    payload = {"import_id": preview["import_id"], "indexes": list(range(100))}
    assert other.err("POST", "/people/import", payload) == (404, "NOT_FOUND")
    assert me.err("POST", "/people/import", {**payload, "indexes": [0, 100]}) == (400, "INVALID_REQUEST")
    assert me.ok("GET", "/people")["count"] == 1
    added = me.ok("POST", "/people/import", payload)
    assert added["count"] == 100 and all(p["is_sample"] for p in added["imported"])
    assert me.err("POST", "/people/import", payload) == (400, "INVALID_REQUEST")
    assert other.ok("GET", "/people")["count"] == 0
    assert me.ok("GET", "/home")["sample_loaded"] is True
    results = alice.ok("venn_find_people", query=candidates[0]["name"])["results"]
    assert results[0]["display_name"] == candidates[0]["name"] and results[0]["is_sample"]
    pending = me.ok("POST", "/linkedin/demo-preview")
    assert all(c["already_added"] for c in pending["candidates"])

    assert me.ok("DELETE", "/sample")["people"] == 100
    assert me.err("POST", "/people/import", {"import_id": pending["import_id"], "indexes": [0]}) == (404, "NOT_FOUND")
    assert [p["person_id"] for p in me.ok("GET", "/people")["people"]] == [real["person_id"]]


def test_demo_respects_partial_selection_and_existing_names(web) -> None:
    me = web("alice")
    preview = me.ok("POST", "/linkedin/demo-preview")
    stale = me.ok("POST", "/linkedin/demo-preview")
    name = preview["candidates"][0]["name"]
    me.ok("POST", "/people", {"name": name, "notes": "An existing private note."})
    picked = [0, 42, 99]
    added = me.ok("POST", "/people/import", {"import_id": preview["import_id"], "indexes": picked})
    assert [p["name"] for p in added["imported"]] == [preview["candidates"][i]["name"] for i in picked[1:]]
    assert me.ok("POST", "/people/import", {"import_id": stale["import_id"], "indexes": picked})["count"] == 0
    assert me.ok("GET", "/people")["count"] == 3


def test_demo_name_collision_does_not_block_real_linkedin_import(web) -> None:
    me = web("alice")
    demo = me.ok("POST", "/linkedin/demo-preview")
    name = demo["candidates"][0]["name"]
    first, last = name.split(" ", 1)
    me.ok("POST", "/people/import", {"import_id": demo["import_id"], "indexes": [0]})
    csv = f"First Name,Last Name,Position\n{first},{last},Engineer\n"
    assert me.ok("POST", "/linkedin/export", {"csv": csv})["connections"][0]["already_added"] is False
    preview = me.ok("POST", "/linkedin/import-preview", {"people": [{"name": name}]})
    assert preview["candidates"][0]["already_added"] is False
    real = me.ok("POST", "/people/import", {"import_id": preview["import_id"], "indexes": [0]})["imported"][0]
    assert not real["is_sample"]
    assert me.ok("DELETE", "/sample")["people"] == 1
    assert [p["person_id"] for p in me.ok("GET", "/people")["people"]] == [real["person_id"]]


@pytest.mark.parametrize("same_preview", [True, False])
def test_concurrent_demo_confirmations_do_not_duplicate_profiles(settings, web, same_preview) -> None:
    if settings.database_url.startswith("sqlite"):
        pytest.skip("Tests PostgreSQL row locking")
    me = web("alice")
    first = me.ok("POST", "/linkedin/demo-preview")["import_id"]
    second = first if same_preview else me.ok("POST", "/linkedin/demo-preview")["import_id"]
    start = Barrier(2)

    def confirm(import_id: str) -> tuple[int, int]:
        start.wait(timeout=5)
        response = me.send("POST", "/people/import", {"import_id": import_id, "indexes": list(range(100))})
        return response.status_code, response.json().get("count", 0)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(pool.map(confirm, [first, second]))
    assert results == ([(200, 100), (400, 0)] if same_preview else [(200, 0), (200, 100)])
    assert me.ok("GET", "/people")["count"] == 100


def test_demo_does_not_change_regular_import_limit_or_allow_spoofing_samples(web) -> None:
    me = web("alice")
    people = [{"name": f"Connection {i}"} for i in range(51)]
    assert me.err("POST", "/linkedin/import-preview", {"people": people}) == (400, "INVALID_REQUEST")
    assert me.err("POST", "/people/import-preview", {"people": people}) == (400, "INVALID_REQUEST")

    preview = me.ok("POST", "/people/import-preview", {"people": people[:1], "source": "linkedin_demo"})
    payload = {"import_id": preview["import_id"], "indexes": [0] * 51}
    assert me.err("POST", "/people/import", payload) == (400, "INVALID_REQUEST")
    result = me.ok("POST", "/people/import", {**payload, "indexes": [0]})
    assert result["imported"][0]["is_sample"] is False
