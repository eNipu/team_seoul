"""Proactive ideas require independent, scoped evidence for everyone suggested."""


def interest(site, category="INTEREST", visibility="PRIVATE"):
    return site.ok(
        "POST",
        "/memories",
        {"title": "Board games", "description": "Private anecdote", "category": category, "visibility": visibility},
    )


def test_circle_idea_requires_positive_interest_and_grounded_group(web):
    path = "/circle-idea"
    assert web().err("GET", path) == (401, "UNAUTHENTICATED")
    dana = web("dana")
    ada = dana.ok("POST", "/people", {"name": "Ada", "interests": ["Board games"], "notes": "Private anecdote"})
    dana.ok("POST", "/people", {"name": "Ben", "interests": ["Photography"]})
    web("other").ok("POST", "/people", {"name": "Aaron", "interests": ["Board games"]})
    interest(dana, category="DISLIKE")
    assert dana.ok("GET", path) == {"idea": None}
    interest(dana)
    idea = dana.ok("GET", path)["idea"]
    assert set(idea) == {"topic", "person", "activity", "draft", "reason", "group"}
    assert idea["topic"] == "board games" and idea["activity"] == "Game night"
    assert idea["person"] == {"kind": "person", "id": ada["person_id"], "display_name": "Ada"}
    assert idea["group"] is None
    zoe = dana.ok("POST", "/people", {"name": "Zoe", "interests": ["Board games"]})
    result = dana.ok("GET", path)
    assert result == dana.ok("GET", path)
    group = result["idea"]["group"]
    assert set(group) == {"person", "activity", "draft", "reason"}
    assert group["person"] == {"kind": "person", "id": zoe["person_id"], "display_name": "Zoe"}
    assert "board games" in group["reason"] and "Private anecdote" not in str(result)


def test_no_suggestion_from_a_word_inside_an_unrelated_label(web):
    dana = web("dana")
    interest(dana)
    dana.ok("POST", "/people", {"name": "Ada", "interests": ["Board governance"]})
    assert dana.ok("GET", "/circle-idea") == {"idea": None}


def test_complementary_interest_for_group(web):
    dana = web("dana")
    dana.ok("POST", "/memories", {"title": "Photography", "description": "Film", "category": "INTEREST"})
    dana.ok("POST", "/people", {"name": "Jun", "interests": ["Film photography"]})
    dana.ok("POST", "/people", {"name": "Kai", "interests": ["Architecture"]})
    idea = dana.ok("GET", "/circle-idea")["idea"]
    assert idea["person"]["display_name"] == "Jun"
    assert idea["group"]["person"]["display_name"] == "Kai"
    assert idea["group"]["activity"] == "Neighborhood photo walk"


def test_circle_idea_respects_visibility_and_blocks(web, make_user):
    dana, bob = web("dana"), web("bob", name="Bob")
    code = dana.ok("POST", "/invites", {"max_uses": 1})["code"]
    cid = bob.ok("POST", "/invites/redeem", {"code": code})["connection_id"]
    interest(dana)
    private = interest(bob)["memory"]["memory_id"]
    assert dana.ok("GET", "/circle-idea") == {"idea": None}
    bob.ok("PATCH", f"/memories/{private}", {"visibility": "SHARED_WITH_CONNECTIONS"})
    idea = dana.ok("GET", "/circle-idea")["idea"]
    assert idea["person"] == {"kind": "connection", "id": cid, "display_name": "Bob"}
    make_user("bob").ok("venn_block_user", connection_id=cid)
    assert dana.ok("GET", "/circle-idea") == {"idea": None}
