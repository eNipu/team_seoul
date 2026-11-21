"""Friendship quizzes: a small game that ends in something to do together.

- Friend quiz ("How well do you know Jun?"): built only from memories the friend chose to share
  with connections. PRIVATE memories are never read.
- Circle quiz ("Who's who in your circle?"): built from what connections shared and from the
  user's own notes about people who are not on Heldly.
- Wrong options come from the user's own memories, what their other friends shared with them,
  and a generic pool; an option is never something the quizzed friend also shared.
- Answers are checked in the widget. Nothing about a quiz is stored and nobody is notified.
"""

from __future__ import annotations

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Memory, User
from app.schemas.social import QuizNext, QuizQuestion, QuizView
from app.services import analytics
from app.services import relationship_service as rel
from app.services.errors import InvalidRequest

MAX_FRIEND_QUESTIONS = 5
MAX_CIRCLE_QUESTIONS = 6
MIN_QUESTIONS = 3
_EXPLANATION_LEN = 160

# category -> (question, generic wrong answers)
_FRIEND_QUESTIONS: dict[str, tuple[str, list[str]]] = {
    "INTEREST": (
        "Which of these is {name} into?",
        [
            "Rock climbing",
            "Baking sourdough",
            "Jazz records",
            "Trail running",
            "Film photography",
            "Chess",
            "Karaoke",
            "Pottery",
            "Birdwatching",
            "Surfing",
            "Board games",
            "Sci-fi novels",
            "Salsa dancing",
            "Camping",
        ],
    ),
    "DISLIKE": (
        "Which of these is {name} not a fan of?",
        [
            "Crowded malls",
            "Early mornings",
            "Horror movies",
            "Long group chats",
            "Spicy food",
            "Small talk",
            "Rainy hikes",
            "Loud bars",
        ],
    ),
    "EXPERIENCE": (
        "Which of these has {name} actually done?",
        [
            "Ran a marathon",
            "Lived abroad for a year",
            "Went skydiving",
            "Hiked a volcano",
            "Took a pottery class",
            "Did a silent retreat",
            "Sang at an open mic",
            "Drove across the country",
        ],
    ),
    "PREFERENCE": (
        "Which of these sounds like {name}?",
        [
            "Prefers texting over calls",
            "Prefers small groups",
            "Is a morning person",
            "Likes plans made well ahead",
            "Prefers quiet cafés",
            "Likes spontaneous plans",
            "Would rather walk than sit",
        ],
    ),
}
# How many questions of each kind a friend quiz may contain, in priority order.
_FRIEND_MIX = [("INTEREST", 3), ("DISLIKE", 1), ("EXPERIENCE", 1), ("PREFERENCE", 1)]


def _memory_terms(memory: Memory) -> set[str]:
    return rel.terms_of(memory.title, *(memory.tags or []))


def _explain(name: str, memory: Memory) -> str:
    text = f"{name} shared “{memory.title}”"
    detail = " ".join((memory.description or "").split())
    if detail and detail.lower() != memory.title.lower():
        text += f": {detail}"
    return text if len(text) <= _EXPLANATION_LEN else text[: _EXPLANATION_LEN - 1].rstrip() + "…"


def _question(prompt: str, correct: str, wrong: list[str], explanation: str, rng: random.Random) -> QuizQuestion:
    options = [correct, *wrong]
    rng.shuffle(options)
    return QuizQuestion(prompt=prompt, options=options, answer_index=options.index(correct), explanation=explanation)


def _distinct(labels: list[str], taken: set[str]) -> list[str]:
    """Labels that are not already used, compared case-insensitively. Mutates `taken`."""
    out: list[str] = []
    for label in labels:
        key = label.strip().lower()
        if key and key not in taken:
            taken.add(key)
            out.append(label)
    return out


def _wrong_answers(correct: str, pools: list[list[str]], used: set[str], count: int = 3) -> list[str]:
    """Up to `count` wrong options that don't look like the answer or like each other.

    Options not yet used in this quiz come first, so a small pool isn't repeated every question.
    """
    candidates = [label for pool in pools for label in pool]
    ordered = [c for c in candidates if c.lower() not in used] + [c for c in candidates if c.lower() in used]
    picked: list[str] = []
    picked_terms = rel.terms_of(correct)
    for label in _distinct(ordered, {correct.lower()}):
        terms = rel.terms_of(label)
        if terms & picked_terms:
            continue
        picked.append(label)
        picked_terms |= terms
        if len(picked) == count:
            break
    used.update(label.lower() for label in picked)
    return picked


