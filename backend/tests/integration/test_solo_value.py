"""Features that are useful with one account: no friend has to sign up for any of these."""

import re
from datetime import timedelta

from app.db.database import session_scope
from app.models import PersonInteraction, QuestionLink, User
from app.models._base import utcnow

from .test_social_flow import connect, save


def remember(user, title, description, people=(), category="EXPERIENCE", tags=()):
    proposal = user.ok(
        "venn_propose_memories",
        suggested=[
            {
                "category": category,
                "title": title,
                "description": description,
                "people": list(people),
                "tags": list(tags),
            }
        ],
    )
    saved = user.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    return proposal, saved


def backdate(person_id: str, days: int) -> None:
    with session_scope() as db:
        for row in db.query(PersonInteraction).filter(PersonInteraction.person_id == person_id):
            row.created_at = utcnow() - timedelta(days=days)


# ------------------------------------------------------------------ memories about people
def test_memory_about_a_friend_adds_them_and_search_explains_why(alice):
    proposal, saved = remember(alice, "Photo walks with Maya", "Maya and I used to take photo walks.", ["Maya"])
    # The review card says, before anything is saved, that Maya will be added.
    assert proposal["proposals"][0]["people"] == ["Maya"]
    assert proposal["proposals"][0]["new_people"] == ["Maya"]
    assert [p["name"] for p in saved["people_added"]] == ["Maya"]
    assert saved["saved"][0]["people"] == ["Maya"]
    assert saved["saved"][0]["visibility"] == "PRIVATE"

    found = alice.ok("venn_find_people", query="photography")
    assert [r["display_name"] for r in found["results"]] == ["Maya"]
    assert found["results"][0]["why"] == "From your memory “Photo walks with Maya”."
    assert found["results"][0]["kind"] == "person"
    assert [m["title"] for m in found["memories"]] == ["Photo walks with Maya"]


def test_known_friend_is_not_added_twice(alice):
    alice.ok("venn_add_person", name="Maya Chen", relationship="college roommate")
    proposal, saved = remember(alice, "Photo walks with Maya", "We used to take photo walks.", ["Maya"])
    assert proposal["proposals"][0]["new_people"] == []
    assert saved["people_added"] == []
    assert alice.ok("venn_list_people")["count"] == 1
    found = alice.ok("venn_find_people", query="photo walk")
    assert found["results"][0]["display_name"] == "Maya Chen"
    assert "Photo walks with Maya" in found["results"][0]["why"]


def test_memory_without_people_adds_nobody(alice):
    proposal, saved = remember(alice, "Loves ramen", "I love ramen.", category="INTEREST")
    assert proposal["proposals"][0]["new_people"] == []
    assert saved["people_added"] == []
    assert saved["saved"][0]["people"] == []
    assert alice.ok("venn_list_people")["count"] == 0


def test_search_reasons_come_from_notes(alice):
    alice.ok("venn_add_person", name="Priya Nair", relationship="climbing gym", interests=["bouldering", "tea"])
    alice.ok("venn_add_person", name="Tom Becker", notes="Moved to Berlin, runs a board game night.")
    by_interest = alice.ok("venn_find_people", query="bouldering")["results"][0]
    assert by_interest["display_name"] == "Priya Nair"
    assert by_interest["why"] == "Your notes list “bouldering”."
    by_notes = alice.ok("venn_find_people", query="board games")["results"][0]
    assert by_notes["display_name"] == "Tom Becker"
    assert by_notes["why"].startswith("From your notes:")
    assert alice.ok("venn_find_people", query="sailing")["results"] == []


# ------------------------------------------------------------------------------ Venn card
def test_venn_card_for_a_person_note(alice):
    save(alice, "INTEREST", "Bouldering", "I boulder twice a week.", "PRIVATE", tags=["climbing"])
    save(alice, "INTEREST", "Ramen", "Always up for ramen.", "PRIVATE")
    person = alice.ok("venn_add_person", name="Priya Nair", interests=["bouldering", "tea"])
    venn = alice.ok("venn_compare", person_id=person["person_id"])
    assert venn["view"] == "venn"
    assert venn["kind"] == "person" and venn["id"] == person["person_id"]
    assert venn["on_venn"] is False
    assert "bouldering" in [s.lower() for s in venn["shared"]]
    assert "tea" in [s.lower() for s in venn["them_only"]]
    assert any("ramen" in s.lower() for s in venn["you_only"])
    assert "in common" in venn["summary"]
    assert venn["suggestions"], "an idea grounded in the overlap"


