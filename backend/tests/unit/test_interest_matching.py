from app.models import Memory, User
from app.models._base import utcnow
from app.services.interest_matching import match_interests, my_interest_labels


def test_exact_before_related_and_stable_across_input_orders():
    mine = [" Film  photography ", "POTTERY", "Street photography", "Python", " "]
    theirs = ["ceramics", "street Photography", "street Photography", "Photo walks", "python", ""]
    matches = match_interests(mine, theirs)
    assert [(m.my_label, m.their_label, m.kind) for m in matches] == [
        ("Python", "python", "exact"),
        ("Street photography", "street Photography", "exact"),
        ("POTTERY", "ceramics", "related"),
        ("Film photography", "Photo walks", "related"),
    ]
    assert match_interests(reversed(mine), reversed(theirs)) == matches


def test_only_curated_whole_labels_are_related():
    for mine, theirs in [("rock climbing", "bouldering"), ("coffee", "specialty coffee")]:
        assert match_interests([mine], [theirs])[0].kind == "related"
        assert match_interests([theirs], [mine])[0].kind == "related"
    assert match_interests(["cycling", "art", "running"], ["upcycling", "martial arts", "running a cafe"]) == []
    assert match_interests([], ["coffee"]) == []


def test_my_interest_labels_only_includes_own_explicit_interests(client, db):
    me, other = User(auth_subject="test|me"), User(auth_subject="test|other")
    db.add_all([me, other])
    db.flush()
    for owner, category, title, tags, people, source in [
        (me, "INTEREST", "Bouldering", ["bouldering", "climbing"], [], None),
        (me, "INTEREST", "Coffee", [], None, "chatgpt_memory"),
        (me, "INTEREST", "Jazz", ["music"], ["Mina"], None),
        (me, "INTEREST", "Walking", [], None, "sample"),
        (me, "EXPERIENCE", "Running", [], None, None),
        (other, "INTEREST", "Cycling", [], None, None),
    ]:
        db.add(
            Memory(
                user_id=owner.id,
                category=category,
                title=title,
                description="Photography",
                tags=tags,
                people=people,
                source=source,
                approved_at=utcnow(),
            )
        )
    db.flush()
    assert my_interest_labels(db, me) == ["Bouldering", "Coffee", "climbing"]
