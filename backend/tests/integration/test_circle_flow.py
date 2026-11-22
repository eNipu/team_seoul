"""Import, "who do I know who…", group plans, meetup brief/recap, follow-ups, quiz and invite links."""

import random

import pytest

from app.config import ALL_SCOPES
from app.db.database import session_scope
from app.invite_page import normalize, render_invite_page
from app.models import Person, User
from app.services import people_service, quiz_service, relationship_service
from tests.integration.test_people_flow import add
from tests.integration.test_social_flow import connect, save

PEOPLE = [
    {
        "name": "Maya Park",
        "relationship": "college roommate",
        "interests": ["Climbing", "Jazz"],
        "last_met_days_ago": 40,
    },
    {"name": "Tom Lee", "notes": "Works in design. Reach him at tom@example.com or +82 10-1234-5678", "interests": []},
    {"name": "Sora", "relationship": "ex-colleague 2019 - 2021", "notes": "See https://linkedin.com/in/sora"},
]


# ----------------------------------------------------------------------- import
def test_import_is_reviewed_before_anything_is_saved(alice):
    view = alice.ok("venn_propose_people_import", people=PEOPLE, source="pasted list")
    assert view["view"] == "people_import"
    assert view["source"] == "pasted list"
    assert [c["index"] for c in view["candidates"]] == [0, 1, 2]
    assert view["skipped"] == 0
    assert alice.ok("venn_list_people")["count"] == 0  # proposing saves nothing

    tom, sora = view["candidates"][1], view["candidates"][2]
    # Contact details are stripped; a year range is not a phone number.
    assert tom["notes"] == "Works in design. Reach him at or"
    assert sora["notes"] == "See"
    assert sora["relationship"] == "ex-colleague 2019 - 2021"

    done = alice.ok("venn_import_people", import_id=view["import_id"], indexes=[0, 2, 0])
    assert done["count"] == 2
    assert [p["name"] for p in done["imported"]] == ["Maya Park", "Sora"]
    assert done["imported"][0]["last_interaction_at"] is not None  # "last met 40 days ago"
    assert sorted(p["name"] for p in alice.ok("venn_list_people")["people"]) == ["Maya Park", "Sora"]

    # Single use: the unpicked entry cannot be added later from the same import.
    assert "already used" in alice.err("venn_import_people", import_id=view["import_id"], indexes=[1])


def test_import_flags_people_already_added_and_skips_sensitive(alice):
    add(alice, name="Maya Park")
    view = alice.ok(
        "venn_propose_people_import",
        people=[
            {"name": "maya park"},
            {"name": "Jun", "notes": "his password is hunter2hunter2"},
            {"name": "Hana"},
            {"name": "Hana"},  # exact duplicate collapses
        ],
    )
    assert [(c["name"], c["already_added"]) for c in view["candidates"]] == [("maya park", True), ("Hana", False)]
    assert view["skipped"] == 1


def test_namesakes_are_reviewed_separately_and_ambiguous_memories_stay_unassigned(alice, bob):
    first = add(alice, name="Alex", relationship="coworker")
    add(bob, name="Alex", relationship="neighbor")
    view = alice.ok("venn_propose_people_import", people=[{"name": "Alex", "relationship": "running club"}])
    candidate = view["candidates"][0]
    assert candidate["already_added"] and candidate["existing_relationships"] == ["coworker"]
    assert candidate["relationship"] == "running club"
    second = alice.ok("venn_import_people", import_id=view["import_id"], indexes=[0])["imported"][0]
    assert first["person_id"] != second["person_id"]

    proposal = alice.ok(
        "venn_propose_memories",
        suggested=[
            {"category": "EXPERIENCE", "title": "Pottery with Alex", "description": "We made mugs.", "people": ["Alex"]}
        ],
    )
    alice.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    assert not alice.ok("venn_find_people", query="pottery")["results"]
    for person in (first, second):
        friend = alice.ok("venn_view_friend", person_id=person["person_id"])
        assert "pottery" not in [term.lower() for term in friend["shared_interests"]]


