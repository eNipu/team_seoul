// Local demo harness: used only when the widget is NOT embedded in a host
// (window.parent === window), e.g. during `npm run dev` or when opening dist/index.html.
//
//   ?view=memory_review|dashboard|invite|activity_ideas|reconnect|friend|friend_person|welcome
//   &tab=profile|memories|friends   initial dashboard tab
//   &theme=light|dark               force a theme (default: prefers-color-scheme)
//   &flaky=1                        every other tool call fails (error/retry UI)
//
// The mock bridge keeps one in-memory store, so the demo stays coherent while
// navigating (a person added on the dashboard is still there after visiting a
// friend view and coming back).

import type { HostBridge, ToolOutcome } from "./mcp/client";
import type {
  ActivityIdeasViewData,
  ActivitySuggestion,
  Connection,
  DashboardViewData,
  FriendKind,
  FriendViewData,
  Interaction,
  InviteViewData,
  Memory,
  MemoryReviewViewData,
  PendingRequest,
  Person,
  Profile,
  ReconnectViewData,
  SharedMemory,
  ViewData,
  Visibility,
  WelcomeViewData,
} from "./types";

export const DEMO_VIEWS = [
  "memory_review",
  "dashboard",
  "invite",
  "activity_ideas",
  "reconnect",
  "friend",
  "friend_person",
  "welcome",
] as const;

export function demoParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY));

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

interface MockConnection extends Connection {
  bio: string | null;
  interests: string[];
  shared_memories: SharedMemory[];
}

const MIN_RECONNECT_DAYS = 21;

const profile: Profile & { is_new: boolean } = {
  user_id: "u_demo",
  display_name: "Minji",
  bio: "New in Seoul. Climbing, coffee and long walks along the Han river.",
  social_goals: ["make_friends", "find_activity_partners"],
  interests: ["Bouldering", "Specialty coffee", "Indie films", "Hiking"],
  memory_count: 0, // derived in dashboardView()
  profile_visibility: "CONNECTIONS",
  is_new: false,
};

let memories: Memory[] = [
  {
    memory_id: "m1",
    category: "INTEREST",
    title: "Loves bouldering",
    description: "Goes bouldering twice a week and enjoys trying new gyms.",
    tags: ["climbing", "fitness"],
    visibility: "SHARED_WITH_CONNECTIONS",
    created_at: iso(-10),
  },
  {
    memory_id: "m4",
    category: "INTEREST",
    title: "Specialty coffee nerd",
    description: "Hunts for small roasters and brews pour-over at home.",
    tags: ["coffee"],
    visibility: "PUBLIC_PROFILE",
    created_at: iso(-8),
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
    memory_id: "m5",
    category: "DISLIKE",
    title: "Not a fan of loud bars",
    description: "Prefers quiet cafés or outdoor activities over crowded nightlife.",
    tags: ["venues"],
    visibility: "SHARED_WITH_CONNECTIONS",
    created_at: iso(-5),
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
];

let connections: MockConnection[] = [
  {
    connection_id: "c1",
    user_id: "u_jun",
    display_name: "Jun Park",
    since: iso(-64),
    last_interaction_at: iso(-3),
    bio: "Route setter by day, film club host by night.",
    interests: ["Bouldering", "Indie films", "Ramen", "Board games"],
    shared_memories: [
      {
        category: "INTEREST",
        title: "Sets routes at a climbing gym",
        description: "Works at a bouldering gym in Seongsu and loves showing friends new problems.",
        tags: ["climbing"],
      },
      {
        category: "PREFERENCE",
        title: "Weeknights work best",
        description: "Usually free on Tuesday and Thursday evenings.",
        tags: ["schedule"],
      },
    ],
  },
  {
    connection_id: "c2",
    user_id: "u_hana",
    display_name: "Hana Lee",
    since: iso(-120),
    last_interaction_at: iso(-41),
    bio: "Trail runner and amateur baker.",
    interests: ["Hiking", "Baking", "Specialty coffee"],
    shared_memories: [
      {
        category: "EXPERIENCE",
        title: "Hiked Bukhansan at sunrise",
        description: "Wants to do another sunrise hike before winter.",
        tags: ["hiking"],
      },
    ],
  },
];

let people: Person[] = [
  {
    person_id: "p1",
    name: "Taeyang Kim",
    relationship: "College roommate",
    notes: "Moved to Busan last year. Birthday in March. Always up for a long phone call on Sundays.",
    interests: ["Indie films", "Baseball", "Cooking"],
    last_interaction_at: iso(-62),
    created_at: iso(-90),
  },
  {
    person_id: "p2",
    name: "Mrs. Choi",
    relationship: "Neighbor",
    notes: "Waters my plants when I travel. Loves persimmons.",
    interests: ["Gardening"],
    last_interaction_at: null,
    created_at: iso(-30),
  },
];

let pending: PendingRequest[] = [
  { request_id: "r1", sender_display_name: "Sora Yoon", created_at: iso(-1) },
  { request_id: "r2", sender_display_name: "Daniel Cho", created_at: iso(0) },
];

/** Interaction history per friend, newest first. Keyed by `${kind}:${id}`. */
const interactions: Record<string, Interaction[]> = {
  "connection:c1": [
    { occurred_at: iso(-3), activity: "Bouldering at the Seongsu gym" },
    { occurred_at: iso(-17), activity: "Indie film night" },
    { occurred_at: iso(-33), activity: null },
  ],
  "connection:c2": [{ occurred_at: iso(-41), activity: "Sunrise hike on Bukhansan" }],
  "person:p1": [{ occurred_at: iso(-62), activity: "Long catch-up call" }],
};

const invites = new Map<string, { max_uses: number; expires_at: string }>();

const proposals: MemoryReviewViewData = {
  view: "memory_review",
  proposal_id: "prop_demo_1",
  expires_at: iso(1),
  proposals: [
    {
      index: 0,
      category: "INTEREST",
      title: "Getting into film photography",
      description: "Bought a second-hand film camera and shoots a roll every weekend.",
      tags: ["photography", "hobby"],
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
      category: "EXPERIENCE",
      title: "Ran a first 10K",
      description: "Finished the Han river 10K in October and wants to keep running.",
      tags: ["running"],
      suggested_visibility: "PUBLIC_PROFILE",
    },
  ],
};

const GOAL_OPTIONS = [
  { value: "make_friends", label: "Make new friends" },
  { value: "stay_in_touch", label: "Stay in touch with old friends" },
  { value: "find_activity_partners", label: "Find activity partners" },
  { value: "deepen_friendships", label: "Deepen existing friendships" },
  { value: "remember_details", label: "Remember the little things" },
  { value: "be_more_social", label: "Get out more" },
];

// ---------------------------------------------------------------------------
// Views built from the store
// ---------------------------------------------------------------------------

const key = (kind: FriendKind, id: string) => `${kind}:${id}`;
const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());

