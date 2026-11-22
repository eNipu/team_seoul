"""Conservative topic vocabulary for unsolicited suggestions (not general circle search)."""

TOPICS = frozenset(
    {
        "architecture",
        "badminton",
        "baking",
        "birding",
        "board games",
        "book club",
        "bouldering",
        "camping",
        "ceramics",
        "chess",
        "climbing",
        "coffee",
        "cooking",
        "cycling",
        "dance",
        "design",
        "fishing",
        "football",
        "gardening",
        "hiking",
        "jazz",
        "karaoke",
        "knitting",
        "music",
        "opera",
        "painting",
        "photography",
        "pottery",
        "ramen",
        "reading",
        "running",
        "sailing",
        "skiing",
        "soccer",
        "swimming",
        "tennis",
        "theater",
        "travel",
        "volleyball",
        "walking",
        "yoga",
    }
)
_ALIASES = {
    "film photography": "photography",
    "street photography": "photography",
    "photo walk": "photography",
    "photo walks": "photography",
    "landscape photography": "photography",
    "rock climbing": "climbing",
    "live jazz": "jazz",
    "tabletop games": "board games",
    "trail running": "running",
}


def activity_topic(label: str) -> str | None:
    """An entire, known label only: never infer a hobby from a word inside private prose."""
    key = " ".join(label.casefold().split())
    return _ALIASES.get(key, key if key in TOPICS else None)