def test_radar_signals_only_the_callers_authorized_interests(alice, bob, make_user):
    save(alice, "INTEREST", "Pottery", "Wheel throwing", "PRIVATE", ["ceramics"])
    save(bob, "INTEREST", "Sailing", "On weekends", "PRIVATE")
    people = [{"name": "Alex", "interests": ["CERAMICS", "Sailing"]}]
    view = alice.ok("venn_propose_people_import", people=people)
    assert view["candidates"][0]["shared_interests"] == ["CERAMICS"]
    limited = make_user("alice", scopes=[s for s in ALL_SCOPES if s != "venn.memories.read"])
    denied = limited.rpc("tools/call", {"name": "venn_propose_people_import", "arguments": {"people": people}})
    assert denied.status_code == 403


def test_import_validation(alice):
    view = alice.ok("venn_propose_people_import", people=[{"name": "Maya"}])
    assert alice.err("venn_import_people", import_id=view["import_id"], indexes=[3]).startswith("INVALID_REQUEST")
    assert alice.err("venn_import_people", import_id="nope", indexes=[0]).startswith("NOT_FOUND")
    assert "No people" in alice.err(
        "venn_propose_people_import", people=[{"name": "x", "notes": "api key sk-abcdefghijklmnopqrstuvwx"}]
    )
    # The failed attempts did not consume the import.
    assert alice.ok("venn_import_people", import_id=view["import_id"], indexes=[0])["count"] == 1


def test_expired_import_is_refused(alice):
    from datetime import timedelta

    from app.models import PeopleImport
    from app.models._base import utcnow

    view = alice.ok("venn_propose_people_import", people=[{"name": "Maya"}])
    with session_scope() as db:
        db.query(PeopleImport).update({PeopleImport.expires_at: utcnow() - timedelta(minutes=1)})
    assert "expired" in alice.err("venn_import_people", import_id=view["import_id"], indexes=[0])
    assert alice.ok("venn_list_people")["count"] == 0


# ------------------------------------------------------------------ find people
def test_find_people_across_notes_and_shared_memories(alice, bob):
    conn = connect(alice, bob)
    save(bob, "INTEREST", "Bouldering", "Climbs at the gym on Tuesdays", "SHARED_WITH_CONNECTIONS", ["climbing"])
    save(bob, "INTEREST", "Secret tarot habit", "Reads tarot cards", "PRIVATE", ["tarot"])
    maya = add(alice, name="Maya", relationship="roommate", interests=["Rock climbing", "Jazz"])
    add(alice, name="Tom", notes="Went to a party with him. Works in design; a keen climber since school.")
    add(alice, name="Hana", interests=["Pottery"])

    view = alice.ok("venn_find_people", query="who do I know who climbs?")
    assert view["view"] == "people_search"
    assert view["searched"] == 4
    by_name = {r["display_name"]: r for r in view["results"]}
    assert set(by_name) == {"Maya", "Bob", "Tom"}
    assert by_name["Maya"] | {"kind": "person", "id": maya["person_id"], "on_venn": False} == by_name["Maya"]
    assert by_name["Maya"]["matched"] == ["Rock climbing"]
    assert by_name["Bob"] | {"kind": "connection", "id": conn, "on_venn": True} == by_name["Bob"]
    assert by_name["Bob"]["matched"] == ["Bouldering"]
    assert "Climbs at the gym" in by_name["Bob"]["snippet"]
    assert by_name["Tom"]["matched"] == ["notes"]
    assert "climber" in by_name["Tom"]["snippet"]
    # A notes-only hit ranks below an interest hit.
    assert [r["display_name"] for r in view["results"]][-1] == "Tom"

    # Private memories of a connection are never searched.
    assert alice.ok("venn_find_people", query="tarot")["results"] == []
    # Short words match exactly: "art" does not find "party".
    assert alice.ok("venn_find_people", query="art")["results"] == []
    assert [r["display_name"] for r in alice.ok("venn_find_people", query="design")["results"]] == ["Tom"]
    assert alice.err("venn_find_people", query="who do I know").startswith("INVALID_REQUEST")


