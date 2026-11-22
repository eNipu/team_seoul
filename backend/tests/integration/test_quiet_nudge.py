from .test_solo_value import remember


def test_quiet_nudge_uses_a_saved_memory_tag_not_unrelated_details(alice):
    remember(alice, "Maya's class", "We made bowls.", ["Maya"], tags=["pottery"])
    match = alice.ok("venn_find_nudge", topic="pottery")["match"]
    assert (match["display_name"], match["source"], match["evidence"]) == ("Maya", "own_memory", "pottery")
    assert "bowls" not in str(match)


def test_one_grounded_match_without_a_card(alice):
    maya = alice.ok("venn_add_person", name="Maya", interests=["Photo walk"])
    alice.ok("venn_add_person", name="Tom", interests=["Photo walk"])
    assert alice.ok("venn_find_nudge", topic="photo walk") == {
        "match": {
            "kind": "person",
            "id": maya["person_id"],
            "display_name": "Maya",
            "source": "interest",
            "evidence": "Photo walk",
            "reason": "Your saved interests for this person list “Photo walk”.",
        }
    }


def test_weak_absent_and_sensitive_topics_stay_quiet(alice):
    alice.ok("venn_add_person", name="Jazz", interests=["Weekend", "Fun", "Photo walks", "Pottery"])
    for topic in ("weekend", "fun", "jazz", "photo", "sailing", "pottery after therapy", "pottery password"):
        result = alice.call("venn_find_nudge", topic=topic)
        assert result["structuredContent"] == {"match": None}
        assert result["content"][0]["text"] == "No nudge."
    assert alice.ok("venn_find_people", query="photo")["results"]
