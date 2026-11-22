// Who Venn is for, picked on step 01 and remembered for step 03.
export type Circle = "partner" | "friends_family" | "network" | "everyone";

export const CIRCLES: { value: Circle; label: string; invite: string; importFirst: boolean }[] = [
  { value: "partner", label: "Partner", invite: "Invite your partner", importFirst: false },
  { value: "friends_family", label: "Friends and family", invite: "Invite someone", importFirst: true },
  { value: "network", label: "Network", invite: "Invite someone", importFirst: true },
  { value: "everyone", label: "Everyone", invite: "Invite someone", importFirst: true },
];

// What Venn would mention for that circle, shown as the demo under Connect. Light, specific, never intimate.
export const DEMO: Record<Circle, { ask: string; person: string; answer: string }> = {
  partner: { ask: "Ideas for Saturday?", person: "Sam", answer: "Sam mentioned wanting to try a pottery class. There's one Saturday at 11." },
  friends_family: { ask: "Any plans this weekend?", person: "Emma", answer: "Btw, Emma is in Berlin this weekend too. Worth a hello?" },
  network: { ask: "Who could help with marketing?", person: "Maya", answer: "Btw, Maya works in marketing and is in Berlin this week. Worth reaching out?" },
  everyone: { ask: "Who should I talk to about this?", person: "Alex", answer: "Btw, Alex is looking for a designer, and you know a few. Worth a hello?" },
};

const KEY = "venn.circle";
export function saveCircle(c: Circle) { try { sessionStorage.setItem(KEY, c); } catch { /* sandboxed */ } }
export function loadCircle(): Circle | null {
  try { const v = sessionStorage.getItem(KEY); return CIRCLES.some((c) => c.value === v) ? (v as Circle) : null; } catch { return null; }
}
