"""Plan ideas from the tiny, explicitly shareable discovery vocabulary only."""

# (title, activity, icebreaker). No venues, opening hours or availability are inferred.
PLANS = {
    "photography": (
        "One block, two frames",
        "Take a 30-minute photo walk",
        "Find two different pictures in the same scene.",
    ),
    "architecture": (
        "Read the street",
        "Walk a block comparing old and new facades",
        "Choose the building detail you’d steal for your dream house.",
    ),
    "art": (
        "A color hunt for two",
        "Take a short walk looking for public art",
        "Pick a color for each other to find in the next five minutes.",
    ),
    "books": (
        "Judge a book by its first line",
        "Browse a neighborhood bookshop",
        "Find two opening lines and guess which story goes with each.",
    ),
    "coffee": (
        "Two cups, two tasting notes",
        "Try a café together",
        "Each write down one tasting note before comparing answers.",
    ),
    "walking": (
        "A walk with one rule",
        "Explore a public walking path for 20 minutes",
        "Each point out something the other would have walked past.",
    ),
}

# A second tag can shape the experience, but can never substitute for a real shared tag.
BRIDGES = {
    ("photography", "architecture"): (
        "One roll, one neighborhood",
        "Take a 45-minute architectural photo walk",
        "Each photograph one doorway the other would have walked past.",
    ),
    ("coffee", "books"): (
        "Coffee and first lines",
        "Trade book recommendations over a coffee",
        "Pitch a favorite book in one sentence without naming it.",
    ),
    ("walking", "art"): (
        "A gallery without walls",
        "Look for murals and signs on a short public walk",
        "Pick one street detail you’d frame as a print.",
    ),
}


def plan_for(shared: str, mine: list[str], theirs: list[str], area: str) -> tuple[str, str, str]:
    plan = PLANS[shared]
    why = f"You both picked {shared}."
    for pair, bridge in BRIDGES.items():
        if shared not in pair:
            continue
        extra = pair[1] if pair[0] == shared else pair[0]
        if extra in mine or extra in theirs:
            plan = bridge
            who = "You both" if extra in mine and extra in theirs else "You" if extra in mine else "They"
            why += f" {who} also picked {extra}."
            break
    title, activity, challenge = plan
    return title, f"{activity} in {area.title()}. {why}", challenge