def test_venn_card_counts_memories_about_the_friend(alice):
    remember(alice, "Photo walks with Maya", "Maya and I used to take photo walks.", ["Maya"])
    maya = alice.ok("venn_list_people")["people"][0]
    venn = alice.ok("venn_compare", person_id=maya["person_id"])
    assert any("photo" in s.lower() for s in venn["shared"])


def test_venn_card_when_nothing_is_known(alice):
    person = alice.ok("venn_add_person", name="Sam")
    venn = alice.ok("venn_compare", person_id=person["person_id"])
    assert venn["shared"] == [] and venn["you_only"] == [] and venn["them_only"] == []
    assert venn["summary"] == "Nothing saved about you or Sam yet."


def test_venn_card_for_a_connection_uses_only_what_they_shared(alice, bob):
    connection_id = connect(alice, bob)
    save(alice, "INTEREST", "Bouldering", "I boulder.", "PRIVATE")
    save(bob, "INTEREST", "Bouldering", "Indoor mostly.", "SHARED_WITH_CONNECTIONS")
    save(bob, "INTEREST", "Stamp collecting", "Secret hobby.", "PRIVATE")
    venn = alice.ok("venn_compare", connection_id=connection_id)
    assert venn["on_venn"] is True
    assert "bouldering" in [s.lower() for s in venn["shared"]]
    assert "stamp" not in str(venn).lower()


def test_venn_card_needs_exactly_one_friend(alice):
    assert alice.err("venn_compare").startswith("INVALID_REQUEST")


# ------------------------------------------------------------------------------ this week
def test_this_week_with_nobody(alice):
    week = alice.ok("venn_this_week")
    assert week["view"] == "this_week"
    assert week["actions"] == []
    assert week["empty_reason"].startswith("Add a few people first")


def test_this_week_suggests_three_kinds_of_action(alice):
    save(alice, "INTEREST", "Bouldering", "I boulder.", "PRIVATE")
    maya = alice.ok("venn_add_person", name="Maya Chen", interests=["pottery"], last_met_days_ago=60)
    priya = alice.ok("venn_add_person", name="Priya Nair", interests=["bouldering"], last_met_days_ago=2)
    tom = alice.ok("venn_add_person", name="Tom Becker", last_met_days_ago=5)
    alice.ok("venn_add_follow_up", person_id=tom["person_id"], text="Ask how the move went")

    week = alice.ok("venn_this_week")
    actions = {a["type"]: a for a in week["actions"]}
    assert set(actions) == {"reach_out", "follow_up", "plan"}
    assert week["empty_reason"] is None

    reach = actions["reach_out"]
    assert reach["id"] == maya["person_id"]
    assert reach["draft_message"].startswith("Hi Maya")
    assert "60 days" in reach["reason"] or "days" in reach["reason"]

    follow = actions["follow_up"]
    assert follow["id"] == tom["person_id"]
    assert follow["follow_up"]["text"] == "Ask how the move went"
    assert follow["draft_message"] is None

    plan = actions["plan"]
    assert plan["id"] == priya["person_id"]
    assert plan["suggestion"]["title"]
    # Venn drafts; it never sends.
    assert "never sends" in week["note"] or "does not send" in week["note"]


def test_this_week_is_per_user(alice, bob):
    alice.ok("venn_add_person", name="Maya Chen", last_met_days_ago=60)
    assert bob.ok("venn_this_week")["actions"] == []


# ----------------------------------------------------------------------------- sample data
def test_sample_circle_loads_and_is_removed_without_touching_own_data(alice):
    mine = alice.ok("venn_add_person", name="Real Friend")
    loaded = alice.ok("venn_load_sample_circle")
    assert loaded == {"loaded": True, "connections": 3, "people": 5, "pending_requests": 1, "memories_added": 6}

    home = alice.ok("venn_show_dashboard")
    assert home["view"] == "dashboard"
    assert home["sample_loaded"] is True
    assert all(c["is_sample"] for c in home["connections"])
    assert sum(p["is_sample"] for p in home["people"]) == 5
    assert all(m["source"] == "sample" for m in home["memories"])
    assert home["pending_requests"][0]["is_sample"] is True
    # Sample data does not count as set-up: it is not the user's.
    steps = {s["key"]: s["done"] for s in home["setup"]}
    assert steps == {"about_you": False, "your_people": True, "connect": False}

    # Every card has something to show straight away.
    assert alice.ok("venn_this_week")["actions"]
    assert alice.ok("venn_start_quiz")["questions"]
    assert alice.ok("venn_find_people", query="pottery")["results"]
    jun = next(c for c in home["connections"] if c["display_name"] == "Jun Park")
    assert alice.ok("venn_compare", connection_id=jun["connection_id"])["shared"]

    # Loading twice does not double anything.
    alice.ok("venn_load_sample_circle")
    assert len(alice.ok("venn_show_dashboard")["connections"]) == 3

    removed = alice.ok("venn_remove_sample_circle")
    assert removed == {"removed": True, "friends": 4, "people": 5, "memories": 6}
    home = alice.ok("venn_show_dashboard")
    assert home["sample_loaded"] is False
    assert [p["person_id"] for p in home["people"]] == [mine["person_id"]]
    assert home["connections"] == [] and home["memories"] == []
    with session_scope() as db:
        assert db.query(User).filter(User.auth_subject.like("sample|%")).count() == 0