function overlap(a: string[], b: string[]): string[] {
  const set = new Set(lower(b));
  return a.filter((x) => set.has(x.toLowerCase()));
}

function findFriend(args: Record<string, unknown>):
  | { kind: "connection"; id: string; name: string; interests: string[]; conn: MockConnection }
  | { kind: "person"; id: string; name: string; interests: string[]; person: Person }
  | null {
  if (typeof args.person_id === "string") {
    const person = people.find((p) => p.person_id === args.person_id);
    return person ? { kind: "person", id: person.person_id, name: person.name, interests: person.interests, person } : null;
  }
  if (typeof args.connection_id === "string") {
    const conn = connections.find((c) => c.connection_id === args.connection_id);
    return conn
      ? { kind: "connection", id: conn.connection_id, name: conn.display_name, interests: conn.interests, conn }
      : null;
  }
  return null;
}

function dashboardView(): DashboardViewData {
  return structuredClone({
    view: "dashboard" as const,
    profile: { ...profile, memory_count: memories.length },
    memories,
    connections: connections.map(({ connection_id, user_id, display_name, since, last_interaction_at }) => ({
      connection_id,
      user_id,
      display_name,
      since,
      last_interaction_at,
    })),
    people,
    pending_requests: pending,
  });
}

function friendView(args: Record<string, unknown>): FriendViewData | null {
  const f = findFriend(args);
  if (!f) return null;
  const base = {
    view: "friend" as const,
    id: f.id,
    display_name: f.name,
    interests: f.interests,
    shared_interests: overlap(f.interests, profile.interests),
    recent_interactions: (interactions[key(f.kind, f.id)] ?? []).slice(0, 10),
  };
  if (f.kind === "connection") {
    return structuredClone({
      ...base,
      kind: "connection" as const,
      on_heldly: true,
      since: f.conn.since,
      last_interaction_at: f.conn.last_interaction_at,
      bio: f.conn.bio,
      relationship: null,
      notes: null,
      shared_memories: f.conn.shared_memories,
    });
  }
  return structuredClone({
    ...base,
    kind: "person" as const,
    on_heldly: false,
    since: f.person.created_at,
    last_interaction_at: f.person.last_interaction_at,
    bio: null,
    relationship: f.person.relationship,
    notes: f.person.notes,
    shared_memories: [],
  });
}