# ------------------------------------------------------------------- group plan
def test_plan_group_finds_common_ground(alice, bob):
    conn = connect(alice, bob)
    save(alice, "INTEREST", "Board games", "Plays most weekends", "PRIVATE", ["hiking"])
    save(bob, "INTEREST", "Board games", "Owns too many", "SHARED_WITH_CONNECTIONS")
    save(bob, "INTEREST", "Jazz", "Goes to gigs", "SHARED_WITH_CONNECTIONS")
    maya = add(alice, name="Maya", interests=["Board games", "Jazz", "Hiking"])

    view = alice.ok("venn_plan_group", connection_ids=[conn], person_ids=[maya["person_id"]])
    assert view["view"] == "group_plan"
    assert [(m["kind"], m["display_name"]) for m in view["members"]] == [("connection", "Bob"), ("person", "Maya")]
    assert view["common_to_all"] == ["board games"]  # not also "board" and "games"
    some = {o["interest"]: o["members"] for o in view["common_to_some"]}
    assert some == {"hiking": ["You", "Maya"], "jazz": ["Bob", "Maya"]}
    assert view["suggestions"][0]["title"] == "Game night"
    assert view["suggestions"][0]["grounded_in"] == ["board games"]
    assert len(view["suggestions"]) == 3

    assert "2 to 6" in alice.err("venn_plan_group", person_ids=[maya["person_id"]])
    assert alice.err("venn_plan_group", connection_ids=[conn], person_ids=["nope"]).startswith("NOT_FOUND")


# --------------------------------------------------------- brief, recap, follow-ups
def test_meetup_brief_recap_and_follow_ups(alice):
    save(alice, "INTEREST", "Hiking", "Weekend hikes", "PRIVATE")
    maya = add(
        alice, name="Maya", relationship="cousin", notes="Has a dog called Bori.", interests=["Hiking", "Pottery"]
    )
    pid = maya["person_id"]

    asked = alice.ok("venn_add_follow_up", person_id=pid, text="  How the   job interview went ")
    assert asked["text"] == "How the job interview went"

    brief = alice.ok("venn_meetup_brief", person_id=pid)
    assert brief["view"] == "brief"
    assert brief | {"kind": "person", "id": pid, "on_venn": False, "relationship": "cousin"} == brief
    assert brief["notes"] == "Has a dog called Bori."
    assert brief["shared_interests"] == ["hiking"]
    assert brief["last_interaction_at"] is None and brief["days_since_last_interaction"] is None
    assert [f["text"] for f in brief["things_to_ask"]] == ["How the job interview went"]
    assert "We're both into hiking — anything new there?" in brief["conversation_starters"]
    assert "Still into Pottery? What's new with that?" in brief["conversation_starters"]

    recap = alice.ok(
        "venn_recap_meetup",
        person_id=pid,
        activity="Ramen in Hongdae",
        follow_ups=["Her move to Busan"],
        notes_to_add="Got the job at the studio.",
        new_interests=["Ceramics", "hiking"],
        done_follow_up_ids=[asked["follow_up_id"]],
    )
    assert recap["recorded"] is True and recap["notes_updated"] is True
    assert [f["text"] for f in recap["follow_ups"]] == ["Her move to Busan"]

    friend = alice.ok("venn_view_friend", person_id=pid)
    assert friend["notes"] == "Has a dog called Bori.\nGot the job at the studio."
    assert friend["interests"] == ["Hiking", "Pottery", "Ceramics"]
    assert friend["recent_interactions"][0]["activity"] == "Ramen in Hongdae"
    assert [f["text"] for f in friend["follow_ups"]] == ["Her move to Busan"]

    after = alice.ok("venn_meetup_brief", person_id=pid)
    assert after["last_activity"] == "Ramen in Hongdae"
    assert after["days_since_last_interaction"] == 0
    assert after["conversation_starters"][0] == "Last time was “Ramen in Hongdae” — want to do that again?"

    # Ticking off is idempotent.
    fid = recap["follow_ups"][0]["follow_up_id"]
    assert alice.ok("venn_complete_follow_up", follow_up_id=fid) == {"done": True, "follow_up_id": fid}
    assert alice.ok("venn_complete_follow_up", follow_up_id=fid)["done"] is True
    assert alice.ok("venn_view_friend", person_id=pid)["follow_ups"] == []