def test_sample_circle_keeps_existing_memories(alice):
    save(alice, "INTEREST", "Ramen", "Always up for ramen.", "PRIVATE")
    assert alice.ok("venn_load_sample_circle")["memories_added"] == 0
    assert alice.ok("venn_remove_sample_circle")["memories"] == 0
    assert alice.ok("venn_list_memories")["count"] == 1


def test_sample_friends_belong_to_one_account(alice, bob):
    alice.ok("venn_load_sample_circle")
    bob.ok("venn_load_sample_circle")
    alice.ok("venn_remove_sample_circle")
    assert len(bob.ok("venn_show_dashboard")["connections"]) == 3
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"


def test_welcome_card_says_whether_sample_is_loaded(alice):
    assert alice.ok("venn_show_dashboard")["sample_loaded"] is False


def test_deleting_the_account_removes_its_sample_friends(alice):
    alice.ok("venn_load_sample_circle")
    alice.ok("venn_delete_account", confirmation="DELETE MY VENN ACCOUNT")
    with session_scope() as db:
        assert db.query(User).count() == 0


# --------------------------------------------------------------------------------- quiz
def test_solo_quiz_from_own_notes(alice):
    alice.ok("venn_add_person", name="Maya Chen", relationship="college roommate", interests=["pottery"])
    alice.ok("venn_add_person", name="Tom Becker", relationship="former coworker", interests=["board games"])
    alice.ok("venn_add_person", name="Priya Nair", relationship="climbing gym", interests=["bouldering"])
    quiz = alice.ok("venn_start_quiz")
    assert quiz["view"] == "quiz" and quiz["mode"] == "circle"
    assert quiz["title"] == "How well do you remember your people?"
    assert len(quiz["questions"]) >= 3
    names = {"Maya Chen", "Tom Becker", "Priya Nair"}
    for q in quiz["questions"]:
        assert 2 <= len(q["options"]) <= 4
        assert q["options"][q["answer_index"]] in names
        assert set(q["options"]) <= names


def test_solo_quiz_needs_something_to_ask(alice):
    alice.ok("venn_add_person", name="Sam")
    assert "Not enough to quiz on yet" in alice.err("venn_start_quiz")


# -------------------------------------------------------------------------------- plans
def test_plan_is_saved_listed_done_and_deleted(alice):
    maya = alice.ok("venn_add_person", name="Maya Chen")
    tom = alice.ok("venn_add_person", name="Tom Becker")
    when = (utcnow() + timedelta(days=3)).isoformat()
    plan = alice.ok(
        "venn_save_plan",
        title="Photo walk",
        details="Along the river, then coffee.",
        planned_for=when,
        person_ids=[maya["person_id"], tom["person_id"]],
    )
    assert plan["status"] == "planned"
    assert [m["display_name"] for m in plan["members"]] == ["Maya Chen", "Tom Becker"]
    undated = alice.ok("venn_save_plan", title="Board game night")

    listed = alice.ok("venn_list_plans")
    assert [p["title"] for p in listed["plans"]] == ["Photo walk", "Board game night"]
    home = alice.ok("venn_show_dashboard")
    assert [p["title"] for p in home["plans"]] == ["Photo walk", "Board game night"]

    done = alice.ok("venn_complete_plan", plan_id=plan["plan_id"])
    assert done == {"done": True, "plan_id": plan["plan_id"], "logged": 2}
    # Doing the plan logs the hangout with each friend.
    friend = alice.ok("venn_view_friend", person_id=maya["person_id"])
    assert friend["recent_interactions"][0]["activity"] == "Photo walk"
    # Completing twice logs nothing more.
    assert alice.ok("venn_complete_plan", plan_id=plan["plan_id"])["logged"] == 0
    assert [p["title"] for p in alice.ok("venn_list_plans")["plans"]] == ["Board game night"]

    assert alice.ok("venn_delete_plan", plan_id=undated["plan_id"]) == {"deleted": True, "plan_id": undated["plan_id"]}
    assert alice.ok("venn_list_plans")["count"] == 0