const IDEA_TEMPLATES: Record<string, (name: string) => ActivitySuggestion> = {
  bouldering: (name) => ({
    title: "Try a new bouldering gym",
    description: `Pick a gym neither of you has climbed at and trade beta on the hardest problem you can both finish.`,
    grounded_in: ["Bouldering"],
    suggested_action: `Ask ${name} which evening works this week.`,
  }),
  "indie films": (name) => ({
    title: "Indie film and late snack",
    description: "Catch a small-theater screening, then talk it over somewhere quiet.",
    grounded_in: ["Indie films"],
    suggested_action: `Send ${name} two film options and let them choose.`,
  }),
  "specialty coffee": (name) => ({
    title: "Roastery crawl",
    description: "Visit two small roasters in one afternoon and compare notes on the same bean.",
    grounded_in: ["Specialty coffee"],
    suggested_action: `Suggest a Saturday morning to ${name}.`,
  }),
  hiking: (name) => ({
    title: "Sunrise hike and breakfast",
    description: "An easy early trail with a warm breakfast at the bottom.",
    grounded_in: ["Hiking"],
    suggested_action: `Ask ${name} if next weekend is free.`,
  }),
};

const GENERAL_IDEAS = (name: string): ActivitySuggestion[] => [
  {
    title: "Walk and talk",
    description: "A relaxed one-hour walk somewhere green. No plan needed beyond showing up.",
    grounded_in: [],
    suggested_action: `Ask ${name} when they have a free hour.`,
  },
  {
    title: "Cook something together",
    description: "Pick one recipe, split the shopping, and eat what you make.",
    grounded_in: [],
    suggested_action: `Offer ${name} two dates to choose from.`,
  },
  {
    title: "Try a place neither of you knows",
    description: "A new café or neighborhood gives you something fresh to talk about.",
    grounded_in: [],
    suggested_action: `Send ${name} one idea and see what they add.`,
  },
];

function activityView(args: Record<string, unknown>): ActivityIdeasViewData | null {
  const f = findFriend(args);
  if (!f) return null;
  const shared = overlap(f.interests, profile.interests);
  const first = f.name.split(/\s+/)[0] || f.name;
  const grounded = shared
    .map((s) => IDEA_TEMPLATES[s.toLowerCase()])
    .filter((t): t is (name: string) => ActivitySuggestion => typeof t === "function")
    .map((t) => t(first));
  const suggestions = [...grounded, ...GENERAL_IDEAS(first)].slice(0, 3);
  const union = new Set([...lower(f.interests), ...lower(profile.interests)]).size || 1;
  const recent = (interactions[key(f.kind, f.id)] ?? []).length;
  const score = Math.min(1, shared.length / union + (shared.length > 0 ? 0.25 : 0.1) + Math.min(recent, 3) * 0.05);
  return {
    view: "activity_ideas",
    kind: f.kind,
    id: f.id,
    display_name: f.name,
    shared_interests: shared,
    match_score: Math.round(score * 100) / 100,
    score_explanation: [
      shared.length > 0
        ? `You share ${shared.length} ${shared.length === 1 ? "interest" : "interests"}: ${shared.join(", ")}.`
        : "No overlapping interests recorded yet.",
      recent > 0 ? `You have ${recent} logged ${recent === 1 ? "hangout" : "hangouts"} together.` : "No hangouts logged yet.",
      f.kind === "person"
        ? "Based only on your private notes about them."
        : "Based on what each of you chose to share with connections.",
    ],
    suggestions,
    note: "Heldly only suggests. It never contacts anyone for you.",
  };
}

function lastActivity(kind: FriendKind, id: string): string | null {
  return (interactions[key(kind, id)] ?? []).find((i) => i.activity)?.activity ?? null;
}

