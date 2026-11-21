// Local demo harness: used only when the widget is NOT embedded in a host
// (window.parent === window), e.g. during `npm run dev` or when opening dist/index.html.
//
//   ?view=memory_review|dashboard|invite|activity_ideas|reconnect|friend|friend_person|welcome
//         people_import|people_search|group_plan|brief|brief_person|quiz|quiz_circle
//         memory_import|memory_review_import|help|dashboard_setup
//   &tab=profile|memories|friends   initial dashboard tab
//   &theme=light|dark               force a theme (default: prefers-color-scheme)
//   &flaky=1                        every other tool call fails (error/retry UI)
//   &nochat=1                       sendMessage is refused (copy-and-paste fallbacks)
//
// The mock bridge keeps one in-memory store, so the demo stays coherent while
// navigating (a person added on the dashboard is still there after visiting a
// friend view and coming back).

import type { HostBridge, ToolOutcome } from "./mcp/client";
import { mockQrRows } from "./mockQr";
import type {
  ActivityIdeasViewData,
  ActivitySuggestion,
  BriefViewData,
  Connection,
  DashboardViewData,
  FollowUp,
  FriendKind,
  FriendViewData,
  GroupPlanViewData,
  HelpTopic,
  HelpViewData,
  ImportCandidate,
  Interaction,
  InviteViewData,
  Memory,
  MemoryCategory,
  MemoryImportViewData,
  MemoryProposal,
  MemoryReviewViewData,
  PendingRequest,
  PeopleImportViewData,
  PeopleSearchViewData,
  Person,
  Profile,
  ProposalSource,
  QuizQuestion,
  QuizViewData,
  ReconnectViewData,
  SearchResult,
  SetupStep,
  SharedMemory,
  ViewData,
  Visibility,
  WelcomeViewData,
} from "./types";
import { parseView } from "./types";

