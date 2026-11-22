// Local demo harness: used only when the widget is NOT embedded in a host
// (window.parent === window), e.g. during `npm run dev` or when opening dist/index.html.
//
//   ?view=memory_review|dashboard|invite|activity_ideas|reconnect|friend|friend_person|welcome
//         people_import|people_search|group_plan|brief|brief_person|quiz|quiz_circle
//         memory_import|memory_review_import|help|dashboard_setup
//         venn|venn_empty|venn_full|this_week|this_week_empty|ask_link|answers|answers_empty
//         dashboard_sample|dashboard_plans|memory_review_people
//   &tab=profile|memories|friends   initial dashboard tab
//   &theme=light|dark               force a theme (default: prefers-color-scheme)
//   &flaky=1                        every other tool call fails (error/retry UI)
//   &nochat=1                       sendMessage is refused (copy-and-paste fallbacks)
//
// The mock bridge keeps one in-memory store, so the demo stays coherent while
// navigating (a person added on the dashboard is still there after visiting a
// friend view and coming back).

import type { HostBridge, ToolOutcome } from "./mcp/client";
import { previewInterests } from "../../shared/importInterests";
import { mockQrRows } from "./mockQr";
import type {
  ActivityIdeasViewData,
  ActivitySuggestion,
  AnswerItem,
  AnswerResponse,
  AnswersViewData,
  AskLinkViewData,
  Plan,
  PlanMember,
  QuestionLink,
  ThisWeekViewData,
  VennViewData,
  WeekAction,
  BriefViewData,
  Connection,
  DashboardViewData,
  DemoPlatform,
  FollowUp,
  FriendKind,
  FriendViewData,
  GroupPlanViewData,
  HelpTopic,
  HelpViewData,
  ImportCandidate,
  Interaction,
  InterestMatchesViewData,
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
  Reply,
  SavedReply,
  Visibility,
  WelcomeViewData,
} from "./types";
import { firstName, parseView } from "./types";

export const DEMO_VIEWS = [
  "memory_review",
  "weekly_review",
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
  "memory_quick_import",
  "help",
  "dashboard_setup",
  "onboarding_contacts",
  "onboarding_matches",
  "interest_matches",
  "interest_matches_empty",
  "venn",
  "venn_empty",
  "venn_full",
  "this_week",
  "this_week_empty",
  "ask_link",
  "answers",
  "answers_empty",
  "dashboard_sample",
  "dashboard_plans",
  "memory_review_people",
  "reply_advice",
  "reply_nudge",
  "reply_checklist",
  "reply_draft",
  "reply_discussion",
  "reply_thread",
  "saved_replies",
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
    people: [],
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
    people: [],
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
    people: [],
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
    people: [],
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
    people: [],
  },
];

memories.push({
  memory_id: "m6",
  category: "RELATIONSHIP_CONTEXT",
  title: "Photo walks with Maya",
  description: "Maya and I take our cameras out for a photography walk most months, usually ending at a new cafe.",
  tags: ["photography", "ritual"],
  visibility: "PRIVATE",
  created_at: iso(-20),
  source: null,
  people: ["Maya"],
});