function reconnectView(): ReconnectViewData {
  const rows = [
    ...connections.map((c) => ({
      kind: "connection" as const,
      id: c.connection_id,
      name: c.display_name,
      interests: c.interests,
      last: c.last_interaction_at,
      since: c.since,
    })),
    ...people.map((p) => ({
      kind: "person" as const,
      id: p.person_id,
      name: p.name,
      interests: p.interests,
      last: p.last_interaction_at,
      since: p.created_at,
    })),
  ];
  const candidates = rows
    .map((r) => ({ ...r, days: daysSince(r.last ?? r.since) }))
    .filter((r) => r.days >= MIN_RECONNECT_DAYS)
    .sort((a, b) => b.days - a.days)
    .map((r) => {
      const shared = overlap(r.interests, profile.interests);
      const idea = shared.map((s) => IDEA_TEMPLATES[s.toLowerCase()]).find((t) => typeof t === "function");
      return {
        kind: r.kind,
        id: r.id,
        display_name: r.name,
        days_since_last_interaction: r.days,
        last_activity: lastActivity(r.kind, r.id),
        reason: r.last
          ? `It's been ${Math.round(r.days / 7)} weeks, longer than your usual rhythm.`
          : "You haven't logged any time together yet.",
        suggested_activity: idea ? idea(r.name).title : "A short catch-up call or a walk",
      };
    });
  return { view: "reconnect", min_days: MIN_RECONNECT_DAYS, candidates };
}

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick()}-${pick()}`;
}

function inviteView(maxUses: unknown, code = newCode()): InviteViewData {
  const max_uses = typeof maxUses === "number" && maxUses >= 1 ? Math.min(10, Math.floor(maxUses)) : 1;
  const expires_at = iso(7);
  invites.set(code, { max_uses, expires_at });
  return {
    view: "invite",
    code,
    expires_at,
    max_uses,
    share_text: `I'm using Heldly to keep up with the people I care about. Join me with invite code ${code}: open Heldly in ChatGPT and say "connect with code ${code}".`,
    note: "Share this code only with people you know. Anyone who uses it can send you a connection request, which you still approve.",
  };
}

function welcomeView(): WelcomeViewData {
  return { view: "welcome", display_name: profile.display_name, goal_options: GOAL_OPTIONS };
}

