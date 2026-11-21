// Local demo harness: used only when the widget is NOT embedded in a host
// (window.parent === window), e.g. during `npm run dev`.
// Select a view with ?view=memory_review|dashboard. Add ?flaky=1 to make every
// other tool call fail so you can exercise the error/retry UI.

import type { HostBridge, ToolOutcome } from "./mcp/client";
import type { DashboardViewData, Memory, MemoryReviewViewData, Visibility } from "./types";

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString();

export const mockMemoryReview: MemoryReviewViewData = {
  view: "memory_review",
  proposal_id: "prop_demo_1",
  expires_at: iso(1),
  proposals: [
    {
      index: 0,
      category: "INTEREST",
      title: "Loves bouldering",
      description: "Goes bouldering twice a week and enjoys trying new gyms.",
      tags: ["climbing", "fitness"],
      suggested_visibility: "SHARED_WITH_CONNECTIONS",
    },
    {
      index: 1,
      category: "SOCIAL_GOAL",
      title: "Meet people after moving to Seoul",
      description: "Recently moved and wants to build a small circle of friends.",
      tags: ["seoul", "friends"],
      suggested_visibility: "PRIVATE",
    },
    {
      index: 2,
      category: "DISLIKE",
      title: "Not a fan of loud bars",
      description: "Prefers quiet cafés or outdoor activities over crowded nightlife.",
      tags: ["venues"],
      suggested_visibility: "PUBLIC_PROFILE",
    },
  ],
};

export const mockDashboard: DashboardViewData = {
  view: "dashboard",
  profile: {
    user_id: "u_demo",
    display_name: "Minji",
    bio: "New in Seoul, climbing and coffee enthusiast.",
    social_goals: ["Make two close friends this year", "Find a weekly climbing buddy"],
    interests: ["Bouldering", "Specialty coffee", "Indie films", "Hiking"],
    memory_count: 3,
  },
  memories: [
    {
      memory_id: "m1",
      category: "INTEREST",
      title: "Loves bouldering",
      description: "Goes bouldering twice a week.",
      tags: ["climbing"],
      visibility: "SHARED_WITH_CONNECTIONS",
      created_at: iso(-10),
    },
    {
      memory_id: "m2",
      category: "PREFERENCE",
      title: "Morning person",
      description: "Prefers plans before noon on weekends.",
      tags: ["schedule"],
      visibility: "PUBLIC_PROFILE",
      created_at: iso(-6),
    },
    {
      memory_id: "m3",
      category: "PERSONAL_MEMORY",
      title: "Grandma's kimchi recipe",
      description: "Learned to make kimchi with grandma every winter.",
      tags: ["family", "food"],
      visibility: "PRIVATE",
      created_at: iso(-2),
    },
  ],
  connections: [
    {
      connection_id: "c1",
      user_id: "u_jun",
      display_name: "Jun",
      since: iso(-30),
      last_interaction_at: iso(-3),
    },
  ],
  pending_requests: [
    { request_id: "r1", sender_display_name: "Sora", created_at: iso(-1) },
    { request_id: "r2", sender_display_name: "Daniel", created_at: iso(0) },
  ],
};

export function mockInitialView(): MemoryReviewViewData | DashboardViewData | null {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "memory_review") return structuredClone(mockMemoryReview);
  if (view === "dashboard") return structuredClone(mockDashboard);
  return null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockBridge(): HostBridge {
  const flaky = new URLSearchParams(window.location.search).get("flaky") === "1";
  let calls = 0;

  const ok = (data: unknown): ToolOutcome => ({ ok: true, data });
  const fail = (errorText: string): ToolOutcome => ({ ok: false, errorText });

  return {
    isMock: true,
    async callTool(name, args) {
      await delay(450);
      calls += 1;
      console.info("[mock] callTool", name, args);
      if (flaky && calls % 2 === 1) return fail("NETWORK_ERROR: simulated failure (flaky mode). Try again.");

      switch (name) {
        case "heldly_save_memories": {
          const approvals = Array.isArray(args.approvals) ? args.approvals : [];
          const saved: Memory[] = approvals.map((a: Record<string, unknown>, i: number) => {
            const proposal = mockMemoryReview.proposals.find((p) => p.index === a.index);
            return {
              memory_id: `mem_${Date.now()}_${i}`,
              category: proposal?.category ?? "PERSONAL_MEMORY",
              title: String(a.title ?? ""),
              description: String(a.description ?? ""),
              tags: proposal?.tags ?? [],
              visibility: (a.visibility as Visibility) ?? "PRIVATE",
              created_at: new Date().toISOString(),
            };
          });
          return ok({ saved, count: saved.length });
        }
        case "heldly_delete_memory":
          return ok({ deleted: true, memory_id: args.memory_id });
        case "heldly_respond_to_connection":
          return ok({
            request_id: args.request_id,
            status: args.accept ? "ACCEPTED" : "REJECTED",
            connection_id: args.accept ? `c_${Date.now()}` : null,
          });
        default:
          return fail(`Unknown tool ${name}`);
      }
    },
    async updateModelContext(text) {
      console.info("[mock] updateModelContext:", text);
      return true;
    },
    async sendMessage(text) {
      console.info("[mock] sendMessage:", text);
      return true;
    },
  };
}