let connections: MockConnection[] = [
  {
    connection_id: "c1",
    user_id: "u_jun",
    display_name: "Jun Park",
    since: iso(-64),
    last_interaction_at: iso(-3),
    is_sample: false,
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
    is_sample: false,
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
    is_sample: false,
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
    relationship: "Friend from university",
    notes: "Moved to Busan last year. Birthday in March. Always up for a long phone call on Sundays.",
    interests: ["Indie films", "Baseball", "Cooking"],
    last_interaction_at: iso(-62),
    created_at: iso(-90),
    is_sample: false,
  },
  {
    person_id: "p2",
    name: "Mrs. Choi",
    relationship: "Neighbor",
    notes: "Waters my plants when I travel. Loves persimmons.",
    interests: ["Gardening"],
    last_interaction_at: null,
    created_at: iso(-30),
    is_sample: false,
  },
  {
    person_id: "p3",
    name: "Dohyun Lim",
    relationship: "Climbing buddy from work",
    notes: "Learning to lead climb. Has a rescue dog called Mochi. Knows every craft beer bar in Euljiro.",
    interests: ["Bouldering", "Hiking", "Craft beer"],
    last_interaction_at: iso(-27),
    created_at: iso(-200),
    is_sample: false,
  },
  {
    person_id: "p4",
    name: "Maya Chen",
    relationship: "College roommate",
    notes: "Shoots film on an old Pentax. Just joined a pottery studio in Yeonnam. Training for her first trail race.",
    interests: ["Photography", "Pottery", "Trail running"],
    last_interaction_at: iso(-34),
    created_at: iso(-150),
    is_sample: false,
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

const imports = new Map<string, { candidates: ImportCandidate[]; isSample: boolean; platform: DemoPlatform | null; confirmationToken: string | null }>();

const DEMO_GIVEN_NAMES = ["Nadia", "Lucia", "Anika", "Sana", "Matteo", "Linh", "Ivo", "Farah", "Sacha", "Tariq"];
const DEMO_SURNAMES = {
  instagram: ["Amari", "Kato", "Nordin", "Bello", "Haddad", "Voss", "Duran", "Rahal", "Solis", "Marek"],
  linkedin: ["Ames", "Pereira", "Silva", "Duarte", "Laurent", "Novak", "Qadir", "Verma", "Molina", "Tan"],
};
const DEMO_TOPICS = {
  instagram: [
    ["Film photography", "Architecture", "Walking tours", "Darkroom printing", "Zines"],
    ["Ceramics", "Espresso", "Glaze chemistry", "Surface design", "Tea"],
    ["Plant care", "Container gardening", "Macro photography", "Pollinators", "Nature journaling"],
    ["Food illustration", "Watercolor", "Cookbooks", "Food markets", "Hand lettering"],
    ["Streetwear", "Embroidery", "Upcycling", "Sewing", "Portrait photography"],
  ],
  linkedin: [
    ["UX research", "Interviews", "Accessibility", "Public transit", "Wayfinding"],
    ["Climate tech", "Clean energy", "Cycling", "Weather maps", "Open source"],
    ["Data visualization", "Cartography", "Rail travel", "Data journalism", "Typography"],
    ["Design systems", "Prototyping", "Typography", "Creative coding", "Accessibility"],
    ["Coffee roasting", "Social enterprise", "Mentorship", "Fundraising", "Hosting"],
  ],
};

const invites = new Map<string, { max_uses: number; expires_at: string }>();

type ProposalSeed = Omit<MemoryProposal, "index" | "already_saved" | "people" | "new_people"> & {
  people?: string[];
  new_people?: string[];
};

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
    category: "INTEREST",
    title: "Film photography",
    description: "Takes a film camera on neighborhood photo walks.",
    tags: ["photo walks"],
    suggested_visibility: "PRIVATE",
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

/** Proposals awaiting approval, by proposal_id (what venn_save_memories looks up). */
const PEOPLE_PROPOSALS: ProposalSeed[] = [
  {
    category: "RELATIONSHIP_CONTEXT",
    title: "Maya is training for her first trail race",
    description: "Maya signed up for a 15K trail race in spring and asked me to cheer at the finish.",
    tags: ["running", "support"],
    suggested_visibility: "PRIVATE",
    people: ["Maya"],
  },
  {
    category: "EXPERIENCE",
    title: "Climbing weekend with Jun and Theo",
    description: "Spent a weekend bouldering in Gangwon with Jun and his friend Theo. Want to do it again in autumn.",
    tags: ["bouldering", "trip"],
    suggested_visibility: "SHARED_WITH_CONNECTIONS",
    people: ["Jun", "Theo"],
    new_people: ["Theo"],
  },
  {
    category: "PERSONAL_MEMORY",
    title: "Sunday dinners at Aunt Nari's",
    description: "Aunt Nari and cousin Ben host dinner on the first Sunday of every month.",
    tags: ["family", "ritual"],
    suggested_visibility: "PRIVATE",
    people: ["Nari", "Ben"],
    new_people: ["Nari", "Ben"],
  },
  {
    category: "PREFERENCE",
    title: "Prefers small gatherings",
    description: "Enjoys seeing two or three friends at a time more than big parties.",
    tags: ["social"],
    suggested_visibility: "PRIVATE",
  },
];

const proposalStore = new Map<string, MemoryReviewViewData>();

const WEEKLY_PROPOSALS: ProposalSeed[] = [
  { category: "WORK", title: "Launching our beta in Berlin", description: "We're opening early access next week.", tags: [], suggested_visibility: "PRIVATE" },
  { category: "SOCIAL_GOAL", title: "Looking for a product designer", description: "I'm looking for someone who knows fintech.", tags: [], suggested_visibility: "PRIVATE" },
  { category: "EXPERIENCE", title: "In Lisbon this weekend", description: "I'll be in Lisbon from Friday to Sunday.", tags: [], suggested_visibility: "PRIVATE" },
];

function reviewView(source: ProposalSource, seeds: ProposalSeed[], proposalId: string, weeklyUpdate = false): MemoryReviewViewData {
  const have = new Set(memories.map((m) => m.title.trim().toLowerCase()));
  const view: MemoryReviewViewData = {
    view: "memory_review",
    proposal_id: proposalId,
    expires_at: iso(1),
    source,
    weekly_update: source === "conversation" && weeklyUpdate,
    proposals: seeds.slice(0, 30).map((p, index) => ({
      ...p,
      people: p.people ?? [],
      new_people: (p.new_people ?? []).filter((n) => !knowsName(n)),
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

// Import provenance is separate from is_sample: starter notes have that flag too.
const platformPeople = new Set<string>();
let reviewedAt = 0;

function onboardingState() {
  const approved = memories.filter(m => m.source !== "sample");
  const imported = people.filter(p => platformPeople.has(p.person_id));
  const existedAtReview = (record: { created_at: string }) => Date.parse(record.created_at) <= reviewedAt;
  return {
    memories_ready: approved.length > 0, contacts_ready: imported.length > 0,
    matches_reviewed: approved.some(existedAtReview) && imported.some(existedAtReview),
  };
}

function myInterestLabels() {
  return memories.filter(m => m.category === "INTEREST" && m.source !== "sample" && !m.people.length)
    .flatMap(m => [m.title, ...m.tags]);
}

function interestMatches(limit: number): InterestMatchesViewData {
  const mine = myInterestLabels();
  const eligible = [
    ...people.filter(p => platformPeople.has(p.person_id)).map(p => ({
      kind: "person" as const, id: p.person_id, display_name: p.name, interests: p.interests,
    })),
    // For peers, only explicit interest labels from memories already visible to this connection.
    ...connections.filter(c => !c.is_sample).map(c => ({
      kind: "connection" as const, id: c.connection_id, display_name: c.display_name,
      interests: c.shared_memories.filter(m => m.category === "INTEREST").flatMap(m => [m.title, ...m.tags]),
    })),
  ];
  const matches = eligible.flatMap(({ interests, ...friend }) => {
    const { interest_matches } = previewInterests(mine, interests);
    return interest_matches.length ? [{ ...friend, interest_matches }] : [];
  });
  matches.sort((a, b) => Number(a.interest_matches[0].kind === "related") - Number(b.interest_matches[0].kind === "related")
    || a.display_name.localeCompare(b.display_name) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return { view: "interest_matches", matches: matches.slice(0, limit) };
}

/** Legacy setup data remains available alongside the guided flow. */
function setupSteps(fresh = false): SetupStep[] {
  const connected = !fresh && connections.length > 0;
  return [
    {
      key: "about_you",
      title: "Connect your AI memories",
      description: "One tap. Saved privately.",
      done: !fresh && memories.length > 0,
    },
    {
      key: "your_people",
      title: "Add your person",
      description: "A partner or a friend.",
      done: !fresh && (people.length > 0 || connected),
    },
    {
      key: "connect",
      title: "Send the spark",
      description: "Invite them to Venn.",
      done: connected,
    },
  ];
}

const HELP_TOPICS: HelpTopic[] = [
  {
    key: "setup",
    title: "Getting set up",
    description: "Review memories, choose contacts from Instagram or LinkedIn previews, then see which interests overlap.",
    examples: ["Set up Venn"],
  },
  {
    key: "memories",
    title: "Remember what matters to you",
    description: "Venn suggests memories from what you say; you choose what to keep and who can see it.",
    examples: ["Remember that I love bouldering and ramen", "Import my ChatGPT memory into Venn", "What did I save about food?"],
  },
  {
    key: "people",
    title: "Keep notes on your people",
    description: "Add friends who are not on Venn, one at a time or a whole list. Notes stay private to you.",
    examples: ["Import my friends into Venn", "Who do I know who likes hiking?"],
  },
  {
    key: "connect",
    title: "Connect with friends on Venn",
    description: "Share an invite code, link or QR. Friends accept before you are connected.",
    examples: ["Create a Venn invite", "I have a Venn invite code"],
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
    examples: ["Play the Venn quiz"],
  },
];

function helpView(): HelpViewData {
  return structuredClone({
    view: "help" as const,
    display_name: profile.display_name,
    topics: HELP_TOPICS,
    onboarding: onboardingState(),
    setup: setupSteps(),
    privacy: [
      "Nothing is saved until you approve it.",
      "Memories are private unless you choose to share them.",
      "Venn never contacts anyone for you.",
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
    connections: connections.map(({ connection_id, user_id, display_name, since, last_interaction_at, is_sample }) => ({
      connection_id,
      user_id,
      display_name,
      since,
      last_interaction_at,
      is_sample,
    })),
    people,
    pending_requests: pending,
    setup: setupSteps(),
    onboarding: onboardingState(),
    plans: openPlans(),
    pending_answers: answerInbox.length,
    sample_loaded: sampleLoaded,
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
      on_venn: true,
      since: f.conn.since,
      last_interaction_at: f.conn.last_interaction_at,
      is_sample: false,
      bio: f.conn.bio,
      relationship: null,
      notes: null,
      shared_memories: f.conn.shared_memories,
    });
  }
  return structuredClone({
    ...base,
    kind: "person" as const,
    on_venn: false,
    since: f.person.created_at,
    last_interaction_at: f.person.last_interaction_at,
    is_sample: false,
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
    note: "Venn only suggests. It never contacts anyone for you.",
  };
}

// --- Contract v2 demo state: sample circle, plans, question links, answers ---

let sampleLoaded = false;
let plans: Plan[] = [];

/** True when a first or full name already belongs to someone in the circle. */
function knowsName(name: string): boolean {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return true;
  const names = [...people.map((p) => p.name), ...connections.map((c) => c.display_name)];
  return names.some((n) => n.toLowerCase() === wanted || firstName(n).toLowerCase() === wanted);
}

function openPlans(): Plan[] {
  const at = (p: Plan) => (p.planned_for ? new Date(p.planned_for).getTime() : Number.POSITIVE_INFINITY);
  return plans.filter((p) => p.status === "planned").sort((a, b) => at(a) - at(b));
}

function planMembers(args: Record<string, unknown>): PlanMember[] {
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const members: PlanMember[] = [];
  for (const id of ids(args.connection_ids)) {
    const c = connections.find((x) => x.connection_id === id);
    if (c) members.push({ kind: "connection", id, display_name: c.display_name });
  }
  for (const id of ids(args.person_ids)) {
    const p = people.find((x) => x.person_id === id);
    if (p) members.push({ kind: "person", id, display_name: p.name });
  }
  return members.slice(0, 6);
}

function seedPlans(): void {
  plans = [
    {
      plan_id: "plan_1",
      title: "Golden-hour photo walk along the Han",
      details: "Bring one camera each, walk from Mangwon to Hapjeong and swap favourite frames over coffee after.",
      planned_for: iso(3),
      status: "planned",
      members: [{ kind: "person", id: "p4", display_name: "Maya Chen" }],
      created_at: iso(-1),
    },
    {
      plan_id: "plan_2",
      title: "Board games and ramen night",
      details: null,
      planned_for: null,
      status: "planned",
      members: [
        { kind: "connection", id: "c1", display_name: "Jun Park" },
        { kind: "connection", id: "c3", display_name: "Mina Seo" },
        { kind: "person", id: "p3", display_name: "Dohyun Lim" },
      ],
      created_at: iso(-4),
    },
  ];
}

const SAMPLE_CONNECTIONS: MockConnection[] = [
  {
    connection_id: "sample_c1",
    user_id: "u_sample_priya",
    display_name: "Priya Nair",
    since: iso(-200),
    last_interaction_at: iso(-12),
    is_sample: true,
    bio: "Product designer who plans her weekends around a good trail and a better bakery.",
    interests: ["Hiking", "Specialty coffee", "Ceramics", "Podcasts"],
    shared_memories: [
      {
        category: "EXPERIENCE",
        title: "Sunrise hike on Inwangsan",
        description: "Starts most Saturdays on a ridge before the city wakes up.",
        tags: ["hiking", "mornings"],
      },
    ],
  },
  {
    connection_id: "sample_c2",
    user_id: "u_sample_leo",
    display_name: "Leo Martins",
    since: iso(-420),
    last_interaction_at: iso(-48),
    is_sample: true,
    bio: "Sound engineer, weeknight climber, keeps a list of every film he has walked out of.",
    interests: ["Bouldering", "Indie films", "Vinyl records"],
    shared_memories: [
      {
        category: "INTEREST",
        title: "Midnight screenings",
        description: "Never says no to a late showing at an independent cinema.",
        tags: ["films"],
      },
    ],
  },
];

const SAMPLE_PEOPLE: Person[] = [
  {
    person_id: "sample_p1",
    name: "Noor Haddad",
    relationship: "Old coworker",
    notes: "Left for a startup in spring. Makes her own hot sauce. Always asks about my climbing.",
    interests: ["Cooking", "Bouldering", "Road trips"],
    last_interaction_at: iso(-75),
    created_at: iso(-300),
    is_sample: true,
  },
  {
    person_id: "sample_p2",
    name: "Sam Okafor",
    relationship: "Cousin",
    notes: "Studying architecture in Daegu. Visits Seoul every few months.",
    interests: ["Sketching", "Basketball"],
    last_interaction_at: null,
    created_at: iso(-120),
    is_sample: true,
  },
];

const SAMPLE_MEMORIES: Memory[] = [
  {
    memory_id: "sample_m1",
    category: "RELATIONSHIP_CONTEXT",
    title: "Trail breakfasts with Priya",
    description: "Priya and I end every hike at the same bakery and split a cinnamon roll.",
    tags: ["hiking", "ritual"],
    visibility: "PRIVATE",
    created_at: iso(-9),
    source: "sample",
    people: ["Priya"],
  },
  {
    memory_id: "sample_m2",
    category: "PERSONAL_MEMORY",
    title: "Noor's farewell dinner",
    description: "Promised Noor a climbing session once her new job settles down.",
    tags: ["promise"],
    visibility: "PRIVATE",
    created_at: iso(-70),
    source: "sample",
    people: ["Noor"],
  },
];

function loadSampleCircle() {
  if (connections.some((c) => c.is_sample)) {
    return { loaded: true, connections: 0, people: 0, pending_requests: 0, memories_added: 0 };
  }
  sampleLoaded = true;
  const addMemories = memories.length === 0;
  connections = [...connections, ...structuredClone(SAMPLE_CONNECTIONS)];
  people = [...people, ...structuredClone(SAMPLE_PEOPLE)];
  if (addMemories) memories = structuredClone(SAMPLE_MEMORIES);
  pending = [...pending, { request_id: "sample_r1", sender_display_name: "Elena Rossi (sample)", created_at: iso(-1) }];
  followUps["connection:sample_c1"] = [
    { follow_up_id: "sample_fu1", text: "Ask Priya how the ceramics show went", created_at: iso(-5) },
  ];
  interactions["connection:sample_c1"] = [
    { activity: "Sunrise hike and bakery stop", occurred_at: iso(-12) },
  ];
  return {
    loaded: true,
    connections: SAMPLE_CONNECTIONS.length,
    people: SAMPLE_PEOPLE.length,
    pending_requests: 1,
    memories_added: addMemories ? SAMPLE_MEMORIES.length : 0,
  };
}

function removeSampleCircle() {
  const friends = connections.filter((c) => c.is_sample).length;
  const persons = people.filter((p) => p.is_sample).length;
  const mems = memories.filter((m) => m.source === "sample").length;
  const gone = new Set([
    ...connections.filter((c) => c.is_sample).map((c) => key("connection", c.connection_id)),
    ...people.filter((p) => p.is_sample).map((p) => key("person", p.person_id)),
  ]);
  connections = connections.filter((c) => !c.is_sample);
  people = people.filter((p) => !p.is_sample);
  memories = memories.filter((m) => m.source !== "sample");
  pending = pending.filter((r) => !r.request_id.startsWith("sample_"));
  for (const k of gone) {
    delete followUps[k];
    delete interactions[k];
  }
  plans = plans
    .map((p) => ({ ...p, had: p.members.length, members: p.members.filter((m) => !gone.has(key(m.kind, m.id))) }))
    .filter((p) => p.had === 0 || p.members.length > 0)
    .map(({ had: _had, ...p }) => p);
  for (const [id, proposal] of imports) {
    if (proposal.isSample) imports.delete(id);
  }
  platformPeople.clear();
  reviewedAt = 0;
  sampleLoaded = false;
  rememberGuidedProgress();
  return { removed: true, friends, people: persons, memories: mems };
}

const VENN_NOTE = "Built from your profile and what you know or were shown about them. Venn only suggests.";

function vennView(args: Record<string, unknown>): VennViewData | null {
  const f = findFriend(args);
  if (!f) return null;
  const first = firstName(f.name);
  const shared = overlap(profile.interests, f.interests);
  const sharedSet = new Set(lower(shared));
  const youOnly = profile.interests.filter((i) => !sharedSet.has(i.toLowerCase()));
  const themOnly = f.interests.filter((i) => !sharedSet.has(i.toLowerCase()));
  const grounded = shared
    .map((s) => IDEA_TEMPLATES[s.toLowerCase()])
    .filter((t): t is (name: string) => ActivitySuggestion => typeof t === "function")
    .map((t) => t(first));
  const summary =
    shared.length === 0
      ? `Nothing in common on record yet. Ask ${first} about ${themOnly[0] ? themOnly[0].toLowerCase() : "what they are into"}.`
      : shared.length === 1
        ? `You and ${first} both love ${shared[0]!.toLowerCase()}.`
        : `You and ${first} share ${shared.length} things, starting with ${shared[0]!.toLowerCase()} and ${shared[1]!.toLowerCase()}.`;
  return {
    view: "venn",
    kind: f.kind,
    id: f.id,
    display_name: f.name,
    on_venn: f.kind === "connection",
    you_only: youOnly.slice(0, 8),
    shared: shared.slice(0, 8),
    them_only: themOnly.slice(0, 8),
    summary,
    suggestions: [...grounded, ...GENERAL_IDEAS(first)].slice(0, 2),
    note: VENN_NOTE,
  };
}

/** A crowded diagram for layout checks: eight labels in every region. */
function vennFullView(): VennViewData {
  return {
    view: "venn",
    kind: "connection",
    id: "c1",
    display_name: "Jun Park",
    on_venn: true,
    you_only: ["Specialty coffee", "Hiking", "Film photography", "Sourdough baking", "Morning runs", "Jazz bars", "Language exchange", "Houseplants"],
    shared: ["Bouldering", "Indie films", "Ramen", "Night markets", "Road trips", "Karaoke", "Camping", "Street food"],
    them_only: ["Board games", "Mechanical keyboards", "Baseball", "Craft beer", "Cycling", "Woodworking", "Sci-fi novels", "Chess"],
    summary: "You and Jun share 8 things, starting with bouldering and indie films.",
    suggestions: [IDEA_TEMPLATES.bouldering!("Jun"), IDEA_TEMPLATES["indie films"]!("Jun")],
    note: VENN_NOTE,
  };
}

function thisWeekView(): ThisWeekViewData {
  const note = "Venn never sends anything for you.";
  const all = [
    ...connections.map((c) => ({ kind: "connection" as const, id: c.connection_id, name: c.display_name, interests: c.interests, last: c.last_interaction_at })),
    ...people.map((p) => ({ kind: "person" as const, id: p.person_id, name: p.name, interests: p.interests, last: p.last_interaction_at })),
  ];
  if (all.length === 0) {
    return {
      view: "this_week",
      actions: [],
      empty_reason: "Add a few people first. Venn will then suggest who to reach out to each week.",
      note,
    };
  }
  const actions: WeekAction[] = [];
  const used = new Set<string>();

  const quiet = all
    .filter((f) => f.last !== null && daysSince(f.last) >= MIN_RECONNECT_DAYS)
    .sort((a, b) => daysSince(b.last!) - daysSince(a.last!))[0];
  if (quiet) {
    const first = firstName(quiet.name);
    const topic = quiet.interests[0]?.toLowerCase();
    used.add(key(quiet.kind, quiet.id));
    actions.push({
      type: "reach_out",
      kind: quiet.kind,
      id: quiet.id,
      display_name: quiet.name,
      title: `Check in with ${first}`,
      reason: `You last caught up ${daysSince(quiet.last!)} days ago.`,
      draft_message: `Hey ${first}! It's been too long. ${topic ? `Still into ${topic}? ` : ""}I'd love to catch up. Are you free for a call this weekend?`,
      follow_up: null,
      suggestion: null,
    });
  }

  for (const f of all) {
    const k = key(f.kind, f.id);
    const fu = (followUps[k] ?? [])[0];
    if (!fu || used.has(k)) continue;
    used.add(k);
    actions.push({
      type: "follow_up",
      kind: f.kind,
      id: f.id,
      display_name: f.name,
      title: `Follow up with ${firstName(f.name)}`,
      reason: `You noted this ${daysSince(fu.created_at)} days ago and it is still open.`,
      draft_message: null,
      follow_up: structuredClone(fu),
      suggestion: null,
    });
    break;
  }

  for (const f of all) {
    const k = key(f.kind, f.id);
    if (used.has(k)) continue;
    const shared = overlap(f.interests, profile.interests);
    const template = shared.map((s) => IDEA_TEMPLATES[s.toLowerCase()]).find((t) => typeof t === "function");
    if (!template) continue;
    actions.push({
      type: "plan",
      kind: f.kind,
      id: f.id,
      display_name: f.name,
      title: `Make a plan with ${firstName(f.name)}`,
      reason: `You both like ${shared[0]!.toLowerCase()}.`,
      draft_message: null,
      follow_up: null,
      suggestion: template(firstName(f.name)),
    });
    break;
  }

  return {
    view: "this_week",
    actions: actions.slice(0, 3),
    empty_reason: actions.length === 0 ? "You are all caught up. Nothing needs your attention this week." : null,
    note,
  };
}

const ASK_QUESTIONS: { key: string; question: string; saves_as: string }[] = [
  { key: "into", question: "What are you into lately?", saves_as: "Interests" },
  { key: "together", question: "What would you like us to do together?", saves_as: "Note" },
  { key: "treat", question: "What small thing always makes your day?", saves_as: "Note" },
  { key: "ask", question: "What should I ask you about next time?", saves_as: "Follow-up" },
];

interface MockLink extends QuestionLink {
  person_id: string | null;
}

let questionLinks: MockLink[] = [
  { link_id: "ql_1", for_name: "Maya Chen", person_id: "p4", link: "https://venn.app/q/mAyA7c2k", expires_at: iso(11), responses: 1, active: true },
  { link_id: "ql_2", for_name: null, person_id: null, link: "https://venn.app/q/op3nL1nk", expires_at: iso(5), responses: 1, active: true },
  { link_id: "ql_3", for_name: "Taeyang Kim", person_id: "p1", link: "https://venn.app/q/t4eYang9", expires_at: iso(-3), responses: 0, active: false },
];

const answerItems = (answers: Record<string, string>): AnswerItem[] =>
  ASK_QUESTIONS.filter((q) => answers[q.key]).map((q) => ({ ...q, answer: answers[q.key]! }));

let answerInbox: AnswerResponse[] = [
  {
    response_id: "resp_1",
    name: "Maya",
    received_at: iso(-1),
    person_id: "p4",
    person_name: "Maya Chen",
    items: answerItems({
      into: "Film photography, wheel-thrown pottery, bread baking",
      together: "A sunrise photo walk up Naksan, then breakfast",
      treat: "A handwritten postcard out of nowhere",
      ask: "How my first pottery market stall went",
    }),
  },
  {
    response_id: "resp_2",
    name: "Sora",
    received_at: iso(-2),
    person_id: null,
    person_name: null,
    items: answerItems({
      into: "Bouldering, natural wine",
      together: "Try the new climbing gym in Seongsu",
      ask: "Whether I finally booked the Jeju trip",
    }),
  },
];

function askLinkView(args: Record<string, unknown>): AskLinkViewData | string {
  let forName: string | null = text(args.name, 80) || null;
  let personId: string | null = null;
  if (typeof args.person_id === "string") {
    const person = people.find((p) => p.person_id === args.person_id);
    if (!person) return "NOT_FOUND: person not found";
    forName = person.name;
    personId = person.person_id;
  }
  const token = newCode().toLowerCase();
  const link: MockLink = {
    link_id: nextId("ql"),
    for_name: forName,
    person_id: personId,
    link: `https://venn.app/q/${token}`,
    expires_at: iso(14),
    responses: 0,
    active: true,
  };
  questionLinks = [link, ...questionLinks];
  return {
    view: "ask_link",
    link_id: link.link_id,
    link: link.link,
    qr: mockQrRows(link.link),
    expires_at: link.expires_at,
    for_name: forName,
    share_text: `${forName ? `Hi ${firstName(forName)}! ` : "Hi! "}I'm trying to be a better friend this year. Could you answer four quick questions for me? It takes a minute and you don't need an account: ${link.link}`,
    questions: ASK_QUESTIONS.map((q) => q.question),
    max_responses: forName ? 1 : 5,
    note: "Your friend needs no account. Their answers wait for your review; nothing is saved until you approve it.",
  };
}

function answersView(): AnswersViewData {
  return structuredClone({
    view: "answers" as const,
    responses: answerInbox,
    links: questionLinks.map(({ person_id: _p, ...l }) => l),
    note: "Answers are saved to your private notes only after you approve them.",
  });
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
  const link = `https://venn.app/i/${code}`;
  return {
    view: "invite",
    code,
    link,
    qr: mockQrRows(link),
    expires_at,
    max_uses,
    share_text: `I'm using Venn in ChatGPT to keep in touch. Join me? https://joinvennai.com/i/${code}`,
    note: "Share this code only with people you know. Anyone who uses it can send you a connection request, which you still approve.",
  };
}

// ---------------------------------------------------------------------------
// Import, search, group plan, brief and quiz
// ---------------------------------------------------------------------------


function importView(platform: DemoPlatform | null = null, entries: ImportCandidate[] = IMPORT_CANDIDATES, exportSource: DemoPlatform | null = null): PeopleImportViewData {
  const import_id = nextId("imp");
  const profiles = platform ? DEMO_GIVEN_NAMES.flatMap((first, row) => DEMO_SURNAMES[platform].map((last, col) => ({
    index: row * DEMO_SURNAMES[platform].length + col,
    name: `${first} ${last}`,
    relationship: null,
    notes: null,
    interests: [...DEMO_TOPICS[platform][(row + col) % DEMO_TOPICS[platform].length]],
    last_met_days_ago: null,
  }))) : entries;
  const mine = myInterestLabels();
  const candidates = profiles.map((c) => {
    const matches = people.filter((p) => (platform || !p.is_sample) && p.name.toLowerCase() === c.name.toLowerCase());
    return { ...c, ...previewInterests(mine, c.interests), already_added: matches.length > 0, existing_relationships: matches.flatMap((p) => p.relationship ? [p.relationship] : []) };
  });

  const confirmationToken = platform
    ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    : null;
  imports.set(import_id, { candidates, isSample: platform !== null, platform: platform ?? exportSource, confirmationToken });
  return structuredClone({
    view: "people_import" as const,
    import_id,
    expires_at: iso(1),
    source: platform ? `${platform}_demo` : exportSource ?? "pasted list",
    demo_platform: platform,
    confirmation_token: confirmationToken,
    candidates,
    skipped: platform || entries !== IMPORT_CANDIDATES ? 0 : 1,
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
  const matchingMemories = memories.filter((m) => hit(m.title) || hit(m.description) || m.tags.some(hit) || m.people.some(hit));
  /** The user's own matching memory that names this person, if any. */
  const ownMemoryAbout = (name: string) =>
    matchingMemories.find((m) => m.people.some((n) => n.toLowerCase() === firstName(name).toLowerCase() || n.toLowerCase() === name.toLowerCase()));
  const joinList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

  for (const c of connections) {
    const matched = c.interests.filter(hit);
    const memory = c.shared_memories.find((m) => hit(m.title) || hit(m.description) || m.tags.some(hit));
    if (memory) matched.push(memory.title);
    if (hit(c.display_name)) matched.push("Name");
    const bioHit = hit(c.bio);
    if (matched.length === 0 && !bioHit) continue;
    const own = ownMemoryAbout(c.display_name);
    results.push({
      why: own
        ? `From your memory “${own.title}”.`
        : memory
          ? `They shared “${memory.title}” with you.`
          : matched.length > 0
            ? `Their profile lists ${joinList(matched.filter((m) => m !== "Name"))|| "this name"}.`
            : "Mentioned in their bio.",
      kind: "connection",
      id: c.connection_id,
      display_name: c.display_name,
      on_venn: true,
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
    const own = ownMemoryAbout(p.name);
    if (matched.length === 0 && !own) continue;
    const listed = p.interests.filter(hit);
    results.push({
      why: own
        ? `From your memory “${own.title}”.`
        : listed.length > 0
          ? `Your note lists ${joinList(listed)}.`
          : noteHit
            ? "From your notes about them."
            : hit(p.relationship)
              ? `You noted them as “${p.relationship}”.`
              : "Their name matches.",
      kind: "person",
      id: p.person_id,
      display_name: p.name,
      on_venn: false,
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
    note: "Searched your private notes, your own memories and what connections chose to share with you.",
    memories: matchingMemories.slice(0, 5),
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
    note: "Based on your private notes and what each connection chose to share. Venn never contacts anyone for you.",
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
    on_venn: f.kind === "connection",
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
      question(`How does ${first} describe themselves?`, conn.bio, shuffle(DECOY_BIOS), `That is ${first}'s own bio on Venn.`),
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
  return { view: "welcome", display_name: profile.display_name, goal_options: GOAL_OPTIONS, setup: setupSteps(true), onboarding: onboardingState(), sample_loaded: sampleLoaded };
}

const demoReplies: Record<string, Reply> = {
  reply_nudge: {
    kind: "nudge",
    title: "A photo walk with Maya",
    body: "You mentioned missing the Saturday walks you used to take together.",
  },
  reply_advice: {
    kind: "advice",
    title: "Start with something you share",
    body: "Send Maya a photo from one of your old walks, or mention a place you used to go together. Give her an easy way to reply before suggesting a date.",
  },
  reply_checklist: {
    kind: "checklist",
    title: "Plan an easy photo walk",
    body: "Pick a short route with a café at the end. That gives you somewhere to go if the weather turns.",
    steps: ["Send Maya two possible times.", "Pick a meeting point near the start of the route.", "Send a quick check-in on the day."],
  },
  reply_draft: {
    kind: "draft",
    title: "Invite Maya on a photo walk",
    body: "Hey Maya! I passed our old photo walk spot today and thought of you. Are you up for a short walk and coffee next weekend?",
  },
  reply_discussion: {
    kind: "discussion",
    title: "Reaching out after a long silence",
    body: "A small, specific message can make it easier to reconnect. Start with something you both remember and give Maya room to decide what comes next.",
    question: "What would you like Maya to know when she hears from you?",
  },
  reply_thread: {
    kind: "thread",
    title: "Picking up with Maya",
    body: "You want to reconnect without putting pressure on the first message.",
    entries: [
      { title: "What feels natural", body: "An old photo walk is an easy place to start. Mention the route you used to take together." },
      { title: "How to make it easy to answer", body: "Ask how she’s been and give her time to reply before suggesting a date." },
      { title: "If she wants to meet", body: "Offer a short walk and coffee at a place you both know." },
    ],
  },
};

let savedReplies: SavedReply[] = [];

// Keep a guided rehearsal resumable on reload, scoped to this preview's history entry.
// Unapproved drafts, confirmation tokens and pending import candidates never leave memory.
const guidedDemos = new Set(["welcome", "memory_review_import", "dashboard_setup", "onboarding_contacts", "onboarding_matches"]);
function rememberGuidedProgress() {
  const scenario = demoParam("view") ?? "";
  if (!guidedDemos.has(scenario)) return;
  try {
    window.history.replaceState({ ...window.history.state, vennGuidedDemo: {
      scenario, memories, people, platformPeople: [...platformPeople], reviewedAt, seq, sampleLoaded,
    } }, "");
  } catch { /* Restricted preview hosts still have the in-memory flow. */ }
}

export function mockInitialView(): ViewData | null {
  const initial = scenarioView();
  const scenario = demoParam("view") ?? "";
  if (!guidedDemos.has(scenario)) return initial;
  const snapshot = window.history.state?.vennGuidedDemo;
  if (snapshot?.scenario !== scenario || !Array.isArray(snapshot.platformPeople) || !Number.isSafeInteger(snapshot.seq)) return initial;
  const restored = parseView({ view: "dashboard", memories: snapshot.memories, people: snapshot.people });
  if (restored?.view !== "dashboard") return initial;
  memories = restored.memories;
  people = restored.people;
  platformPeople.clear();
  for (const p of people) if (snapshot.platformPeople.includes(p.person_id)) platformPeople.add(p.person_id);
  seq = Math.max(seq, snapshot.seq);
  reviewedAt = Number.isSafeInteger(snapshot.reviewedAt) ? snapshot.reviewedAt : 0;
  sampleLoaded = snapshot.sampleLoaded === true;
  return scenario === "welcome" && !memories.length && !people.length ? welcomeView() : dashboardView();
}

function scenarioView(): ViewData | null {
  switch (demoParam("view")) {
    case "reply_nudge":
      return { view: "reply", reply: demoReplies.reply_nudge };
    case "reply_advice":
      return { view: "reply", reply: demoReplies.reply_advice };
    case "reply_checklist":
      return { view: "reply", reply: demoReplies.reply_checklist };
    case "reply_draft":
      return { view: "reply", reply: demoReplies.reply_draft };
    case "reply_discussion":
      return { view: "reply", reply: demoReplies.reply_discussion };
    case "reply_thread":
      return { view: "reply", reply: demoReplies.reply_thread };
    case "saved_replies":
      savedReplies = [{ reply_id: "reply_demo_1", reply: demoReplies.reply_draft }];
      return { view: "saved_replies", replies: savedReplies };
    case "memory_review":
      return reviewView("conversation", DEMO_PROPOSALS, "prop_demo_1");
    case "weekly_review":
      return reviewView("conversation", WEEKLY_PROPOSALS, "prop_demo_weekly", true);
    case "preview_review":
      return reviewView("conversation", [{ ...DEMO_PROPOSALS[0], suggested_visibility: "PRIVATE" }], "prop_site_demo");
    case "memory_review_import":
      return reviewView("chatgpt_memory", IMPORT_PROPOSALS, "prop_demo_import");
    case "memory_quick_import":
      return { ...reviewView("chatgpt_memory", IMPORT_PROPOSALS, "prop_demo_quick"), quick_import: true };
    case "memory_import":
      return parseView(memoryImportView());
    case "dashboard":
      return dashboardView();
    case "invite":
      return inviteView(3, "VENN-7K2M");
    case "activity_ideas":
      return activityView({ connection_id: "c1" });
    case "reconnect":
      return reconnectView();
    case "friend":
      return friendView({ connection_id: "c1" });
    case "friend_person":
      return friendView({ person_id: "p1" });
    case "welcome":
      people = [];
      connections = [];
      pending = [];
      memories = [];
      answerInbox = [];
      profile.social_goals = [];
      profile.interests = [];
      profile.bio = null;
      profile.is_new = true;
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
    case "onboarding_matches":
    case "interest_matches":
    case "interest_matches_empty": {
      const empty = demoParam("view") === "interest_matches_empty";
      memories = [{
        memory_id: "onboarding_m1", category: "INTEREST", title: empty ? "Cello" : "Film photography",
        description: empty ? "Learning a new piece on the cello." : "I like to photograph buildings and try specialty coffee.",
        tags: empty ? [] : ["Architecture", "Specialty coffee"], visibility: "PRIVATE", created_at: iso(-2), source: "chatgpt_memory", people: [],
      }];
      connections = [];
      pending = [];
      people = [0, 1].map(col => ({
        person_id: `preview_ig_${col}`, name: `${DEMO_GIVEN_NAMES[0]} ${DEMO_SURNAMES.instagram[col]}`,
        interests: [...DEMO_TOPICS.instagram[col]], notes: null, relationship: null, created_at: iso(-1), last_interaction_at: null, is_sample: true,
      }));
      for (const person of people) platformPeople.add(person.person_id);
      sampleLoaded = true;
      if (demoParam("view") === "onboarding_matches") return dashboardView();
      reviewedAt = Date.now();
      return interestMatches(10);
    }
    case "onboarding_contacts":
    case "dashboard_setup":
      // A user who saved memories but has not added or connected with anyone yet.
      people = [];
      connections = [];
      pending = [];
      return dashboardView();
    case "venn":
      return vennView({ connection_id: "c1" });
    case "venn_empty":
      return vennView({ person_id: "p2" });
    case "venn_full":
      return vennFullView();
    case "this_week":
      return thisWeekView();
    case "this_week_empty":
      people = [];
      connections = [];
      pending = [];
      return thisWeekView();
    case "ask_link": {
      const view = askLinkView({ person_id: "p4" });
      return typeof view === "string" ? null : view;
    }
    case "answers":
      return answersView();
    case "answers_empty":
      answerInbox = [];
      questionLinks = [];
      return answersView();
    case "dashboard_sample":
      loadSampleCircle();
      return dashboardView();
    case "dashboard_plans":
      seedPlans();
      return dashboardView();
    case "memory_review_people":
      return reviewView("conversation", PEOPLE_PROPOSALS, "prop_demo_people");
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

  const ok = (data: unknown, meta?: unknown): ToolOutcome =>
    ({ ok: true, data: structuredClone(data), meta: structuredClone(meta) });
  const fail = (errorText: string): ToolOutcome => ({ ok: false, errorText });

  return {
    isMock: true,
    async callTool(name, args) {
      await delay(450);
      calls += 1;
      console.info("[mock] callTool", name, args);
      if (flaky && calls % 2 === 1) return fail("NETWORK_ERROR: simulated failure (flaky mode). Try again.");

      switch (name) {
        case "venn_show_reply": {
          const view = parseView({ view: "reply", reply: args.reply });
          return view ? ok(view) : fail("INVALID_REQUEST: reply is missing or invalid");
        }
        case "venn_save_reply": {
          const view = parseView({ view: "reply", reply: args.reply });
          if (view?.view !== "reply") return fail("INVALID_REQUEST: reply is missing or invalid");
          const existing = savedReplies.find(({ reply }) => JSON.stringify(reply) === JSON.stringify(view.reply));
          if (existing) return ok({ saved: true, reply_id: existing.reply_id });
          const reply_id = nextId("reply");
          savedReplies = [{ reply_id, reply: view.reply }, ...savedReplies];
          return ok({ saved: true, reply_id });
        }
        case "venn_saved_replies":
          return ok({ view: "saved_replies", count: savedReplies.length }, { replies: savedReplies });
        case "venn_delete_saved_reply":
          if (!savedReplies.some(({ reply_id }) => reply_id === args.reply_id)) return fail("NOT_FOUND: Saved reply not found.");
          savedReplies = savedReplies.filter(({ reply_id }) => reply_id !== args.reply_id);
          return ok({ deleted: true });
        case "venn_show_dashboard":
          return ok(people.length || connections.length || memories.length || pending.length || profile.social_goals.length || openPlans().length || answerInbox.length
            ? dashboardView() : welcomeView());

        case "venn_help":
          return ok(helpView());

        case "venn_import_chatgpt_memory":
          return ok(memoryImportView());

        case "venn_propose_memories": {
          const source: ProposalSource = args.source === "chatgpt_memory" ? "chatgpt_memory" : "conversation";
          const given: Record<string, unknown>[] = Array.isArray(args.suggested) ? args.suggested : [];
          const seeds: ProposalSeed[] = given.map((m) => ({
            category: (typeof m.category === "string" ? m.category : "PERSONAL_MEMORY") as MemoryCategory,
            title: String(m.title ?? ""),
            description: String(m.description ?? ""),
            tags: list(m.tags) ?? [],
            people: list(m.people) ?? [],
            suggested_visibility: (typeof m.suggested_visibility === "string" ? m.suggested_visibility : "PRIVATE") as Visibility,
          }));
          const weeklyUpdate = args.weekly_update === true;
          const fallback = source === "chatgpt_memory" ? IMPORT_PROPOSALS : weeklyUpdate ? WEEKLY_PROPOSALS : DEMO_PROPOSALS;
          return ok(reviewView(source, seeds.length > 0 ? seeds : fallback, nextId("prop"), weeklyUpdate));
        }

        case "mock_preview_photo_memory":
          return ok(reviewView("chatgpt_memory", IMPORT_PROPOSALS.filter(p => p.title === "Film photography"), nextId("prop")));

        case "venn_save_memories": {
          const approvals: Record<string, unknown>[] = Array.isArray(args.approvals) ? args.approvals : [];
          const review = proposalStore.get(String(args.proposal_id));
          if (!review || Date.parse(review.expires_at) <= Date.now()) return fail("NOT_FOUND: proposal not found or expired");
          if (!approvals.length || approvals.some(a => !a || !review.proposals.some(p => p.index === a.index)) ||
              new Set(approvals.map(a => a.index)).size !== approvals.length) {
            return fail("INVALID_ARGUMENT: Choose one or more items from this review.");
          }
          const saved: Memory[] = approvals.map((a) => {
            const proposal = review.proposals.find((p) => p.index === a.index);
            return {
              memory_id: nextId("mem"),
              category: proposal?.category ?? "PERSONAL_MEMORY",
              title: String(a.title ?? proposal?.title ?? ""),
              description: String(a.description ?? proposal?.description ?? ""),
              tags: proposal?.tags ?? [],
              visibility: (a.visibility as Visibility) ?? "PRIVATE",
              created_at: new Date().toISOString(),
              source: review.source === "chatgpt_memory" ? "chatgpt_memory" : null,
              people: proposal?.people ?? [],
            };
          });
          memories = [...memories, ...saved];
          // Approving a memory that names someone new also adds them as a private note.
          const peopleAdded: Person[] = [];
          for (const a of approvals) {
            const proposal = review.proposals.find((p) => p.index === a.index);
            for (const n of proposal?.new_people ?? []) {
              if (knowsName(n)) continue;
              const person: Person = {
                person_id: nextId("p"),
                name: n,
                relationship: null,
                notes: `Mentioned in “${String(a.title ?? proposal?.title ?? "")}”.`,
                interests: [],
                last_interaction_at: null,
                created_at: new Date().toISOString(),
                is_sample: false,
              };
              people = [...people, person];
              peopleAdded.push(person);
            }
          }
          proposalStore.delete(String(args.proposal_id));
          rememberGuidedProgress();
          return ok({ saved, count: saved.length, people_added: peopleAdded });
        }

        case "venn_discard_memory_proposal": {
          const proposalId = String(args.proposal_id);
          proposalStore.delete(proposalId);
          return ok({ discarded: true, proposal_id: proposalId });
        }

        case "venn_update_memory": {
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
          rememberGuidedProgress();
          return ok(m);
        }

        case "venn_delete_memory": {
          if (!memories.some((m) => m.memory_id === args.memory_id)) return fail("NOT_FOUND: memory not found");
          memories = memories.filter((m) => m.memory_id !== args.memory_id);
          if (!onboardingState().memories_ready) reviewedAt = 0;
          rememberGuidedProgress();
          return ok({ deleted: true, memory_id: args.memory_id });
        }

        case "venn_update_profile": {
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

        case "venn_respond_to_connection": {
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
                is_sample: false,
                bio: "Just joined Venn.",
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

        case "venn_create_invite":
          return ok(inviteView(args.max_uses));

        case "venn_revoke_invite": {
          if (typeof args.code !== "string" || !invites.has(args.code)) return fail("NOT_FOUND: invite code not found");
          invites.delete(args.code);
          return ok({ revoked: true });
        }

        case "venn_view_friend": {
          const view = friendView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "venn_suggest_activity": {
          const view = activityView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "venn_reconnection_suggestions":
          return ok(reconnectView());

        case "venn_log_interaction": {
          const f = findFriend(args);
          if (!f) return fail("NOT_FOUND: friend not found");
          const occurred_at = new Date().toISOString();
          const k = key(f.kind, f.id);
          interactions[k] = [{ occurred_at, activity: text(args.activity, 120) || null }, ...(interactions[k] ?? [])];
          if (f.kind === "connection") f.conn.last_interaction_at = occurred_at;
          else f.person.last_interaction_at = occurred_at;
          return ok({ recorded: true, kind: f.kind, id: f.id, last_interaction_at: occurred_at });
        }

        case "venn_add_person": {
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
            is_sample: false,
          };
          people = [...people, person];
          return ok(person);
        }

        case "venn_update_person": {
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
          rememberGuidedProgress();
          return ok(person);
        }

        case "venn_delete_person": {
          if (!people.some((p) => p.person_id === args.person_id)) return fail("NOT_FOUND: person not found");
          people = people.filter((p) => p.person_id !== args.person_id);
          platformPeople.delete(String(args.person_id));
          if (!onboardingState().contacts_ready) reviewedAt = 0;
          rememberGuidedProgress();
          delete interactions[`person:${String(args.person_id)}`];
          delete followUps[`person:${String(args.person_id)}`];
          return ok({ deleted: true, person_id: args.person_id });
        }

        case "venn_remove_connection": {
          if (!connections.some((c) => c.connection_id === args.connection_id)) {
            return fail("NOT_FOUND: connection not found");
          }
          connections = connections.filter((c) => c.connection_id !== args.connection_id);
          delete interactions[`connection:${String(args.connection_id)}`];
          delete followUps[`connection:${String(args.connection_id)}`];
          return ok({ removed: true, connection_id: args.connection_id });
        }

        case "venn_propose_people_import": {
          if (!Array.isArray(args.people)) return ok(importView());
          const entries = args.people.map((person, index) => ({
            index, name: String(person.name), relationship: person.relationship ?? null,
            notes: person.notes ?? null, interests: person.interests ?? [],
            last_met_days_ago: person.last_met_days_ago ?? null, already_added: false,
          }));
          return ok(importView(null, entries, args.source === "instagram" || args.source === "linkedin" ? args.source : null));
        }

        case "venn_preview_demo_people_import": {
          if (args.platform !== "instagram" && args.platform !== "linkedin") {
            return fail("INVALID_ARGUMENT: choose Instagram or LinkedIn");
          }
          const { confirmation_token, ...view } = importView(args.platform);
          return ok(view, { "venn/demoImportConfirmation": confirmation_token });
        }

        case "venn_import_people":
        case "venn_import_demo_people": {
          const proposal = typeof args.import_id === "string" ? imports.get(args.import_id) : undefined;
          if (!proposal) return fail("NOT_FOUND: this import has expired. Open a fresh review.");
          const { candidates, isSample, confirmationToken } = proposal;
          if (isSample !== (name === "venn_import_demo_people")) {
            return fail("INVALID_ARGUMENT: use the Add button on the matching import review card");
          }
          if (isSample && args.confirmation_token !== confirmationToken) {
            return fail("INVALID_ARGUMENT: Open a fresh import review and use its Add button to confirm your selection.");
          }
          const wanted = new Set(Array.isArray(args.indexes) ? args.indexes : []);
          if (!wanted.size) return fail("INVALID_ARGUMENT: pick at least one person");
          const taken = new Set(people.map((p) => p.name.toLowerCase()));
          const imported: Person[] = candidates
            .filter((c) => wanted.has(c.index) && (!isSample || !taken.has(c.name.toLowerCase())))
            .map((c) => ({
              person_id: nextId("p"),
              name: c.name,
              relationship: c.relationship,
              notes: c.notes,
              interests: c.interests,
              last_interaction_at: c.last_met_days_ago === null ? null : iso(-c.last_met_days_ago),
              created_at: new Date().toISOString(),
              is_sample: isSample,
            }));
          people = [...people, ...imported];
          if (isSample && imported.length) sampleLoaded = true;
          if (proposal.platform) for (const person of imported) platformPeople.add(person.person_id);
          imports.delete(String(args.import_id));
          rememberGuidedProgress();
          return ok({ imported, count: imported.length });
        }

        case "venn_find_interest_matches": {
          const state = onboardingState();
          if (!state.memories_ready || !state.contacts_ready) return fail("Approve a memory and confirm an Instagram or LinkedIn contact import first.");
          const limit = args.limit ?? 10;
          if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) return fail("Choose a limit between 1 and 20.");
          reviewedAt = Date.now();
          rememberGuidedProgress();
          return ok(interestMatches(limit));
        }

        case "venn_find_people":
          return ok(searchView(args.query));

        case "venn_plan_group": {
          const view = groupView(args);
          return typeof view === "string" ? fail(view) : ok(view);
        }

        case "venn_meetup_brief": {
          const view = briefView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "venn_start_quiz": {
          const view = quizView(args);
          return view ? ok(view) : fail("NOT_FOUND: connection not found");
        }

        case "venn_add_follow_up": {
          const f = findFriend(args);
          if (!f) return fail("NOT_FOUND: friend not found");
          const body = text(args.text, 200);
          if (!body) return fail("INVALID_ARGUMENT: text is required");
          const followUp: FollowUp = { follow_up_id: nextId("fu"), text: body, created_at: new Date().toISOString() };
          const k = key(f.kind, f.id);
          followUps[k] = [followUp, ...(followUps[k] ?? [])];
          return ok(followUp);
        }

        case "venn_complete_follow_up": {
          const entry = Object.entries(followUps).find(([, items]) => items.some((i) => i.follow_up_id === args.follow_up_id));
          if (!entry) return fail("NOT_FOUND: follow-up not found");
          followUps[entry[0]] = entry[1].filter((i) => i.follow_up_id !== args.follow_up_id);
          return ok({ done: true, follow_up_id: args.follow_up_id });
        }

        case "venn_load_sample_circle":
          return ok(loadSampleCircle());

        case "venn_remove_sample_circle":
          return ok(removeSampleCircle());

        case "venn_compare": {
          const view = vennView(args);
          return view ? ok(view) : fail("NOT_FOUND: friend not found");
        }

        case "venn_this_week":
          return ok(thisWeekView());

        case "venn_create_question_link": {
          const view = askLinkView(args);
          return typeof view === "string" ? fail(view) : ok(view);
        }

        case "venn_review_answers":
          return ok(answersView());

        case "venn_save_answers": {
          const response = answerInbox.find((r) => r.response_id === args.response_id);
          if (!response) return fail("NOT_FOUND: these answers were already handled");
          const keys = new Set(Array.isArray(args.keys) ? args.keys.filter((k): k is string => typeof k === "string") : []);
          const chosen = response.items.filter((i) => keys.has(i.key));
          if (chosen.length === 0) return fail("INVALID_ARGUMENT: choose at least one answer to save");
          let person = response.person_id ? people.find((p) => p.person_id === response.person_id) : undefined;
          if (!person) {
            const personName = text(args.name, 80) || response.name.trim();
            if (!personName) return fail("INVALID_ARGUMENT: name is required");
            person = {
              person_id: nextId("p"),
              name: personName,
              relationship: null,
              notes: null,
              interests: [],
              last_interaction_at: null,
              created_at: new Date().toISOString(),
              is_sample: false,
            };
            people = [...people, person];
          }
          const addedInterests: string[] = [];
          let followUp: FollowUp | null = null;
          for (const item of chosen) {
            if (item.key === "into") {
              const have = new Set(lower(person.interests));
              for (const raw of item.answer.split(/[,;\n]/)) {
                const interest = raw.trim().slice(0, 40);
                if (!interest || have.has(interest.toLowerCase())) continue;
                have.add(interest.toLowerCase());
                addedInterests.push(interest.charAt(0).toUpperCase() + interest.slice(1));
              }
              person.interests = [...person.interests, ...addedInterests];
            } else if (item.key === "ask") {
              const created: FollowUp = { follow_up_id: nextId("fu"), text: `Ask about: ${item.answer}`.slice(0, 200), created_at: new Date().toISOString() };
              const k = key("person", person.person_id);
              followUps[k] = [...(followUps[k] ?? []), created];
              followUp = created;
            } else {
              const line = `${item.key === "together" ? "Wants to" : "Loves"}: ${item.answer}`;
              person.notes = person.notes ? `${person.notes}\n${line}` : line;
            }
          }
          answerInbox = answerInbox.filter((r) => r.response_id !== response.response_id);
          return ok({ saved: true, response_id: response.response_id, person: structuredClone(person), added_interests: addedInterests, follow_up: followUp });
        }

        case "venn_discard_answers": {
          if (!answerInbox.some((r) => r.response_id === args.response_id)) return fail("NOT_FOUND: these answers were already handled");
          answerInbox = answerInbox.filter((r) => r.response_id !== args.response_id);
          return ok({ discarded: true, response_id: args.response_id });
        }

        case "venn_revoke_question_link": {
          const link = questionLinks.find((l) => l.link_id === args.link_id);
          if (!link) return fail("NOT_FOUND: link not found");
          link.active = false;
          return ok({ revoked: true, link_id: link.link_id });
        }

        case "venn_save_plan": {
          const title = text(args.title, 120);
          if (!title) return fail("INVALID_ARGUMENT: title is required");
          let plannedFor: string | null = null;
          if (typeof args.planned_for === "string") {
            const when = new Date(args.planned_for);
            if (Number.isNaN(when.getTime())) return fail("INVALID_ARGUMENT: planned_for must be an ISO date and time");
            plannedFor = when.toISOString();
          }
          const plan: Plan = {
            plan_id: nextId("plan"),
            title,
            details: text(args.details, 500) || null,
            planned_for: plannedFor,
            status: "planned",
            members: planMembers(args),
            created_at: new Date().toISOString(),
          };
          plans = [...plans, plan];
          return ok(structuredClone(plan));
        }

        case "venn_list_plans": {
          const open = openPlans();
          return ok({ plans: structuredClone(open), count: open.length });
        }

        case "venn_complete_plan": {
          const plan = plans.find((p) => p.plan_id === args.plan_id && p.status === "planned");
          if (!plan) return fail("NOT_FOUND: plan not found");
          plan.status = "done";
          const occurred_at = new Date().toISOString();
          let logged = 0;
          for (const m of plan.members) {
            const f = findFriend(m.kind === "person" ? { person_id: m.id } : { connection_id: m.id });
            if (!f) continue;
            const k = key(f.kind, f.id);
            interactions[k] = [{ occurred_at, activity: plan.title }, ...(interactions[k] ?? [])];
            if (f.kind === "connection") f.conn.last_interaction_at = occurred_at;
            else f.person.last_interaction_at = occurred_at;
            logged += 1;
          }
          return ok({ done: true, plan_id: plan.plan_id, logged });
        }

        case "venn_delete_plan": {
          if (!plans.some((p) => p.plan_id === args.plan_id)) return fail("NOT_FOUND: plan not found");
          plans = plans.filter((p) => p.plan_id !== args.plan_id);
          return ok({ deleted: true, plan_id: args.plan_id });
        }

        default:
          return fail(`UNKNOWN_TOOL: the demo doesn't implement ${name}`);
      }
    },
    async updateModelContext(message, structuredContent) {
      console.info("[mock] updateModelContext:", message, structuredContent);
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