export const DEMO_VIEWS = [
  "memory_review",
  "dashboard",
  "invite",
  "activity_ideas",
  "reconnect",
  "friend",
  "friend_person",
  "welcome",
  "people_import",
  "people_search",
  "group_plan",
  "brief",
  "brief_person",
  "quiz",
  "quiz_circle",
  "memory_import",
  "memory_review_import",
  "help",
  "dashboard_setup",
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
    source: "chatgpt_memory",
  },
  {
    memory_id: "m4",
    category: "INTEREST",
    title: "Specialty coffee nerd",
    description: "Hunts for small roasters and brews pour-over at home.",
    tags: ["coffee"],
    visibility: "PUBLIC_PROFILE",
    created_at: iso(-8),
    source: "chatgpt_memory",
  },
  {
    memory_id: "m2",
    category: "PREFERENCE",
    title: "Morning person",
    description: "Prefers plans before noon on weekends.",
    tags: ["schedule"],
    visibility: "PUBLIC_PROFILE",
    created_at: iso(-6),
    source: null,
  },
  {
    memory_id: "m5",
    category: "DISLIKE",
    title: "Not a fan of loud bars",
    description: "Prefers quiet cafés or outdoor activities over crowded nightlife.",
    tags: ["venues"],
    visibility: "SHARED_WITH_CONNECTIONS",
    created_at: iso(-5),
    source: null,
  },
  {
    memory_id: "m3",
    category: "PERSONAL_MEMORY",
    title: "Grandma's kimchi recipe",
    description: "Learned to make kimchi with grandma every winter.",
    tags: ["family", "food"],
    visibility: "PRIVATE",
    created_at: iso(-2),
    source: null,
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
  {
    connection_id: "c3",
    user_id: "u_mina",
    display_name: "Mina Seo",
    since: iso(-35),
    last_interaction_at: iso(-12),
    bio: "Film photographer who plans her weekends around good light.",
    interests: ["Bouldering", "Specialty coffee", "Photography"],
    shared_memories: [
      {
        category: "INTEREST",
        title: "Shoots on a 1970s film camera",
        description: "Develops her own black-and-white rolls in her bathroom.",
        tags: ["photography"],
      },
      {
        category: "DISLIKE",
        title: "Can't stand cilantro",
        description: "Will politely pick every leaf out of a bowl of pho.",
        tags: ["food"],
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
  {
    person_id: "p3",
    name: "Dohyun Lim",
    relationship: "Climbing buddy from work",
    notes: "Learning to lead climb. Has a rescue dog called Mochi. Knows every craft beer bar in Euljiro.",
    interests: ["Bouldering", "Hiking", "Craft beer"],
    last_interaction_at: iso(-27),
    created_at: iso(-200),
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
  "connection:c3": [{ occurred_at: iso(-12), activity: "Photo walk in Ikseon-dong" }],
  "person:p3": [{ occurred_at: iso(-27), activity: "After-work climb and beers" }],
};

/** Things to ask about next time, newest first. Keyed by `${kind}:${id}`. */
const followUps: Record<string, FollowUp[]> = {
  "connection:c1": [
    { follow_up_id: "fu1", text: "How did the route-setting competition go?", created_at: iso(-3) },
    { follow_up_id: "fu2", text: "Did the film club pick a theme for December?", created_at: iso(-17) },
  ],
  "connection:c2": [{ follow_up_id: "fu3", text: "Is the sourdough starter still alive?", created_at: iso(-41) }],
  "person:p1": [
    { follow_up_id: "fu4", text: "How is the new job in Busan going?", created_at: iso(-62) },
    { follow_up_id: "fu5", text: "Did his sister have the baby?", created_at: iso(-62) },
  ],
};

const IMPORT_CANDIDATES: ImportCandidate[] = [
  {
    index: 0,
    name: "Yuna Kang",
    relationship: "Coworker",
    notes: "Sits two desks over. Training for her first half marathon.",
    interests: ["Running", "Specialty coffee"],
    last_met_days_ago: 2,
    already_added: false,
  },
  {
    index: 1,
    name: "Taeyang Kim",
    relationship: "College roommate",
    notes: null,
    interests: ["Indie films", "Baseball"],
    last_met_days_ago: 62,
    already_added: true,
  },
  {
    index: 2,
    name: "Eunji Seo",
    relationship: "High school friend",
    notes: "Lives in Daejeon now. We always end up at karaoke.",
    interests: ["Indie films", "Karaoke"],
    last_met_days_ago: 140,
    already_added: false,
  },
  {
    index: 3,
    name: "Marcus Bell",
    relationship: "Language exchange partner",
    notes: null,
    interests: ["Hiking", "Korean BBQ", "Photography"],
    last_met_days_ago: 30,
    already_added: false,
  },
  {
    index: 4,
    name: "Grandma Oksoon",
    relationship: "Family",
    notes: "Call on Sundays. Kimchi season is in November.",
    interests: ["Kimchi-making", "Trot music"],
    last_met_days_ago: 21,
    already_added: false,
  },
  {
    index: 5,
    name: "Jiho Nam",
    relationship: "Climbing gym regular",
    notes: null,
    interests: ["Bouldering"],
    last_met_days_ago: 5,
    already_added: false,
  },
  {
    index: 6,
    name: "Professor Han",
    relationship: "Thesis advisor",
    notes: null,
    interests: [],
    last_met_days_ago: null,
    already_added: false,
  },
  {
    index: 7,
    name: "Lena Fischer",
    relationship: "Former flatmate in Berlin",
    notes: "Visiting Seoul in spring.",
    interests: ["Baking", "Techno", "Board games"],
    last_met_days_ago: 400,
    already_added: false,
  },
  {
    index: 8,
    name: "Subin Oh",
    relationship: "Book club",
    notes: null,
    interests: ["Novels", "Tea"],
    last_met_days_ago: 60,
    already_added: false,
  },
];

const imports = new Map<string, ImportCandidate[]>();

const invites = new Map<string, { max_uses: number; expires_at: string }>();

type ProposalSeed = Omit<MemoryProposal, "index" | "already_saved">;

const DEMO_PROPOSALS: ProposalSeed[] = [
  {
    category: "INTEREST",
    title: "Getting into film photography",
    description: "Bought a second-hand film camera and shoots a roll every weekend.",
    tags: ["photography", "hobby"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "SOCIAL_GOAL",
    title: "Meet people after moving to Seoul",
    description: "Recently moved and wants to build a small circle of friends.",
    tags: ["seoul", "friends"],
    suggested_visibility: "PRIVATE",
  },
  {
    category: "EXPERIENCE",
    title: "Ran a first 10K",
    description: "Finished the Han river 10K in October and wants to keep running.",
    tags: ["running"],
    suggested_visibility: "PUBLIC_PROFILE",
  },
];

/** What "ChatGPT" picked in the import demo. The first two are already in the mock store. */
const IMPORT_PROPOSALS: ProposalSeed[] = [
  {
    category: "INTEREST",
    title: "Loves bouldering",
    description: "Goes bouldering twice a week and enjoys trying new gyms.",
    tags: ["climbing", "fitness"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "INTEREST",
    title: "Specialty coffee nerd",
    description: "Hunts for small roasters and brews pour-over at home.",
    tags: ["coffee"],
    suggested_visibility: "PUBLIC_PROFILE",
  },
  {
    category: "WORK",
    title: "Product designer at a fintech startup",
    description: "Leads design for the mobile app on a small team.",
    tags: ["design", "job"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "WORK",
    title: "Building a side project for plant care",
    description: "Prototyping a watering reminder app on weekends.",
    tags: ["side-project", "plants"],
    suggested_visibility: "PRIVATE",
  },
  {
    category: "INTEREST",
    title: "Reads science fiction",
    description: "Favourite authors are Ted Chiang and Ursula K. Le Guin.",
    tags: ["books", "sci-fi"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "INTEREST",
    title: "Plays board games",
    description: "Hosts a strategy game night about once a month.",
    tags: ["board games"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "PREFERENCE",
    title: "Vegetarian-friendly places",
    description: "Mostly eats vegetarian and looks for places with good options.",
    tags: ["food"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "DISLIKE",
    title: "Avoids last-minute plans",
    description: "Likes a few days of notice before meeting up.",
    tags: ["schedule"],
    suggested_visibility: "PRIVATE",
  },
  {
    category: "EXPERIENCE",
    title: "Hiked the Jeju Olle trail",
    description: "Walked five routes over a week last spring.",
    tags: ["hiking", "jeju"],
    suggested_visibility: "PUBLIC_PROFILE",
  },
  {
    category: "EXPERIENCE",
    title: "Lived in Berlin for two years",
    description: "Moved back to Seoul in 2023 and still misses the bakeries.",
    tags: ["berlin", "travel"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
  {
    category: "SOCIAL_GOAL",
    title: "See friends in person more often",
    description: "Wants at least one meetup a week instead of only chatting online.",
    tags: ["friends"],
    suggested_visibility: "PRIVATE",
  },
  {
    category: "PERSONAL_MEMORY",
    title: "Adopted a cat named Mochi",
    description: "Mochi came home from a shelter two winters ago.",
    tags: ["cat", "pets"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
  },
];

/** Proposals awaiting approval, by proposal_id (what heldly_save_memories looks up). */
const proposalStore = new Map<string, MemoryReviewViewData>();

function reviewView(source: ProposalSource, seeds: ProposalSeed[], proposalId: string): MemoryReviewViewData {
  const have = new Set(memories.map((m) => m.title.trim().toLowerCase()));
  const view: MemoryReviewViewData = {
    view: "memory_review",
    proposal_id: proposalId,
    expires_at: iso(1),
    source,
    proposals: seeds.slice(0, 30).map((p, index) => ({
      ...p,
      index,
      already_saved: have.has(p.title.trim().toLowerCase()),
    })),
  };
  proposalStore.set(proposalId, view);
  return structuredClone(view);
}

const IMPORT_AREAS: MemoryImportViewData["areas"] = [
  { value: "interests", label: "Interests and hobbies", description: "What you enjoy doing and talking about.", selected: true },
  {
    value: "preferences",
    label: "Likes, dislikes and preferences",
    description: "Food, places, plans — what you go for and what you avoid.",
    selected: true,
  },
  { value: "work", label: "Work and projects", description: "What you do and what you are building.", selected: true },
  { value: "goals", label: "Goals and plans", description: "What you are working towards.", selected: true },
  { value: "experiences", label: "Experiences and places", description: "Trips, events and things you have done.", selected: true },
  { value: "personal", label: "Personal life", description: "Family, relationships and milestones.", selected: false },
];

function memoryImportView() {
  return {
    view: "memory_import" as const,
    areas: structuredClone(IMPORT_AREAS),
    always_excluded: "Health, money, passwords and ID numbers are never imported.",
    imported_count: memories.filter((m) => m.source === "chatgpt_memory").length,
    max_items: 30,
    note: "The user chooses areas on the card; list matching memories in the chat before proposing anything.",
  };
}

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

/** The three onboarding steps, derived from what the store already holds. */
function setupSteps(fresh = false): SetupStep[] {
  const connected = !fresh && connections.length > 0;
  return [
    {
      key: "about_you",
      title: "Tell Heldly about you",
      description: "Bring over what ChatGPT already remembers, or answer a couple of questions.",
      done: !fresh && memories.length > 0,
    },
    {
      key: "your_people",
      title: "Add your people",
      description: "Paste a list, upload your contacts, or name a few friends.",
      done: !fresh && (people.length > 0 || connected),
    },
    {
      key: "connect",
      title: "Connect with friends",
      description: "Share an invite so friends on ChatGPT can connect with you.",
      done: connected,
    },
  ];
}

const HELP_TOPICS: HelpTopic[] = [
  {
    key: "setup",
    title: "Getting set up",
    description: "Three short steps: tell Heldly about you, add your people, connect with friends.",
    examples: ["Set up Heldly"],
  },
  {
    key: "memories",
    title: "Remember what matters to you",
    description: "Heldly suggests memories from what you say; you choose what to keep and who can see it.",
    examples: ["Remember that I love bouldering and ramen", "Import my ChatGPT memory into Heldly", "What did I save about food?"],
  },
  {
    key: "people",
    title: "Keep notes on your people",
    description: "Add friends who are not on Heldly, one at a time or a whole list. Notes stay private to you.",
    examples: ["Import my friends into Heldly", "Who do I know who likes hiking?"],
  },
  {
    key: "connect",
    title: "Connect with friends on Heldly",
    description: "Share an invite code, link or QR. Friends accept before you are connected.",
    examples: ["Create a Heldly invite", "I have a Heldly invite code"],
  },
  {
    key: "stay_close",
    title: "Stay close",
    description: "Ideas for time together, a brief before you meet, a recap after, and nudges when it has been a while.",
    examples: ["Who should I reconnect with?", "Plan something with a few friends", "I'm seeing a friend tomorrow — brief me"],
  },
  {
    key: "quiz",
    title: "Play",
    description: "A quick quiz on how well you know your friends, from what they chose to share.",
    examples: ["Play the Heldly quiz"],
  },
];

function helpView(): HelpViewData {
  return structuredClone({
    view: "help" as const,
    display_name: profile.display_name,
    topics: HELP_TOPICS,
    setup: setupSteps(),
    privacy: [
      "Nothing is saved until you approve it.",
      "Memories are private unless you choose to share them.",
      "Heldly never contacts anyone for you.",
      "You can edit or delete anything, or delete your whole account.",
    ],
    note: "Offer to start whichever set-up step is still open.",
  });
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
    setup: setupSteps(),
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
    follow_ups: followUps[key(f.kind, f.id)] ?? [],
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
  const link = `https://heldly.app/i/${code}`;
  return {
    view: "invite",
    code,
    link,
    qr: mockQrRows(link),
    expires_at,
    max_uses,
    share_text: `I'm using Heldly to keep up with the people I care about. Join me with invite code ${code}: open Heldly in ChatGPT and say "connect with code ${code}".`,
    note: "Share this code only with people you know. Anyone who uses it can send you a connection request, which you still approve.",
  };
}

// ---------------------------------------------------------------------------
// Import, search, group plan, brief and quiz
// ---------------------------------------------------------------------------

const firstName = (name: string) => name.split(/\s+/)[0] || name;

function importView(): PeopleImportViewData {
  const import_id = nextId("imp");
  const taken = new Set(people.map((p) => p.name.toLowerCase()));
  const candidates = IMPORT_CANDIDATES.map((c) => ({ ...c, already_added: taken.has(c.name.toLowerCase()) }));
  imports.set(import_id, candidates);
  return structuredClone({
    view: "people_import" as const,
    import_id,
    expires_at: iso(1),
    source: "pasted list",
    candidates,
    skipped: 1,
    note: "Nothing is saved until you confirm. These stay private notes only you can see.",
  });
}

const STOP_WORDS = new Set(
  "a an and are do does for i in into is know knows like likes love loves me my of on or people someone that the to who whos with friends friend".split(" "),
);
const SYNONYMS: Record<string, string[]> = {
  climb: ["boulder"],
  movie: ["film"],
  cinema: ["film"],
  cafe: ["coffee"],
  run: ["marathon", "trail runner"],
  food: ["cook", "bak", "ramen", "bbq", "kimchi"],
  outdoor: ["hik", "garden", "boulder"],
  photo: ["camera"],
  beer: ["craft beer"],
};

function searchTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|ies|s)$/, "") : w));
  return [...new Set(words.flatMap((w) => [w, ...(SYNONYMS[w] ?? [])]))];
}

function searchView(rawQuery: unknown): PeopleSearchViewData {
  const query = (typeof rawQuery === "string" ? rawQuery : "").trim().slice(0, 120);
  const terms = searchTerms(query);
  const hit = (s: string | null | undefined) => {
    if (!s) return false;
    const hay = s.toLowerCase();
    return terms.some((t) => hay.includes(t));
  };
  const results: SearchResult[] = [];

  for (const c of connections) {
    const matched = c.interests.filter(hit);
    const memory = c.shared_memories.find((m) => hit(m.title) || hit(m.description) || m.tags.some(hit));
    if (memory) matched.push(memory.title);
    if (hit(c.display_name)) matched.push("Name");
    const bioHit = hit(c.bio);
    if (matched.length === 0 && !bioHit) continue;
    results.push({
      kind: "connection",
      id: c.connection_id,
      display_name: c.display_name,
      on_heldly: true,
      relationship: null,
      matched,
      snippet: memory?.description ?? c.bio,
      last_interaction_at: c.last_interaction_at,
    });
  }
  for (const p of people) {
    const matched = p.interests.filter(hit);
    if (hit(p.relationship) && p.relationship) matched.push(p.relationship);
    if (hit(p.name)) matched.push("Name");
    const noteHit = hit(p.notes);
    if (noteHit) matched.push("Your notes");
    if (matched.length === 0) continue;
    results.push({
      kind: "person",
      id: p.person_id,
      display_name: p.name,
      on_heldly: false,
      relationship: p.relationship,
      matched,
      snippet: p.notes,
      last_interaction_at: p.last_interaction_at,
    });
  }
  results.sort((a, b) => b.matched.length - a.matched.length);
  return structuredClone({
    view: "people_search" as const,
    query,
    results,
    count: results.length,
    searched: connections.length + people.length,
    note: "Searched your private notes and what connections chose to share with you.",
  });
}

const GROUP_IDEAS: Record<string, ActivitySuggestion> = {
  bouldering: {
    title: "Group session at a new bouldering gym",
    description: "Pick a gym none of you has climbed at, split into pairs and swap beta on one shared project.",
    grounded_in: ["Bouldering"],
    suggested_action: "Share two evenings in the group chat and go with the first that works for everyone.",
  },
  "indie films": {
    title: "Small-theater film night",
    description: "One screening, then a late snack where everyone has to defend their favourite scene.",
    grounded_in: ["Indie films"],
    suggested_action: "Send two film options and let the group vote.",
  },
  "specialty coffee": {
    title: "Roastery crawl",
    description: "Three small roasters in one afternoon. Everyone orders the same bean and compares notes.",
    grounded_in: ["Specialty coffee"],
    suggested_action: "Suggest a Saturday morning and a starting point.",
  },
  hiking: {
    title: "Easy ridge hike and a big lunch",
    description: "A trail gentle enough to talk the whole way, with a proper meal at the bottom.",
    grounded_in: ["Hiking"],
    suggested_action: "Ask who is free next weekend.",
  },
};

function groupView(args: Record<string, unknown>): GroupPlanViewData | string {
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const found = [
    ...ids(args.connection_ids).map((connection_id) => findFriend({ connection_id })),
    ...ids(args.person_ids).map((person_id) => findFriend({ person_id })),
  ];
  if (found.some((f) => f === null)) return "NOT_FOUND: one of those friends was not found";
  const members = found.filter((f) => f !== null);
  if (members.length < 2 || members.length > 6) return "INVALID_ARGUMENT: pick between 2 and 6 friends";

  const everyone = [{ name: "You", interests: profile.interests }, ...members.map((m) => ({ name: m.name, interests: m.interests }))];
  const labels = new Map<string, string>();
  for (const person of everyone) for (const i of person.interests) if (!labels.has(i.toLowerCase())) labels.set(i.toLowerCase(), i);
  const has = (person: { interests: string[] }, k: string) => person.interests.some((i) => i.toLowerCase() === k);

  const common_to_all: string[] = [];
  const common_to_some: { interest: string; members: string[] }[] = [];
  for (const [k, label] of labels) {
    const who = everyone.filter((person) => has(person, k)).map((person) => person.name);
    if (who.length === everyone.length) common_to_all.push(label);
    else if (who.length >= 2) common_to_some.push({ interest: label, members: who });
  }
  common_to_some.sort((a, b) => b.members.length - a.members.length);

  const grounded = [...common_to_all, ...common_to_some.map((o) => o.interest)]
    .map((i) => GROUP_IDEAS[i.toLowerCase()])
    .filter((s): s is ActivitySuggestion => s !== undefined);
  const suggestions = [...grounded, ...GENERAL_IDEAS("everyone")].slice(0, 3);

  return structuredClone({
    view: "group_plan" as const,
    members: members.map((m) => ({ kind: m.kind, id: m.id, display_name: m.name, interests: m.interests })),
    common_to_all,
    common_to_some,
    suggestions,
    note: "Based on your private notes and what each connection chose to share. Heldly never contacts anyone for you.",
  });
}

function briefView(args: Record<string, unknown>): BriefViewData | null {
  const f = findFriend(args);
  if (!f) return null;
  const first = firstName(f.name);
  const shared = overlap(f.interests, profile.interests);
  const last = f.kind === "connection" ? f.conn.last_interaction_at : f.person.last_interaction_at;
  const activity = lastActivity(f.kind, f.id);
  const memories = f.kind === "connection" ? f.conn.shared_memories : [];
  const starters: string[] = [];
  if (activity) starters.push(`Last time was "${activity}". What has changed for you since then?`);
  if (shared[0]) starters.push(`Found anything new in ${shared[0].toLowerCase()} lately that I should try?`);
  if (memories[0]) starters.push(`You mentioned "${memories[0].title.toLowerCase()}". How is that going?`);
  const own = f.interests.find((i) => !shared.includes(i));
  if (own) starters.push(`I know almost nothing about ${own.toLowerCase()}. Where would a beginner start?`);
  if (starters.length < 3) starters.push(`What is one thing you are looking forward to this month, ${first}?`);
  return structuredClone({
    view: "brief" as const,
    kind: f.kind,
    id: f.id,
    display_name: f.name,
    on_heldly: f.kind === "connection",
    relationship: f.kind === "person" ? f.person.relationship : null,
    notes: f.kind === "person" ? f.person.notes : null,
    last_interaction_at: last,
    last_activity: activity,
    days_since_last_interaction: last ? daysSince(last) : null,
    interests: f.interests,
    shared_interests: shared,
    shared_memories: memories,
    things_to_ask: followUps[key(f.kind, f.id)] ?? [],
    conversation_starters: starters.slice(0, 4),
    note:
      f.kind === "person"
        ? "Built only from your private notes about them."
        : `Built only from what ${first} chose to share with connections and what you logged.`,
  });
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Builds one question: the right answer plus up to three wrong ones, shuffled. */
function question(prompt: string, right: string, wrong: string[], explanation: string): QuizQuestion | null {
  const distractors = [...new Set(wrong)].filter((w) => w.toLowerCase() !== right.toLowerCase()).slice(0, 3);
  if (distractors.length === 0) return null;
  const options = shuffle([right, ...distractors]);
  return { prompt, options, answer_index: options.indexOf(right), explanation };
}

const DECOY_INTERESTS = ["Scuba diving", "Knitting", "Golf", "K-pop dance", "Chess", "Surfing", "Pottery", "Salsa"];
const DECOY_BIOS = [
  "Accountant by day, jazz drummer by night.",
  "Marathon swimmer and weekend florist.",
  "Game developer who collects vintage maps.",
];
const DECOY_FACTS = ["Collects vinyl records", "Is learning Italian", "Keeps bees on a rooftop", "Ran with the bulls once"];

function friendQuiz(conn: MockConnection): QuizViewData {
  const first = firstName(conn.display_name);
  const mine = new Set(lower(conn.interests));
  const decoys = shuffle(DECOY_INTERESTS.filter((d) => !mine.has(d.toLowerCase())));
  const shared = overlap(conn.interests, profile.interests);
  const questions: (QuizQuestion | null)[] = [];

  const pick = conn.interests.find((i) => !shared.includes(i)) ?? conn.interests[0];
  if (pick) {
    questions.push(
      question(`Which of these is ${first} into?`, pick, decoys.slice(0, 3), `${first} lists ${pick.toLowerCase()} as an interest.`),
    );
  }
  if (conn.bio) {
    questions.push(
      question(`How does ${first} describe themselves?`, conn.bio, shuffle(DECOY_BIOS), `That is ${first}'s own bio on Heldly.`),
    );
  }
  for (const memory of conn.shared_memories.slice(0, 2)) {
    questions.push(
      question(`Which of these did ${first} share with you?`, memory.title, shuffle(DECOY_FACTS), memory.description),
    );
  }
  if (conn.interests.length >= 3 && decoys[3]) {
    questions.push(
      question(
        `Which one is NOT on ${first}'s list?`,
        decoys[3],
        shuffle(conn.interests),
        `${first} never mentioned ${decoys[3].toLowerCase()}. The other three are all on the list.`,
      ),
    );
  }
  const idea = shared.map((s) => IDEA_TEMPLATES[s.toLowerCase()]).find((t) => typeof t === "function");
  const next = idea ? idea(first) : GENERAL_IDEAS(first)[0]!;
  return {
    view: "quiz",
    mode: "friend",
    kind: "connection",
    id: conn.connection_id,
    display_name: conn.display_name,
    title: `How well do you know ${first}?`,
    questions: questions.filter((q): q is QuizQuestion => q !== null),
    common_ground: shared,
    next: { title: next.title, description: next.description },
    note: `Built only from what ${first} chose to share with connections.`,
  };
}

function circleQuiz(): QuizViewData {
  const circle = [
    ...connections.map((c) => ({ name: c.display_name, interests: c.interests, relationship: null as string | null, last: c.last_interaction_at })),
    ...people.map((p) => ({ name: p.name, interests: p.interests, relationship: p.relationship, last: p.last_interaction_at })),
  ];
  const names = circle.map((c) => c.name);
  const others = (name: string) => shuffle(names.filter((n) => n !== name));
  const questions: (QuizQuestion | null)[] = [];

  for (const friend of shuffle(circle)) {
    const unique = friend.interests.find(
      (i) => circle.filter((c) => c.interests.some((x) => x.toLowerCase() === i.toLowerCase())).length === 1,
    );
    if (unique) {
      questions.push(
        question(`Who is into ${unique.toLowerCase()}?`, friend.name, others(friend.name), `${unique} is on ${firstName(friend.name)}'s list.`),
      );
    }
    if (questions.length >= 3) break;
  }
  const withRole = shuffle(circle.filter((c) => c.relationship))[0];
  if (withRole?.relationship) {
    questions.push(
      question(
        `Who did you note down as "${withRole.relationship}"?`,
        withRole.name,
        others(withRole.name),
        `That is how you described ${firstName(withRole.name)} in your private notes.`,
      ),
    );
  }
  const seen = circle.filter((c) => c.last).sort((a, b) => (a.last! < b.last! ? -1 : 1));
  const longest = seen[0];
  if (longest?.last && seen.length >= 2) {
    questions.push(
      question(
        "Who have you gone the longest without seeing?",
        longest.name,
        shuffle(seen.slice(1).map((c) => c.name)),
        `It has been about ${daysSince(longest.last)} days since you logged time with ${firstName(longest.name)}.`,
      ),
    );
  }
  return {
    view: "quiz",
    mode: "circle",
    kind: null,
    id: null,
    display_name: null,
    title: "Who's who in your circle?",
    questions: questions.filter((q): q is QuizQuestion => q !== null),
    common_ground: [],
    next: null,
    note: "Built from your private notes and what connections chose to share with you.",
  };
}

function quizView(args: Record<string, unknown>): QuizViewData | null {
  if (typeof args.connection_id !== "string") return circleQuiz();
  const conn = connections.find((c) => c.connection_id === args.connection_id);
  return conn ? friendQuiz(conn) : null;
}

function welcomeView(): WelcomeViewData {
  // The welcome card is for a brand-new user: every step is still open.
  return { view: "welcome", display_name: profile.display_name, goal_options: GOAL_OPTIONS, setup: setupSteps(true) };
}

export function mockInitialView(): ViewData | null {
  switch (demoParam("view")) {
    case "memory_review":
      return reviewView("conversation", DEMO_PROPOSALS, "prop_demo_1");
    case "memory_review_import":
      return reviewView("chatgpt_memory", IMPORT_PROPOSALS, "prop_demo_import");
    case "memory_import":
      return parseView(memoryImportView());
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
    case "people_import":
      return importView();
    case "people_search":
      return searchView("climbing");
    case "group_plan": {
      const view = groupView({ connection_ids: ["c1", "c3"], person_ids: ["p3"] });
      return typeof view === "string" ? null : view;
    }
    case "brief":
      return briefView({ connection_id: "c1" });
    case "brief_person":
      return briefView({ person_id: "p1" });
    case "quiz":
      return quizView({ connection_id: "c1" });
    case "quiz_circle":
      return quizView({});
    case "help":
      return helpView();
    case "dashboard_setup":
      // A user who saved memories but has not added or connected with anyone yet.
      people = [];
      connections = [];
      pending = [];
      return dashboardView();
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
  const noChat = demoParam("nochat") === "1";
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

        case "heldly_help":
          return ok(helpView());

        case "heldly_import_chatgpt_memory":
          return ok(memoryImportView());

        case "heldly_propose_memories": {
          const source: ProposalSource = args.source === "chatgpt_memory" ? "chatgpt_memory" : "conversation";
          const given: Record<string, unknown>[] = Array.isArray(args.memories) ? args.memories : [];
          const seeds: ProposalSeed[] = given.map((m) => ({
            category: (typeof m.category === "string" ? m.category : "PERSONAL_MEMORY") as MemoryCategory,
            title: String(m.title ?? ""),
            description: String(m.description ?? ""),
            tags: list(m.tags) ?? [],
            suggested_visibility: (typeof m.suggested_visibility === "string" ? m.suggested_visibility : "PRIVATE") as Visibility,
          }));
          const fallback = source === "chatgpt_memory" ? IMPORT_PROPOSALS : DEMO_PROPOSALS;
          return ok(reviewView(source, seeds.length > 0 ? seeds : fallback, nextId("prop")));
        }

        case "heldly_save_memories": {
          const approvals: Record<string, unknown>[] = Array.isArray(args.approvals) ? args.approvals : [];
          const review = proposalStore.get(String(args.proposal_id));
          if (!review) return fail("NOT_FOUND: proposal not found or expired");
          const saved: Memory[] = approvals.map((a) => {
            const proposal = review.proposals.find((p) => p.index === a.index);
            return {
              memory_id: nextId("mem"),
              category: proposal?.category ?? "PERSONAL_MEMORY",
              title: String(a.title ?? ""),
              description: String(a.description ?? ""),
              tags: proposal?.tags ?? [],
              visibility: (a.visibility as Visibility) ?? "PRIVATE",
              created_at: new Date().toISOString(),
              source: review.source === "chatgpt_memory" ? "chatgpt_memory" : null,
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
          delete followUps[`person:${String(args.person_id)}`];
          return ok({ deleted: true, person_id: args.person_id });
        }

        case "heldly_remove_connection": {
          if (!connections.some((c) => c.connection_id === args.connection_id)) {
            return fail("NOT_FOUND: connection not found");
          }
          connections = connections.filter((c) => c.connection_id !== args.connection_id);
          delete interactions[`connection:${String(args.connection_id)}`];
          delete followUps[`connection:${String(args.connection_id)}`];
          return ok({ removed: true, connection_id: args.connection_id });
        }

        case "heldly_propose_people_import":
          return ok(importView());

        case "heldly_import_people": {
          const candidates = typeof args.import_id === "string" ? imports.get(args.import_id) : undefined;
          if (!candidates) return fail("NOT_FOUND: this import has expired. Ask Heldly to read the list again.");
          const wanted = new Set(Array.isArray(args.indexes) ? args.indexes : []);
          const imported: Person[] = candidates
            .filter((c) => wanted.has(c.index))
            .map((c) => ({
              person_id: nextId("p"),
              name: c.name,
              relationship: c.relationship,
              notes: c.notes,
              interests: c.interests,
              last_interaction_at: c.last_met_days_ago === null ? null : iso(-c.last_met_days_ago),
              created_at: new Date().toISOString(),
            }));
          if (imported.length === 0) return fail("INVALID_ARGUMENT: pick at least one person");
          people = [...people, ...imported];
          imports.delete(String(args.import_id));
          return ok({ imported, count: imported.length });
        }

        case "heldly_find_people":
          return ok(searchView(args.query));

        case "heldly_plan_group": {
          const view = groupView(args);
          return typeof view === "string" ? fail(view) : ok(view);
        }

        case "heldly_meetup_brief": {
          const view = briefView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "heldly_start_quiz": {
          const view = quizView(args);
          return view ? ok(view) : fail("NOT_FOUND: connection not found");
        }

        case "heldly_add_follow_up": {
          const f = findFriend(args);
          if (!f) return fail("NOT_FOUND: friend not found");
          const body = text(args.text, 200);
          if (!body) return fail("INVALID_ARGUMENT: text is required");
          const followUp: FollowUp = { follow_up_id: nextId("fu"), text: body, created_at: new Date().toISOString() };
          const k = key(f.kind, f.id);
          followUps[k] = [followUp, ...(followUps[k] ?? [])];
          return ok(followUp);
        }

        case "heldly_complete_follow_up": {
          const entry = Object.entries(followUps).find(([, items]) => items.some((i) => i.follow_up_id === args.follow_up_id));
          if (!entry) return fail("NOT_FOUND: follow-up not found");
          followUps[entry[0]] = entry[1].filter((i) => i.follow_up_id !== args.follow_up_id);
          return ok({ done: true, follow_up_id: args.follow_up_id });
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
      return !noChat;
    },
    async openLink(url) {
      console.info("[mock] openLink:", url);
      const opened = window.open(url, "_blank");
      if (opened) opened.opener = null;
      return opened !== null;
    },
  };
}