def test_recap_for_connection_keeps_no_private_note(alice, bob):
    conn = connect(alice, bob)
    save(bob, "EXPERIENCE", "Moved to Seoul", "Relocated last spring", "SHARED_WITH_CONNECTIONS")
    recap = alice.ok(
        "venn_recap_meetup", connection_id=conn, activity="Coffee", follow_ups=["His new flat"], notes_to_add="x"
    )
    assert recap | {"kind": "connection", "id": conn, "notes_updated": False} == recap
    brief = alice.ok("venn_meetup_brief", connection_id=conn)
    assert brief["on_venn"] is True and brief["notes"] is None
    assert [m["title"] for m in brief["shared_memories"]] == ["Moved to Seoul"]
    assert [f["text"] for f in brief["things_to_ask"]] == ["His new flat"]
    # Bob never sees Alice's follow-ups about him.
    assert alice.ok("venn_view_friend", connection_id=conn)["follow_ups"] != []
    assert bob.ok("venn_view_friend", connection_id=conn)["follow_ups"] == []


def test_recap_is_all_or_nothing(alice):
    maya = add(alice, name="Maya", notes="n" * 990)
    err = alice.err("venn_recap_meetup", person_id=maya["person_id"], activity="Tea", notes_to_add="x" * 50)
    assert "Nothing was recorded" in err
    assert alice.ok("venn_view_friend", person_id=maya["person_id"])["recent_interactions"] == []


# ------------------------------------------------------------------------ quiz
def _check_questions(view):
    assert 3 <= len(view["questions"]) <= 6
    for q in view["questions"]:
        assert 2 <= len(q["options"]) <= 4
        assert len(set(q["options"])) == len(q["options"])
        assert 0 <= q["answer_index"] < len(q["options"])
        assert q["prompt"] and q["explanation"]


def test_friend_quiz_uses_only_what_the_friend_shared(alice, bob, carol):
    conn = connect(alice, bob)
    connect(alice, carol)
    save(alice, "INTEREST", "Board games", "Plays most weekends", "PRIVATE")
    save(carol, "INTEREST", "Salsa", "Dances on Fridays", "SHARED_WITH_CONNECTIONS")
    for category, title in [
        ("INTEREST", "Board games"),
        ("INTEREST", "Jazz"),
        ("INTEREST", "Trail running"),
        ("DISLIKE", "Loud bars"),
        ("EXPERIENCE", "Hiked Hallasan"),
    ]:
        save(bob, category, title, f"About {title}", "SHARED_WITH_CONNECTIONS")
    save(bob, "INTEREST", "Secret tarot habit", "Reads tarot cards", "PRIVATE")

    for _ in range(8):  # questions are shuffled; the rules must hold every time
        view = alice.ok("venn_start_quiz", connection_id=conn)
        assert view | {"view": "quiz", "mode": "friend", "kind": "connection", "id": conn} == view
        assert view["title"] == "How well do you know Bob?"
        assert view["common_ground"] == ["board games"]
        assert view["next"]["title"] == "Game night"
        _check_questions(view)
        text = str(view).lower()
        assert "tarot" not in text
        shared = {"board games", "jazz", "trail running", "loud bars", "hiked hallasan"}
        for q in view["questions"]:
            if q["options"] == ["True", "False"]:
                continue
            # Exactly one option is something Bob shared, and it is the answer.
            assert [o for o in q["options"] if o.lower() in shared] == [q["options"][q["answer_index"]]]


def test_friend_quiz_needs_enough_shared(alice, bob):
    conn = connect(alice, bob)
    save(bob, "INTEREST", "Jazz", "Goes to gigs", "SHARED_WITH_CONNECTIONS")
    assert "hasn't shared enough" in alice.err("venn_start_quiz", connection_id=conn)
    assert alice.err("venn_start_quiz", connection_id="nope").startswith("NOT_FOUND")


