"""Only allowlisted saved labels can ground a proactive related-interest suggestion."""

import pytest


def save_interest(site, label):
    site.ok("POST", "/memories", {"category": "INTEREST", "title": label, "description": "Private context"})


def test_related_interest_names_both_labels_and_exact_takes_priority(web):
    dana = web("dana")
    save_interest(dana, "Climbing")
    dana.ok("POST", "/people", {"name": "Ada", "interests": ["Bouldering"]})
    idea = dana.ok("GET", "/circle-idea")["idea"]
    assert idea["person"]["display_name"] == "Ada"
    assert idea["activity"] == "Go climbing"
    assert idea["reason"] == "Your saved interest in climbing is related to Ada's interest in bouldering."

    dana.ok("POST", "/people", {"name": "Zoe", "interests": ["Climbing"]})
    exact = dana.ok("GET", "/circle-idea")["idea"]
    assert exact["person"]["display_name"] == "Zoe"
    assert "both include climbing" in exact["reason"]


def test_saved_person_related_labels_ground_venn_and_activity(web, make_user):
    dana = web("dana")
    save_interest(dana, "Ceramics")
    pid = dana.ok("POST", "/people", {"name": "Ada", "interests": ["Pottery"]})["person_id"]
    client = make_user("dana")
    comparison = client.ok("venn_compare", person_id=pid)
    assert "Ceramics" in comparison["summary"] and "Pottery" in comparison["summary"]
    activity = client.ok("venn_suggest_activity", person_id=pid)
    assert "Pottery" not in activity["shared_interests"]
    assert any("Related interests" in line for line in activity["score_explanation"])
    assert activity["match_score"] > 0.2


@pytest.mark.parametrize("mine,theirs", [("Specialty coffee", "Coffee"), ("Coffee", "Specialty coffee")])
def test_unlisted_label_cannot_ground_related_suggestion(web, mine, theirs):
    # The general matcher relates this pair; proactive suggestions require both labels on the allowlist.
    dana = web("dana")
    save_interest(dana, mine)
    dana.ok("POST", "/people", {"name": "Ada", "interests": [theirs]})
    assert dana.ok("GET", "/circle-idea") == {"idea": None}
