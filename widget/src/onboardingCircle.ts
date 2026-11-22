// Who the user wants to be closer to, picked on step 01 and remembered for the invite step.
export type Circle = "partner" | "friends" | "old_friends" | "family";

export const CIRCLES: { value: Circle; label: string; invite: string }[] = [
  { value: "partner", label: "My partner", invite: "Invite your partner" },
  { value: "friends", label: "Close friends", invite: "Invite your best friend" },
  { value: "old_friends", label: "Old friends I miss", invite: "Invite an old friend" },
  { value: "family", label: "Family", invite: "Invite someone in your family" },
];

// What Venn would surface for that circle, shown as the demo under Connect.
export const DEMO: Record<Circle, { ask: string; person: string; answer: string }> = {
  partner: { ask: "Plan something for Saturday", person: "Sam", answer: "Sam has been wanting to try that pottery class. You're both free after 2." },
  friends: { ask: "Any plans this weekend?", person: "Emma", answer: "Emma from uni is in Berlin on Saturday. You haven't seen her in 2 years." },
  old_friends: { ask: "Who should I catch up with?", person: "Nate", answer: "Nate just moved back to your city. You last talked in 2023." },
  family: { ask: "What should I get Mom?", person: "Mom", answer: "Your mom said she misses gardening. A small herb kit would land." },
};

const KEY = "venn.circle";
export function saveCircle(c: Circle) { try { sessionStorage.setItem(KEY, c); } catch { /* sandboxed */ } }
export function loadCircle(): Circle | null {
  try { const v = sessionStorage.getItem(KEY); return CIRCLES.some((c) => c.value === v) ? (v as Circle) : null; } catch { return null; }
}