def _friend_quiz(db: Session, user: User, connection_id: str, rng: random.Random) -> QuizView:
    friend = rel.resolve(db, user, connection_id, None)
    name = friend.display_name
    friend_terms: set[str] = set()
    for memory in friend.memories:
        friend_terms |= _memory_terms(memory)

    # Wrong answers in the same voice as real ones: mine, and what my other friends shared with me.
    borrowed: dict[str, list[str]] = {}
    mine = db.scalars(select(Memory).where(Memory.user_id == user.id)).all()
    others = [m for f in rel.all_friends(db, user) if f.id != friend.id for m in f.memories]
    for memory in [*mine, *others]:
        if not (_memory_terms(memory) & friend_terms):
            borrowed.setdefault(memory.category, []).append(memory.title)

    my_terms = rel.my_terms(db, user)
    questions: list[QuizQuestion] = []
    used_titles: set[str] = set()
    used_wrong: set[str] = set()
    true_false_done = False
    for category, limit in _FRIEND_MIX:
        prompt, generic = _FRIEND_QUESTIONS[category]
        candidates = [m for m in friend.memories if m.category == category]
        rng.shuffle(candidates)
        for memory in candidates[:limit]:
            if len(questions) >= MAX_FRIEND_QUESTIONS or memory.title.lower() in used_titles:
                continue
            used_titles.add(memory.title.lower())
            if category == "INTEREST" and not true_false_done and len(candidates) > 1:
                # One question about the two of you rather than about the friend alone.
                true_false_done = True
                both = bool(_memory_terms(memory) & my_terms)
                verdict = "You're both into it." if both else "That one's theirs — not on your list (yet)."
                questions.append(
                    QuizQuestion(
                        prompt=f"True or false: you and {name} are both into “{memory.title}”.",
                        options=["True", "False"],
                        answer_index=0 if both else 1,
                        explanation=f"{verdict} {_explain(name, memory)}"[:_EXPLANATION_LEN],
                    )
                )
                continue
            pool_borrowed = list(borrowed.get(category, []))
            pool_generic = [g for g in generic if not (rel.terms_of(g) & friend_terms)]
            rng.shuffle(pool_borrowed)
            rng.shuffle(pool_generic)
            wrong = _wrong_answers(memory.title, [pool_borrowed[:2], pool_generic], used_wrong)
            if len(wrong) < 2:
                continue
            questions.append(_question(prompt.format(name=name), memory.title, wrong, _explain(name, memory), rng))

    if len(questions) < MIN_QUESTIONS:
        raise InvalidRequest(
            f"{name} hasn't shared enough with connections for a quiz yet. "
            "A quiz needs a few shared interests, experiences or preferences."
        )
    rng.shuffle(questions)
    shared = rel.shared_terms(my_terms, friend)
    ideas = rel.ideas_for(shared, friend)
    title, description, _ = ideas[0]
    analytics.track(db, "quiz_started", user.id, count=len(questions), category="friend")
    return QuizView(
        mode="friend",
        kind="connection",
        id=friend.id,
        display_name=name,
        title=f"How well do you know {name}?",
        questions=questions,
        common_ground=shared,
        next=QuizNext(title=title, description=description),
    )


def _circle_quiz(db: Session, user: User, rng: random.Random) -> QuizView:
    friends = rel.all_friends(db, user)
    # (friend, interest label, comparison terms, explanation)
    facts: list[tuple[rel.Friend, str, set[str], str]] = []
    for friend in friends:
        if friend.kind == "connection":
            for memory in friend.memories:
                if memory.category == "INTEREST":
                    facts.append((friend, memory.title, _memory_terms(memory), _explain(friend.display_name, memory)))
        else:
            for label in friend.interest_labels:
                facts.append((friend, label, rel.terms_of(label), f"From your notes on {friend.display_name}."))
    rng.shuffle(facts)

    questions: list[QuizQuestion] = []
    per_friend: dict[str, int] = {}
    asked: set[str] = set()
    for friend, label, terms, explanation in facts:
        if len(questions) >= MAX_CIRCLE_QUESTIONS:
            break
        if per_friend.get(friend.id, 0) >= 2 or label.lower() in asked or not terms:
            continue
        # Only friends who clearly don't share this interest can be wrong answers.
        others = [f for f in friends if f.id != friend.id and not (f.terms & terms)]
        rng.shuffle(others)
        wrong = _distinct([f.display_name for f in others], {friend.display_name.lower()})[:3]
        if not wrong:
            continue
        asked.add(label.lower())
        per_friend[friend.id] = per_friend.get(friend.id, 0) + 1
        questions.append(_question(f"Who's into “{label}”?", friend.display_name, wrong, explanation, rng))

    if len(questions) < MIN_QUESTIONS:
        raise InvalidRequest(
            "Not enough to quiz on yet. Add interests for a few friends, or connect with friends who share theirs."
        )
    analytics.track(db, "quiz_started", user.id, count=len(questions), category="circle")
    return QuizView(
        mode="circle",
        kind=None,
        id=None,
        display_name=None,
        title="Who's who in your circle?",
        questions=questions,
        common_ground=[],
        next=None,
    )


def start_quiz(db: Session, user: User, connection_id: str | None = None, rng: random.Random | None = None) -> QuizView:
    rng = rng or random.Random()  # noqa: S311 - shuffling quiz questions, not security
    if connection_id:
        return _friend_quiz(db, user, connection_id, rng)
    return _circle_quiz(db, user, rng)