export function mockInitialView(): ViewData | null {
  switch (demoParam("view")) {
    case "memory_review":
      return structuredClone(proposals);
    case "dashboard":
      return dashboardView();
    case "invite":
      return inviteView(3, "HELD-7K2M");
    case "activity_ideas":
      return activityView({ connection_id: "c1" });
    case "reconnect":
      return reconnectView();
    case "friend":
      return friendView({ connection_id: "c1" });
    case "friend_person":
      return friendView({ person_id: "p1" });
    case "welcome":
      return welcomeView();
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Mock bridge
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const text = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.trim().slice(0, max) : undefined;
const textOrNull = (v: string | undefined, prev: string | null): string | null =>
  v === undefined ? prev : v === "" ? null : v;
const list = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((x) => x.trim().slice(0, 40))
        .slice(0, 12)
    : undefined;

let seq = 0;
const nextId = (prefix: string) => `${prefix}_demo_${++seq}`;

export function createMockBridge(): HostBridge {
  const flaky = demoParam("flaky") === "1";
  let calls = 0;

  const ok = (data: unknown): ToolOutcome => ({ ok: true, data: structuredClone(data) });
  const fail = (errorText: string): ToolOutcome => ({ ok: false, errorText });

  return {
    isMock: true,
    async callTool(name, args) {
      await delay(450);
      calls += 1;
      console.info("[mock] callTool", name, args);
      if (flaky && calls % 2 === 1) return fail("NETWORK_ERROR: simulated failure (flaky mode). Try again.");

      switch (name) {
        case "heldly_show_dashboard":
          return ok(dashboardView());

        case "heldly_save_memories": {
          const approvals: Record<string, unknown>[] = Array.isArray(args.approvals) ? args.approvals : [];
          const saved: Memory[] = approvals.map((a) => {
            const proposal = proposals.proposals.find((p) => p.index === a.index);
            return {
              memory_id: nextId("mem"),
              category: proposal?.category ?? "PERSONAL_MEMORY",
              title: String(a.title ?? ""),
              description: String(a.description ?? ""),
              tags: proposal?.tags ?? [],
              visibility: (a.visibility as Visibility) ?? "PRIVATE",
              created_at: new Date().toISOString(),
            };
          });
          memories = [...memories, ...saved];
          return ok({ saved, count: saved.length });
        }

        case "heldly_update_memory": {
          const m = memories.find((x) => x.memory_id === args.memory_id);
          if (!m) return fail("NOT_FOUND: memory not found");
          const title = text(args.title, 120);
          if (title !== undefined) {
            if (!title) return fail("INVALID_ARGUMENT: title cannot be empty");
            m.title = title;
          }
          const description = text(args.description, 500);
          if (description !== undefined) m.description = description;
          if (typeof args.visibility === "string") m.visibility = args.visibility as Visibility;
          return ok(m);
        }

        case "heldly_delete_memory": {
          if (!memories.some((m) => m.memory_id === args.memory_id)) return fail("NOT_FOUND: memory not found");
          memories = memories.filter((m) => m.memory_id !== args.memory_id);
          return ok({ deleted: true, memory_id: args.memory_id });
        }

        case "heldly_update_profile": {
          const displayName = text(args.display_name, 60);
          if (displayName !== undefined) {
            if (!displayName) return fail("INVALID_ARGUMENT: display name cannot be empty");
            profile.display_name = displayName;
          }
          const bio = text(args.bio, 500);
          if (bio !== undefined) profile.bio = bio || null;
          const goals = list(args.social_goals);
          if (goals !== undefined) profile.social_goals = goals.slice(0, 6);
          profile.is_new = false;
          return ok({ ...profile, memory_count: memories.length });
        }

        case "heldly_respond_to_connection": {
          const req = pending.find((r) => r.request_id === args.request_id);
          if (!req) return fail("NOT_FOUND: connection request not found");
          pending = pending.filter((r) => r.request_id !== req.request_id);
          let connectionId: string | null = null;
          if (args.accept === true) {
            connectionId = nextId("c");
            connections = [
              ...connections,
              {
                connection_id: connectionId,
                user_id: nextId("u"),
                display_name: req.sender_display_name,
                since: new Date().toISOString(),
                last_interaction_at: null,
                bio: "Just joined Heldly.",
                interests: ["Hiking", "Photography"],
                shared_memories: [],
              },
            ];
          }
          return ok({
            request_id: req.request_id,
            status: args.accept === true ? "ACCEPTED" : "REJECTED",
            connection_id: connectionId,
          });
        }

        case "heldly_create_invite":
          return ok(inviteView(args.max_uses));

        case "heldly_revoke_invite": {
          if (typeof args.code !== "string" || !invites.has(args.code)) return fail("NOT_FOUND: invite code not found");
          invites.delete(args.code);
          return ok({ revoked: true });
        }

        case "heldly_view_friend": {
          const view = friendView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "heldly_suggest_activity": {
          const view = activityView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "heldly_reconnection_suggestions":
          return ok(reconnectView());

        case "heldly_log_interaction": {
          const f = findFriend(args);
          if (!f) return fail("NOT_FOUND: friend not found");
          const occurred_at = new Date().toISOString();
          const k = key(f.kind, f.id);
          interactions[k] = [{ occurred_at, activity: text(args.activity, 120) || null }, ...(interactions[k] ?? [])];
          if (f.kind === "connection") f.conn.last_interaction_at = occurred_at;
          else f.person.last_interaction_at = occurred_at;
          return ok({ recorded: true, kind: f.kind, id: f.id, last_interaction_at: occurred_at });
        }

        case "heldly_add_person": {
          const personName = text(args.name, 80);
          if (!personName) return fail("INVALID_ARGUMENT: name is required");
          const person: Person = {
            person_id: nextId("p"),
            name: personName,
            relationship: text(args.relationship, 80) || null,
            notes: text(args.notes, 1000) || null,
            interests: list(args.interests) ?? [],
            last_interaction_at: null,
            created_at: new Date().toISOString(),
          };
          people = [...people, person];
          return ok(person);
        }

        case "heldly_update_person": {
          const person = people.find((p) => p.person_id === args.person_id);
          if (!person) return fail("NOT_FOUND: person not found");
          const personName = text(args.name, 80);
          if (personName !== undefined) {
            if (!personName) return fail("INVALID_ARGUMENT: name cannot be empty");
            person.name = personName;
          }
          person.relationship = textOrNull(text(args.relationship, 80), person.relationship);
          person.notes = textOrNull(text(args.notes, 1000), person.notes);
          person.interests = list(args.interests) ?? person.interests;
          return ok(person);
        }

        case "heldly_delete_person": {
          if (!people.some((p) => p.person_id === args.person_id)) return fail("NOT_FOUND: person not found");
          people = people.filter((p) => p.person_id !== args.person_id);
          delete interactions[`person:${String(args.person_id)}`];
          return ok({ deleted: true, person_id: args.person_id });
        }

        case "heldly_remove_connection": {
          if (!connections.some((c) => c.connection_id === args.connection_id)) {
            return fail("NOT_FOUND: connection not found");
          }
          connections = connections.filter((c) => c.connection_id !== args.connection_id);
          delete interactions[`connection:${String(args.connection_id)}`];
          return ok({ removed: true, connection_id: args.connection_id });
        }

        default:
          return fail(`UNKNOWN_TOOL: the demo doesn't implement ${name}`);
      }
    },
    async updateModelContext(message) {
      console.info("[mock] updateModelContext:", message);
      return true;
    },
    async sendMessage(message) {
      console.info("[mock] sendMessage:", message);
      return true;
    },
  };
}