def test_circle_quiz_mixes_connections_and_people(alice, bob):
    connect(alice, bob)
    save(bob, "INTEREST", "Jazz", "Goes to gigs", "SHARED_WITH_CONNECTIONS")
    add(alice, name="Maya", interests=["Climbing", "Pottery"])
    add(alice, name="Tom", interests=["Chess", "Jazz"])
    assert "Not enough" not in str(alice.call("venn_start_quiz"))
    for _ in range(8):
        view = alice.ok("venn_start_quiz")
        assert view | {"mode": "circle", "kind": None, "id": None, "next": None, "common_ground": []} == view
        _check_questions(view)
        for q in view["questions"]:
            answer = q["options"][q["answer_index"]]
            if "Jazz" in q["prompt"]:
                # Bob and Tom both like jazz, so the other one can't be offered as a wrong answer.
                assert {"Bob", "Tom"} & set(q["options"]) == {answer}
            if "Climbing" in q["prompt"] or "Pottery" in q["prompt"]:
                assert answer == "Maya"


def test_circle_quiz_needs_friends(alice):
    add(alice, name="Maya", interests=["Climbing"])
    assert alice.err("venn_start_quiz").startswith("INVALID_REQUEST")


def test_quiz_is_reproducible_with_a_seed(alice, bob):
    connect(alice, bob)
    add(alice, name="Maya", interests=["Climbing", "Pottery"])
    add(alice, name="Tom", interests=["Chess", "Jazz"])
    with session_scope() as db:
        user = db.query(User).filter(User.display_name == "Alice").one()
        first = quiz_service.start_quiz(db, user, rng=random.Random(7))
        second = quiz_service.start_quiz(db, user, rng=random.Random(7))
    assert first.questions == second.questions


# ------------------------------------------------------------------ invite link
def test_invite_has_link_and_scannable_qr(alice, client):
    invite = alice.ok("venn_create_invite")
    assert invite["link"].endswith(f"/i/{invite['code']}")
    assert invite["link"] in invite["share_text"]
    qr = invite["qr"]
    assert len(qr) >= 21 and all(len(row) == len(qr) and set(row) <= {"0", "1"} for row in qr)
    assert qr[0][:7] == "1111111" and qr[1][:7] == "1000001"  # top-left finder pattern

    page = client.get(f"/i/{invite['code']}")
    assert page.status_code == 200
    assert invite["code"] in page.text
    assert "Alice" not in page.text  # never names the inviter
    assert "default-src 'none'" in page.headers["content-security-policy"]
    # Same page for a well-formed code that does not exist: the page is not a validity oracle.
    assert client.get("/i/ZZZZ-9999").text == page.text.replace(invite["code"], "ZZZZ-9999")


@pytest.mark.parametrize("bad", ["x", "ABCD-12345", "<script>", "ABCD_2345", "ABCD-23 5"])
def test_invite_page_rejects_malformed_codes(client, bad):
    assert render_invite_page(bad) is None
    assert client.get(f"/i/{bad}").status_code == 404


def test_invite_code_normalization():
    assert normalize("abcd2345") == "ABCD-2345"
    assert normalize(" ABCD-2345 ") == "ABCD-2345"


# --------------------------------------------------------------------- helpers
def test_contact_details_are_stripped():
    strip = people_service.strip_contact_details
    assert strip("Call 010-1234-5678 or mail a.b+c@mail.example.org") == "Call or mail"
    assert strip("Worked together 2019 - 2021") == "Worked together 2019 - 2021"
    assert strip("www.example.com") is None


def test_stemmer_and_compaction():
    stem = relationship_service._stem
    assert {stem(w) for w in ("climbing", "climber", "climbers", "climbs", "climb")} == {"climb"}
    assert stem("running") == stem("runs") == "run"
    assert relationship_service.compact({"board", "games", "board games", "jazz"}) == ["board games", "jazz"]


def test_deleting_account_removes_imports_and_follow_ups(alice):
    from app.models import FollowUp, PeopleImport

    maya = add(alice, name="Maya")
    alice.ok("venn_add_follow_up", person_id=maya["person_id"], text="Her trip")
    alice.ok("venn_propose_people_import", people=[{"name": "Tom"}])
    alice.ok("venn_delete_account", confirmation="DELETE MY VENN ACCOUNT")
    with session_scope() as db:
        assert db.query(Person).count() == 0
        assert db.query(FollowUp).count() == 0
        assert db.query(PeopleImport).count() == 0
