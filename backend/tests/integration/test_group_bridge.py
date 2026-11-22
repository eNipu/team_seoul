"""Group suggestions through the same read-only tool that serves the widget."""

from tests.integration.test_people_flow import add
from tests.integration.test_social_flow import connect, save


def test_bridges_selected_friends_without_claiming_a_group_overlap(alice, bob):
    conn = connect(alice, bob)
    save(bob, "INTEREST", "Photography", "Takes portraits", "SHARED_WITH_CONNECTIONS")
    save(alice, "INTEREST", "Hiking", "Likes trails", "PRIVATE")
    maya = add(alice, name="Maya", interests=["Hiking"])
    view = alice.ok("venn_plan_group", connection_ids=[conn], person_ids=[maya["person_id"]])
    assert view["common_to_all"] == []
    assert view["common_to_some"] == [{"interest": "hiking", "members": ["You", "Maya"]}]
    (idea,) = view["suggestions"]
    assert idea["title"] == "Trail photo walk"
    assert idea["grounded_in"] == ["Bob: Photography", "Maya: Hiking"]
    assert "Pick a short trail" in idea["description"]
    assert "Propose a time yourself" in idea["suggested_action"]


def test_photography_followup_beats_shared_board_games(alice):
    save(alice, "INTEREST", "Board games", "Plays chess", "PRIVATE")
    maya = add(alice, name="Maya", interests=["Board games", "Photography"])
    tom = add(alice, name="Tom", interests=["Board games", "Architecture"])
    ids = [maya["person_id"], tom["person_id"]]
    usual = alice.ok("venn_plan_group", person_ids=ids)
    assert usual["suggestions"][0]["title"] == "Game night"
    assert alice.ok("venn_plan_group", person_ids=ids, activity_topic="sailing") == usual
    view = alice.ok("venn_plan_group", person_ids=ids, activity_topic="photography")
    assert view["suggestions"][0]["title"] == "Neighborhood photo walk"
    assert view["suggestions"][0]["grounded_in"] == ["Maya: Photography", "Tom: Architecture"]


def test_film_photography_focus_with_and_without_trail(alice):
    maya = add(alice, name="Maya", interests=["Film photography"])
    for interest, expected in [("Hiking", "Trail photo walk"), ("Origami", "Photo walk")]:
        other = add(alice, name=interest, interests=[interest])
        view = alice.ok(
            "venn_plan_group", person_ids=[other["person_id"], maya["person_id"]], activity_topic="photography"
        )
        assert view["suggestions"][0]["title"] == expected
        assert "Maya: Film photography" in view["suggestions"][0]["grounded_in"]


def test_unmapped_interests_can_bridge_with_the_acting_user(alice):
    save(alice, "INTEREST", "Origami", "Paper folding", "PRIVATE")
    maya = add(alice, name="Maya", interests=["Calligraphy"])
    tom = add(alice, name="Tom")
    view = alice.ok("venn_plan_group", person_ids=[maya["person_id"], tom["person_id"]])
    (idea,) = view["suggestions"]
    assert idea["grounded_in"] == ["Maya: Calligraphy", "You: Origami"]
    assert "Calligraphy or Origami" in idea["description"]


def test_no_bridge_from_one_person_or_private_connection_data(alice, bob):
    conn = connect(alice, bob)
    save(bob, "INTEREST", "Photography", "Takes portraits", "PRIVATE")
    maya = add(alice, name="Maya", interests=["Hiking", "Board games"])
    view = alice.ok("venn_plan_group", connection_ids=[conn], person_ids=[maya["person_id"]])
    assert [s["title"] for s in view["suggestions"]] == ["Potluck dinner", "Picnic in the park", "Board game night"]
    assert all(not s["grounded_in"] for s in view["suggestions"])