def test_plan_limits(alice):
    assert alice.err("venn_save_plan", title="  ").startswith("INVALID_REQUEST")
    assert alice.err("venn_save_plan", title="My password is hunter2").startswith("PRIVACY_VIOLATION")
    people = [alice.ok("venn_add_person", name=f"Friend {i}")["person_id"] for i in range(7)]
    assert "at most 6" in alice.err("venn_save_plan", title="Big picnic", person_ids=people)


# ------------------------------------------------------------ answers from a friend, no account
def token_of(link: dict) -> str:
    return link["link"].rsplit("/q/", 1)[1]


def test_friend_answers_without_an_account(alice, client):
    maya = alice.ok("venn_add_person", name="Maya Chen", notes="College roommate.", interests=["pottery"])
    link = alice.ok("venn_create_question_link", person_id=maya["person_id"])
    assert link["view"] == "ask_link"
    assert link["for_name"] == "Maya Chen" and link["max_responses"] == 1
    assert link["link"].startswith("http://localhost:8081/q/")
    assert link["link"] in link["share_text"]
    assert len(link["questions"]) == 4
    assert len(link["qr"]) == len(link["qr"][0]) and set("".join(link["qr"])) <= {"0", "1"}
    token = token_of(link)

    page = client.get(f"/q/{token}")
    assert page.status_code == 200
    assert "Alice" in page.text and "What are you into these days?" in page.text
    assert "default-src 'none'" in page.headers["content-security-policy"]
    assert page.headers["cache-control"] == "no-store"

    # Consent is required.
    form = {"name": "Maya", "into": "film photography, tea", "together": "A day hike", "ask": "How the move went"}
    refused = client.post(f"/q/{token}", data=form)
    assert refused.status_code == 400 and "tick the box" in refused.text
    assert alice.ok("venn_review_answers")["responses"] == []

    sent = client.post(f"/q/{token}", data={**form, "consent": "yes"})
    assert sent.status_code == 200 and "Thanks" in sent.text
    # A link made for one person takes one set of answers.
    assert client.get(f"/q/{token}").status_code == 404
    assert client.post(f"/q/{token}", data={**form, "consent": "yes"}).status_code == 404

    # Nothing is in Alice's notes until she approves it.
    assert alice.ok("venn_view_friend", person_id=maya["person_id"])["interests"] == ["pottery"]
    assert alice.ok("venn_show_dashboard")["pending_answers"] == 1

    review = alice.ok("venn_review_answers")
    assert review["view"] == "answers"
    response = review["responses"][0]
    assert response["name"] == "Maya" and response["person_id"] == maya["person_id"]
    assert {i["key"]: i["answer"] for i in response["items"]} == {
        "into": "film photography, tea",
        "together": "A day hike",
        "ask": "How the move went",
    }

    saved = alice.ok("venn_save_answers", response_id=response["response_id"], keys=["into", "ask"])
    assert saved["saved"] is True
    assert saved["person"]["person_id"] == maya["person_id"]
    assert saved["added_interests"] == ["film photography", "tea"]
    assert saved["follow_up"]["text"] == "Ask about: How the move went"
    friend = alice.ok("venn_view_friend", person_id=maya["person_id"])
    assert friend["interests"] == ["pottery", "film photography", "tea"]
    assert "day hike" not in (friend["notes"] or "")  # the answer she did not pick is not saved
    assert [f["text"] for f in friend["follow_ups"]] == ["Ask about: How the move went"]

    assert alice.ok("venn_review_answers")["responses"] == []
    assert alice.err("venn_save_answers", response_id=response["response_id"], keys=["into"]).startswith("NOT_FOUND")
    assert alice.ok("venn_find_people", query="photography")["results"][0]["display_name"] == "Maya Chen"


def test_answers_from_someone_new_create_a_note_only_when_saved(alice, client):
    link = alice.ok("venn_create_question_link")
    assert link["for_name"] is None and link["max_responses"] == 10
    token = token_of(link)
    form = {"name": "Dohyun", "treat": "iced americano", "together": "night market", "consent": "yes"}
    assert client.post(f"/q/{token}", data=form).status_code == 200
    assert client.get(f"/q/{token}").status_code == 200  # an open link takes more answers
    assert alice.ok("venn_list_people")["count"] == 0

    response = alice.ok("venn_review_answers")["responses"][0]
    assert response["person_id"] is None
    saved = alice.ok("venn_save_answers", response_id=response["response_id"], keys=["treat", "together"])
    assert saved["person"]["name"] == "Dohyun"
    assert "Always says yes to: iced americano" in saved["person"]["notes"]
    assert "Would love to: night market" in saved["person"]["notes"]
    assert saved["follow_up"] is None


