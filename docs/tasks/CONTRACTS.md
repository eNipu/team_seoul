# Shapes shared by backend and widget

Written once here. Backend schemas and `widget/src/types.ts` must both match. Change a shape
here first, in the same commit as the code.

## Guided plugin setup (T55)

`venn_show_dashboard` (including welcome) and `venn_help` return `onboarding: {memories_ready: boolean, contacts_ready: boolean, matches_reviewed: boolean}`. Use the first false flag for the next step. The web checklist remains separate.

After the first two steps, `venn_find_interest_matches({limit?: number})` returns a card:

```json
{
  "view": "interest_matches",
  "matches": [{"kind": "person", "id": "…", "display_name": "Nadia", "interest_matches": [{"my_label": "Pottery", "their_label": "Ceramics", "kind": "related"}]}]
}
```

`kind` on a row is `person` or `connection`; on an evidence pair it is `exact` or `related`. `matches: []` is a successful search. Unsatisfied prerequisites return a tool error, not an empty search result.

## Interests

Result of `venn_show_interests` (T02). `friends` is empty until T03; `keep_alive` is `null`
and `due` is `false` until T05.

```json
{
  "view": "interests",
  "clusters": [
    {
      "key": "climbing",
      "label": "Climbing",
      "memory_count": 3,
      "memories": [{ "memory_id": "…", "title": "Loves bouldering", "category": "INTEREST" }],
      "friends": [
        {
          "kind": "connection",
          "id": "…",
          "display_name": "Mina",
          "days_since_last_interaction": 240,
          "due": true,
          "keep_alive": "Go climbing together"
        }
      ]
    }
  ],
  "unclustered_count": 2,
  "note": ""
}
```

Limits: 12 clusters, 5 memories and 8 friends shown per cluster. `kind` is `"connection"` or
`"person"`, as everywhere else. Clusters are ordered by `memory_count`, then `label`.

## Needs and offers

- Memory categories gain `LOOKING_FOR` and `OFFERING` (T08). Labels: "Looking for", "Offering".
- `Person` gains `looking_for: string[]` and `offering: string[]` (T09): up to 6 items of up to
  120 characters each.
- `Person` gains `cadence_days: number | null` (T06): 7 to 365, `null` means the default (21).

## Opportunities

Result of `venn_show_opportunities` (T11). `FriendView` gains the same `opportunities` array,
limited to that friend.

```json
{
  "view": "opportunities",
  "opportunities": [
    {
      "kind": "person",
      "id": "…",
      "display_name": "Sam Okafor",
      "direction": "you_can_help_them",
      "yours": "Offering: B2B sales advice",
      "theirs": "Looking for: an advisor who knows retail sales",
      "matched_on": ["sales"],
      "days_since_last_interaction": 730
    }
  ],
  "note": ""
}
```

`direction` is `"they_can_help_you"` (your need, their offer) or `"you_can_help_them"` (your
offer, their need). At most 20 items, strongest match first.
