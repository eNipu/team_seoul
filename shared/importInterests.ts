import vocabulary from "../backend/app/services/interest_families.json";

const families = new Map(Object.entries(vocabulary.families).flatMap(([group, labels]) => labels.map(label => [label, group] as const)));
const relatedTopics = new Map<string, Set<string>>();
function linkTopic(from: string, to: string) {
  const topics = relatedTopics.get(from) ?? new Set<string>();
  topics.add(to);
  relatedTopics.set(from, topics);
}
for (const [broad, specifics] of Object.entries(vocabulary.broader_topics)) {
  for (const specific of specifics) {
    linkTopic(broad, specific);
    linkTopic(specific, broad);
  }
}
const key = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

export const interestFamily = (label: string) => families.get(key(label)) ?? key(label);

type Signals = {shared_interests?: string[]; related_interests?: string[]};
/** Keep the original review indexes: sorting must never change who is confirmed. */
export function strongestFirst<T extends Signals>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.shared_interests?.length ?? 0) - (a.shared_interests?.length ?? 0)
    || (b.related_interests?.length ?? 0) - (a.related_interests?.length ?? 0));
}

/** Read only server-attributed pairs. Don't infer interests from names, bios, or prose. */
export function relatedLabels(matches: unknown): string[] {
  if (!Array.isArray(matches)) return [];
  return matches.flatMap(m => m?.kind === "related" && typeof m.my_label === "string" && typeof m.their_label === "string"
    ? [`${m.my_label} → ${m.their_label}`] : []);
}

/** Offline counterpart to the backend import review. Exact matches always take precedence. */
export function previewInterests(mine: string[], theirs: string[]) {
  const labels = (values: string[]) => {
    const out = new Map<string, string>();
    for (const label of values.map(v => v.trim().replace(/\s+/g, " ")).sort()) {
      if (label && !out.has(key(label))) out.set(key(label), label);
    }
    return out;
  };
  const own = labels(mine);
  const byFamily = new Map<string, string>();
  const byRelatedTopic = new Map<string, string>();
  for (const k of [...own.keys()].sort()) {
    const label = own.get(k)!;
    const family = interestFamily(k);
    if (!byFamily.has(family)) byFamily.set(family, label);
    for (const related of relatedTopics.get(family) ?? []) {
      if (!byRelatedTopic.has(related)) byRelatedTopic.set(related, label);
    }
  }
  const shared_interests: string[] = [];
  const interest_matches: {kind: "exact" | "related"; my_label: string; their_label: string}[] = [];
  const other = labels(theirs);
  for (const k of [...other.keys()].sort()) {
    const label = other.get(k)!;
    if (own.has(k)) {
      shared_interests.push(label);
      interest_matches.push({ kind: "exact", my_label: own.get(k)!, their_label: label });
    } else {
      const family = interestFamily(k);
      const match = byFamily.get(family) ?? byRelatedTopic.get(family);
      if (match) interest_matches.push({ kind: "related", my_label: match, their_label: label });
    }
  }
  interest_matches.sort((a, b) => Number(a.kind === "related") - Number(b.kind === "related"));
  return { shared_interests, related_interests: relatedLabels(interest_matches), interest_matches };
}