def test_answers_can_be_discarded_and_links_revoked(alice, client):
    link = alice.ok("venn_create_question_link", name="Hana")
    token = token_of(link)
    client.post(f"/q/{token}", data={"name": "Hana", "into": "jazz", "consent": "yes"})
    response = alice.ok("venn_review_answers")["responses"][0]
    assert alice.ok("venn_discard_answers", response_id=response["response_id"])["discarded"] is True
    assert alice.ok("venn_review_answers")["responses"] == []
    assert alice.ok("venn_list_people")["count"] == 0

    other = alice.ok("venn_create_question_link")
    assert alice.ok("venn_revoke_question_link", link_id=other["link_id"]) == {
        "revoked": True,
        "link_id": other["link_id"],
    }
    assert client.get(f"/q/{token_of(other)}").status_code == 404


def test_answer_page_rejects_junk(alice, client):
    token = token_of(alice.ok("venn_create_question_link"))
    # No name, or nothing answered: the form comes back with what was typed.
    no_name = client.post(f"/q/{token}", data={"into": "jazz", "consent": "yes"})
    assert no_name.status_code == 400 and "add your name" in no_name.text and 'value="jazz"' in no_name.text
    empty = client.post(f"/q/{token}", data={"name": "Hana", "consent": "yes"})
    assert empty.status_code == 400 and "at least one question" in empty.text
    # A filled-in honeypot is thanked and ignored.
    bot = client.post(f"/q/{token}", data={"name": "Bot", "into": "spam", "consent": "yes", "website": "http://x"})
    assert bot.status_code == 200
    # Sensitive answers and contact details are dropped.
    client.post(
        f"/q/{token}",
        data={
            "name": "Hana",
            "into": "jazz",
            "ask": "my password is hunter2",
            "treat": "tea hana@example.com",
            "consent": "yes",
        },
    )
    items = {i["key"]: i["answer"] for i in alice.ok("venn_review_answers")["responses"][0]["items"]}
    assert items["into"] == "jazz"
    assert "ask" not in items
    assert "example.com" not in items.get("treat", "")
    # Oversized posts are refused.
    assert client.post(f"/q/{token}", data={"name": "x" * 20000, "consent": "yes"}).status_code == 413
    for bad in ("nope", "a" * 30, "../../etc/passwd"):
        assert client.get(f"/q/{bad}").status_code == 404


def test_expired_link_is_unavailable(alice, client):
    link = alice.ok("venn_create_question_link")
    with session_scope() as db:
        db.query(QuestionLink).one().expires_at = utcnow() - timedelta(minutes=1)
    page = client.get(f"/q/{token_of(link)}")
    assert page.status_code == 404 and "isn't available" in page.text
    assert not re.search("Alice", page.text)


# ----------------------------------------------------- names the assistant did not spell out
def test_person_is_picked_up_from_the_users_own_words(alice):
    # ChatGPT passed the sentence as `text` and named nobody.
    proposal = alice.ok("venn_propose_memories", text="Maya and I used to take photo walks.")
    item = proposal["proposals"][0]
    assert item["title"] == "Take photo walks with Maya"
    assert item["category"] == "EXPERIENCE"
    assert item["people"] == ["Maya"] and item["new_people"] == ["Maya"]
    alice.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    found = alice.ok("venn_find_people", query="photography")
    assert found["results"][0]["display_name"] == "Maya"
    assert found["results"][0]["why"] == "From your memory “Take photo walks with Maya”."


def test_person_is_picked_up_when_the_assistant_left_people_out(alice):
    proposal = alice.ok(
        "venn_propose_memories",
        suggested=[
            {"category": "EXPERIENCE", "title": "Photo walks", "description": "Maya and I used to take photo walks."},
            {"category": "INTEREST", "title": "Ramen", "description": "I love ramen with extra egg."},
            {"category": "EXPERIENCE", "title": "Lisbon", "description": "We went to Lisbon in May and I loved it."},
        ],
    )
    assert [p["people"] for p in proposal["proposals"]] == [["Maya"], [], []]


def test_names_are_only_taken_from_phrases_about_people():
    from app.ai.extraction import mentioned_people

    assert mentioned_people("Maya and I used to take photo walks") == ["Maya"]
    assert mentioned_people("Me and Tom play chess; my old roommate Priya joins sometimes") == ["Tom", "Priya"]
    assert mentioned_people("I watched Dune with Netflix and I liked Seoul in May") == []
    assert mentioned_people("She and I went hiking. Then and I") == []
    assert mentioned_people("") == []
