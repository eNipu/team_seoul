// In-memory stand-in for the Venn web API, used with `?demo=1`.
// It is stateful for the life of the page: adding a person, saving a memory,
// finishing a plan, loading the sample circle and so on all change what later
// screens show. A reload starts again from the seed below.
//
// Seed = the investor demo: in ChatGPT, Gene saved "Maya and I used to take
// photo walks"; on the website, searching "photography" finds Maya and says why.

import type { Api } from "./api";
import { ApiError } from "./errors";
import { mockQrRows } from "./mockQr";
import type * as T from "./types";

export interface MockOptions {
  /** Start signed out, to see the sign-in screen. */
  signedOut: boolean;
  /** Sign-in also asks for a passcode (the demo passcode is "venn"). */
  passcode: boolean;
  /** Start as a brand-new account with nothing saved. */
  fresh: boolean;
  /** Pretend the server uses an external identity provider. */
  external: boolean;
  /** Whether Google Single Sign-On is enabled on this server (default true in demo). */
  googleSso?: boolean;
}

interface MockFriend {
  kind: T.FriendKind;
  id: string;
  name: string;
  relationship: string | null;
  notes: string | null;
  bio: string | null;
  interests: string[];
  shared: T.SharedMemory[];
  last: string | null;
  since: string;
  isSample: boolean;
  followUps: T.FollowUp[];
  hangouts: T.Interaction[];
}

interface MockLink extends T.QuestionLink {
  person_id: string | null;
}

interface State {
  displayName: string;
  username: string;
  bio: string | null;
  goals: string[];
  memories: T.Memory[];
  friends: MockFriend[];
  requests: (T.PendingRequest & { isSample: boolean })[];
  plans: T.Plan[];
  links: MockLink[];
  responses: T.AnswerResponse[];
  sampleLoaded: boolean;
  inviteExpiresAt: string | null;
  imports: Map<string, { candidates: T.ImportCandidate[]; isSample: boolean; expires: number }>;
}

const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();
const ahead = (days: number, hour: number) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

let seq = 100;
const newId = (prefix: string) => `${prefix}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const QUESTIONS = [
  "What are you into these days?",
  "What's something we should do together?",
  "What's a small treat that always cheers you up?",
  "What should I ask you about next time?",
];

const SITE = "https://venn.example";

function memory(
  id: string,
  category: T.MemoryCategory,
  title: string,
  description: string,
  tags: string[],
  days: number,
  extra: Partial<T.Memory> = {},
): T.Memory {
  return {
    memory_id: id,
    category,
    title,
    description,
    tags,
    visibility: "PRIVATE",
    source: null,
    people: [],
    created_at: ago(days),
    ...extra,
  };
}

function friend(f: Partial<MockFriend> & Pick<MockFriend, "kind" | "id" | "name">): MockFriend {
  return {
    relationship: null,
    notes: null,
    bio: null,
    interests: [],
    shared: [],
    last: null,
    since: ago(200),
    isSample: false,
    followUps: [],
    hangouts: [],
    ...f,
  };
}

function emptyState(displayName: string, username: string): State {
  return {
    displayName,
    username,
    bio: null,
    goals: [],
    memories: [],
    friends: [],
    requests: [],
    plans: [],
    links: [],
    responses: [],
    sampleLoaded: false,
    inviteExpiresAt: null,
    imports: new Map(),
  };
}

function seedState(): State {
  const s = emptyState("Gene", "gene");
  s.bio = "Product person in Seoul. Happiest on a slow walk with a camera.";
  s.goals = ["See old friends more often"];
  s.memories = [
    memory(
      "mem_photo_walks",
      "PERSONAL_MEMORY",
      "Photo walks with Maya",
      "Maya and I used to take photo walks around the old town.",
      ["photography", "walking"],
      2,
      { source: "chatgpt_memory", people: ["Maya"] },
    ),
    memory(
      "mem_film",
      "INTEREST",
      "Film photography",
      "I shoot 35mm film on weekends and develop it at home.",
      ["photography", "film cameras"],
      9,
      { source: "chatgpt_memory", visibility: "SHARED_WITH_CONNECTIONS" },
    ),
    memory("mem_trail", "INTEREST", "Weekend trail runs", "Easy trail runs on Saturday mornings.", ["trail running"], 14, {
      visibility: "SHARED_WITH_CONNECTIONS",
    }),
    memory(
      "mem_games",
      "INTEREST",
      "Board game nights",
      "I like hosting small board game nights, four people at most.",
      ["board games"],
      21,
      { visibility: "SHARED_WITH_CONNECTIONS", people: ["Daniel"] },
    ),
    memory(
      "mem_small_groups",
      "PREFERENCE",
      "Small groups over big parties",
      "I'd rather see two or three people than go to a big gathering.",
      ["small groups"],
      30,
      { source: "chatgpt_memory" },
    ),
    memory(
      "mem_lisbon",
      "EXPERIENCE",
      "A year in Lisbon",
      "I lived in Lisbon for a year and still miss the pastry shops.",
      ["Lisbon", "travel"],
      44,
      { visibility: "PUBLIC_PROFILE", people: ["Sofia"] },
    ),
    memory(
      "mem_goal",
      "SOCIAL_GOAL",
      "See old friends more often",
      "I want to see friends from university at least once a season.",
      [],
      51,
    ),
  ];
  s.friends = [
    friend({
      kind: "person",
      id: "per_maya",
      name: "Maya Chen",
      relationship: "College roommate",
      notes: "Moved back to town last spring. Prefers weekend mornings.",
      interests: ["photography", "pottery", "trail running"],
      last: ago(75),
      since: ago(120),
      followUps: [{ follow_up_id: "fu_maya", text: "Ask about her pottery exhibition", created_at: ago(12) }],
      hangouts: [
        { occurred_at: ago(75), activity: "Coffee near the river" },
        { occurred_at: ago(160), activity: "Photo walk around the old town" },
      ],
    }),
    friend({
      kind: "person",
      id: "per_daniel",
      name: "Daniel Okafor",
      relationship: "Former teammate",
      notes: "Started a new job in March.",
      interests: ["board games", "cycling", "ramen"],
      last: ago(20),
      since: ago(300),
      followUps: [{ follow_up_id: "fu_daniel", text: "Ask how the new job is going", created_at: ago(30) }],
      hangouts: [{ occurred_at: ago(20), activity: "Board games at Daniel's" }],
    }),
    friend({
      kind: "person",
      id: "per_sofia",
      name: "Sofia Rossi",
      relationship: "Friend from Lisbon",
      notes: "Visits in the autumn. Loves anything by the sea.",
      interests: ["travel", "cooking", "swimming"],
      last: ago(40),
      since: ago(260),
      followUps: [{ follow_up_id: "fu_sofia", text: "Send the Lisbon restaurant list", created_at: ago(3) }],
      hangouts: [{ occurred_at: ago(40), activity: "Video call" }],
    }),
    friend({
      kind: "person",
      id: "per_tom",
      name: "Tom Becker",
      relationship: "Neighbour",
      interests: ["gardening", "coffee"],
      since: ago(15),
    }),
    friend({
      kind: "connection",
      id: "con_jun",
      name: "Jun Park",
      bio: "Designer. Collects old cameras and newer hobbies.",
      interests: ["photography", "climbing", "jazz", "architecture"],
      shared: [
        {
          category: "INTEREST",
          title: "Architecture",
          description: "Enjoys spotting Art Deco doorways on walks around town.",
          tags: ["architecture"],
        },
        {
          category: "INTEREST",
          title: "Film photography",
          description: "Shoots medium format and is always up for a darkroom session.",
          tags: ["photography", "film cameras"],
        },
        {
          category: "INTEREST",
          title: "Indoor climbing",
          description: "Climbs twice a week, usually Tuesday evenings.",
          tags: ["climbing"],
        },
      ],
      last: ago(9),
      since: ago(180),
      followUps: [{ follow_up_id: "fu_jun", text: "Return his tripod", created_at: ago(6) }],
      hangouts: [{ occurred_at: ago(9), activity: "Jazz bar" }],
    }),
    friend({
      kind: "connection",
      id: "con_priya",
      name: "Priya Nair",
      bio: "Runs, bakes, reads too many cookbooks.",
      interests: ["trail running", "baking", "board games"],
      shared: [
        {
          category: "INTEREST",
          title: "Trail running",
          description: "Training for a 25 km trail race in the autumn.",
          tags: ["trail running"],
        },
        {
          category: "PREFERENCE",
          title: "Early mornings",
          description: "Prefers meeting before 10 am.",
          tags: ["mornings"],
        },
      ],
      last: ago(48),
      since: ago(90),
      hangouts: [{ occurred_at: ago(48), activity: "Saturday trail run" }],
    }),
  ];
  s.plans = [
    {
      plan_id: "plan_pottery",
      title: "Pottery studio open day with Maya",
      details: "Her studio opens its doors on Saturday. Bring the camera.",
      planned_for: ahead(5, 11),
      status: "planned",
      members: [{ kind: "person", id: "per_maya", display_name: "Maya Chen" }],
      created_at: ago(1),
    },
    {
      plan_id: "plan_games",
      title: "Board games at Daniel's",
      details: null,
      planned_for: ago(20),
      status: "done",
      members: [{ kind: "person", id: "per_daniel", display_name: "Daniel Okafor" }],
      created_at: ago(27),
    },
  ];
  s.links = [
    {
      link_id: "lnk_open",
      for_name: null,
      link: `${SITE}/q/k3v9x2`,
      expires_at: ahead(11, 12),
      responses: 1,
      active: true,
      person_id: null,
    },
    {
      link_id: "lnk_daniel",
      for_name: "Daniel Okafor",
      link: `${SITE}/q/p7m4d8`,
      expires_at: ahead(13, 12),
      responses: 0,
      active: true,
      person_id: "per_daniel",
    },
  ];
  s.responses = [
    {
      response_id: "res_leo",
      name: "Leo",
      received_at: ago(0, 5),
      person_id: null,
      person_name: null,
      items: [
        { key: "into", question: QUESTIONS[0], answer: "Bouldering, sourdough", saves_as: "Interests" },
        { key: "together", question: QUESTIONS[1], answer: "A day hike before it gets cold", saves_as: "Note" },
        { key: "treat", question: QUESTIONS[2], answer: "A flat white and a cardamom bun", saves_as: "Note" },
        { key: "ask", question: QUESTIONS[3], answer: "How the move to the new flat went", saves_as: "Thing to ask" },
      ],
    },
  ];
  return s;
}

/* ----------------------------------------------------------------- helpers */

const STOP = new Set(
  "who do i know that is are into likes like loves love a an the to for with and or of in on my me friends friend people anyone someone knows does enjoy enjoys".split(
    " ",
  ),
);

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/** "photography" also finds "photo walks": compare on a short stem. */
function hit(text: string, token: string): boolean {
  const t = text.toLowerCase();
  return t.includes(token) || (token.length > 5 && t.includes(token.slice(0, 5)));
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
/** Demo connections: identifier, name, headline, extra note, skills. */
const LINKEDIN_DEMO: [string, string, string, string, string[]][] = [
  ["maya-chen", "Maya Chen", "Photographer at Lens Studio", "Based in Berlin, Germany", ["Photography", "Editing"]],
  ["daniel-okafor", "Daniel Okafor", "Product Manager at Northwind", "Based in London, UK", ["Roadmaps", "Fintech"]],
  ["sofia-rossi", "Sofia Rossi", "Founder at Tavola", "Based in Milan, Italy", ["Food", "Startups"]],
  ["kenji-watanabe", "Kenji Watanabe", "Staff Engineer at Hikari", "Based in Tokyo, Japan", ["Rust", "Climbing"]],
  ["amelie-laurent", "Amélie Laurent", "Design Lead at Atelier", "Based in Paris, France", ["Typography"]],
  ["sam-rivera", "Sam Rivera", "Recruiter at Brightside", "Based in Austin, Texas", ["Hiring", "Running"]],
];

// A compact fictional network for the browser-only demo. The live API supplies its own fixture.
const DEMO_NAMES = ["Hana", "Mateo", "Amara", "Tobias", "Yuna", "Priya", "Nico", "Leila", "Adaeze", "Felix"];
const DEMO_SURNAMES = ["Moon", "Ibarra", "Mensah", "Kern", "Baek", "Deshmukh", "Ferretti", "Nassar", "Nwosu", "Moreau"];
const DEMO_ROLES = [
  ["Product designer at Pebbleloom Studio", "accessibility", "design systems"],
  ["Climate data scientist at Rainspoke Analytics", "climate tech", "data visualization"],
  ["Documentary producer at Lantern Field Films", "documentaries", "photography"],
  ["Robotics engineer at Copper Finch Labs", "robotics", "open source"],
  ["UX researcher at Mossbridge Design", "user research", "accessibility"],
  ["Founder at Saffron Grid Energy", "clean energy", "startups"],
  ["Coffee roaster at Second Rill Coffee", "specialty coffee", "cycling"],
  ["Urban planner at Canopy Dial", "urban planning", "public transit"],
  ["Backend engineer at Driftline Systems", "Python", "developer tools"],
  ["Sound designer at Paper Current Audio", "sound design", "independent film"],
];
const INSTAGRAM_NAMES = ["Mara", "Joon", "Nia", "Elias", "Romy", "Devika", "Oscar", "Aya", "Theo", "Lina"];
const INSTAGRAM_SURNAMES = ["Solano", "Park", "Boateng", "Moreno", "Delacroix", "Pillai", "Nilsson", "Matsuda", "Okafor", "Haddad"];
const INSTAGRAM_BIOS = [
  ["Photographs the city before the shop shutters come up", "street photography", "architecture"],
  ["Folds dumplings on Sundays and keeps a freezer stash for friends", "food", "dumplings"],
  ["Paints tiny gouache scenes from the bus window", "art", "gouache"],
  ["Packs a thermos for foggy ridge walks", "hiking", "landscape photography"],
  ["Keeps a sketchbook of favorite scenes from matinees", "independent film", "sketching"],
  ["Shares the records she plays while cooking dinner", "music", "vinyl"],
  ["Makes mismatched mugs and tests glazes on their handles", "ceramics", "pottery"],
  ["Collects fallen leaves for cyanotype prints", "printmaking", "botany"],
  ["Finds quiet bike routes between neighborhood bakeries", "cycling", "baking"],
  ["Cooks from the handwritten margins of a family recipe book", "home cooking", "food photography"],
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v.trim());
  }
  return out;
}

function fail(code: string, message: string, status: number): never {
  throw new ApiError(code, message, status);
}

const IDEA_BANK: Record<string, [string, string, string]> = {
  photography: [
    "Golden-hour photo walk",
    "Pick a neighbourhood, bring one lens each and swap favourites over coffee after.",
    "Suggest this Saturday around 4 pm.",
  ],
  "trail running": [
    "Easy trail loop and brunch",
    "A relaxed 8 km on a nearby trail, then something warm to eat.",
    "Ask which morning suits them.",
  ],
  "board games": [
    "Two-player board game evening",
    "Bring one game each and cook something simple.",
    "Offer a weeknight at your place.",
  ],
  travel: [
    "Plan a day trip together",
    "Pick somewhere under two hours away and split the planning.",
    "Send two options and let them choose.",
  ],
  pottery: [
    "Visit a ceramics studio",
    "Many studios run drop-in sessions on weekends.",
    "Ask if they know a good one.",
  ],
  coffee: ["Try a new café", "Somewhere neither of you has been.", "Suggest a weekday morning."],
};

export function createMockApi(options: MockOptions): Api {
  let state: State = options.fresh ? emptyState("Gene", "gene") : seedState();
  let signedIn = !options.signedOut && !options.external;
  /** Accounts that exist; anything else needs the explicit "Create account" step. */
  const accounts = new Map<string, string>([["gene", "Gene"]]);

  const wait = <R>(value: () => R): Promise<R> =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          if (!signedIn) fail("UNAUTHENTICATED", "Please sign in.", 401);
          resolve(value());
        } catch (e) {
          reject(e);
        }
      }, 90);
    });
  const open = <R>(value: () => R): Promise<R> =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          resolve(value());
        } catch (e) {
          reject(e);
        }
      }, 90);
    });

  const myInterests = () =>
    unique(
      state.memories
        .filter((m) => ["INTEREST", "PERSONAL_MEMORY", "EXPERIENCE"].includes(m.category))
        .flatMap((m) => m.tags),
    );
  const sharedWith = (f: MockFriend) => {
    const mine = myInterests();
    return f.interests.filter((i) => mine.some((m) => same(m, i)));
  };
  const find = (kind: T.FriendKind, id: string): MockFriend => {
    const f = state.friends.find((x) => x.kind === kind && x.id === id);
    if (!f) fail("NOT_FOUND", kind === "person" ? "person not found" : "connection not found", 404);
    return f;
  };
  const toPerson = (f: MockFriend): T.Person => ({
    person_id: f.id,
    name: f.name,
    relationship: f.relationship,
    notes: f.notes,
    interests: [...f.interests],
    last_interaction_at: f.last,
    created_at: f.since,
    is_sample: f.isSample,
  });
  const profile = (): T.Profile => ({
    user_id: `usr_${state.username}`,
    display_name: state.displayName,
    bio: state.bio,
    social_goals: [...state.goals],
    interests: myInterests(),
    memory_count: state.memories.length,
    profile_visibility: "CONNECTIONS",
  });
  const setup = (): T.SetupStep[] => [
    {
      key: "about_you",
      title: "Save something about you",
      description: "An interest, a preference or a memory. You choose who can see it.",
      done: state.memories.some((m) => m.source !== "sample"),
    },
    {
      key: "your_people",
      title: "Add the people you care about",
      description: "A name is enough. Notes stay private to you.",
      done: state.friends.some((f) => !f.isSample),
    },
    {
      key: "connect",
      title: "Connect with a friend on Venn",
      description: "Optional. Friends don't need to join for Venn to be useful.",
      done: state.friends.some((f) => f.kind === "connection" && !f.isSample) ||
        state.requests.some((r) => !r.isSample) || Date.parse(state.inviteExpiresAt ?? "") > Date.now(),
    },
  ];

  function addPerson(input: T.PersonInput, isSample = false): MockFriend {
    const name = input.name.trim();
    if (!name) fail("INVALID_REQUEST", "A name is required.", 400);
    const days = input.last_met_days_ago;
    const f = friend({
      kind: "person",
      id: newId("per"),
      name,
      relationship: input.relationship?.trim() || null,
      notes: input.notes?.trim() || null,
      interests: unique(input.interests ?? []),
      last: typeof days === "number" && days >= 0 ? ago(days) : null,
      since: new Date().toISOString(),
      isSample,
      hangouts: typeof days === "number" && days >= 0 ? [{ occurred_at: ago(days), activity: null }] : [],
    });
    state.friends.push(f);
    return f;
  }

  /** A typed name matches someone in the circle by full name or first name. */
  const knows = (name: string) => state.friends.some((f) => same(f.name, name) || same(first(f.name), name));

  function ideasFor(f: MockFriend): T.ActivitySuggestion[] {
    const shared = sharedWith(f);
    const out: T.ActivitySuggestion[] = [];
    for (const topic of [...shared, ...f.interests]) {
      const idea = IDEA_BANK[topic.toLowerCase()];
      if (idea && !out.some((o) => o.title === idea[0])) {
        out.push({ title: idea[0], description: idea[1], grounded_in: [topic], suggested_action: idea[2] });
      }
    }
    if (out.length < 2) {
      out.push({
        title: `Coffee and a proper catch-up with ${first(f.name)}`,
        description: "An hour, somewhere quiet, no agenda.",
        grounded_in: [],
        suggested_action: "Offer two times and let them pick.",
      });
    }
    return out.slice(0, 3);
  }

  function logHangout(f: MockFriend, activity: string | null): void {
    const now = new Date().toISOString();
    f.last = now;
    f.hangouts.unshift({ occurred_at: now, activity });
  }

  const api: Api = {
    /* ------------------------------------------------------------ sign-in */
    getSession: () =>
      open(() => {
        const googleSso = options.googleSso ?? true;
        const devAvailable = !options.external;
        return {
          signed_in: signedIn,
          auth_mode: options.external ? "jwt" : "dev",
          sign_in_available: googleSso || devAvailable,
          google_sso_available: googleSso,
          dev_sign_in_available: devAvailable,
          passcode_required: devAvailable && options.passcode,
          display_name: signedIn ? state.displayName : null,
          username: signedIn ? state.username : null,
        };
      }),
    signInWithGoogle: (mode) =>
      open(() => {
        if (mode === "signup") {
          state = emptyState("Maya Chen", "maya@gmail.com");
          accounts.set("maya@gmail.com", "Maya Chen");
          signedIn = true;
          return {
            signed_in: true,
            user_id: "usr_google_maya",
            display_name: "Maya Chen",
            username: "maya@gmail.com",
            created: true,
          };
        }
        state = options.fresh ? emptyState("Gene", "gene@gmail.com") : seedState();
        state.username = "gene@gmail.com";
        signedIn = true;
        return {
          signed_in: true,
          user_id: "usr_google_gene",
          display_name: state.displayName,
          username: state.username,
          created: false,
        };
      }),
    signIn: (input) =>
      open(() => {
        const username = input.username.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(username)) {
          fail("INVALID_REQUEST", "Usernames are 2–32 characters: lower-case letters, digits, . _ -", 400);
        }
        if (options.passcode && input.passcode !== "venn") {
          if (input.passcode === "locked") fail("RATE_LIMITED", "Too many attempts. Try again in a minute.", 429);
          fail("UNAUTHENTICATED", "That passcode isn't right. (The demo passcode is “venn”.)", 401);
        }
        let created = false;
        if (!accounts.has(username)) {
          if (!input.create) fail("NOT_FOUND", "no account with that username", 404);
          const displayName = input.display_name?.trim() || username;
          accounts.set(username, displayName);
          state = emptyState(displayName, username);
          created = true;
        } else if (state.username !== username) {
          state = emptyState(accounts.get(username) ?? username, username);
        }
        signedIn = true;
        return {
          signed_in: true,
          user_id: `usr_${username}`,
          display_name: state.displayName,
          username,
          created,
        };
      }),
    signOut: () =>
      open(() => {
        signedIn = false;
      }),

    /* ------------------------------------------------------------ account */
    getMe: () =>
      wait(() => ({
        user_id: `usr_${state.username}`,
        display_name: state.displayName,
        username: state.username,
        auth_mode: "dev",
        mcp_url: `${window.location.origin}/mcp`,
        profile: profile(),
      })),
    updateMe: (patch) =>
      wait(() => {
        if (patch.display_name !== undefined) {
          const name = patch.display_name.trim();
          if (!name) fail("INVALID_REQUEST", "Your name can't be empty.", 400);
          state.displayName = name;
          accounts.set(state.username, name);
        }
        if (patch.bio !== undefined) state.bio = patch.bio.trim() || null;
        if (patch.social_goals !== undefined) state.goals = unique(patch.social_goals);
        return profile();
      }),
    deleteAccount: (confirmation) =>
      wait(() => {
        if (confirmation !== "DELETE MY VENN ACCOUNT") {
          fail("INVALID_REQUEST", "Type the confirmation phrase exactly.", 400);
        }
        accounts.delete(state.username);
        state = emptyState("", "");
        signedIn = false;
      }),
    getHome: () =>
      wait((): T.Home => {
        if (state.memories.length === 0 && state.friends.length === 0 && state.plans.length === 0) {
          return {
            view: "welcome",
            display_name: state.displayName,
            goal_options: [
              { value: "reconnect", label: "Reconnect with old friends" },
              { value: "plan", label: "Plan more get-togethers" },
              { value: "remember", label: "Remember the small things" },
            ],
            setup: setup(),
            sample_loaded: false,
          };
        }
        return {
          view: "dashboard",
          profile: profile(),
          memories: state.memories.map((m) => ({ ...m })),
          connections: state.friends
            .filter((f) => f.kind === "connection")
            .map((f) => ({
              connection_id: f.id,
              user_id: `usr_${f.id}`,
              display_name: f.name,
              since: f.since,
              last_interaction_at: f.last,
              is_sample: f.isSample,
            })),
          people: state.friends.filter((f) => f.kind === "person").map(toPerson),
          pending_requests: state.requests.map(({ isSample: _s, ...r }) => r),
          setup: setup(),
          plans: state.plans
            .filter((p) => p.status === "planned")
            .sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999")),
          pending_answers: state.responses.length,
          sample_loaded: state.sampleLoaded || state.friends.some((f) => f.isSample),
        };
      }),
    getCircleIdea: () =>
      wait((): T.CircleIdeaResponse => {
        for (const [topic, solo, together] of [
          ["photography", "take a photo walk around the old town", "pick a street and each photograph a different detail"],
          ["board games", "try a new two-player board game", "meet for a three-player board game night"],
        ]) {
          const memory = state.memories.find((m) => m.category === "INTEREST" && !m.people.length && m.tags.includes(topic));
          const matching = state.friends.filter((f) => f.interests.includes(topic) && f.isSample === (memory?.source === "sample"));
          const friend = matching[0];
          if (!memory || !friend) continue;
          const architect = topic === "photography" && state.friends.find((f) => f !== friend && f.isSample === friend.isSample && f.interests.includes("architecture"));
          const extra = architect || matching[1];
          const outing = architect ? "take a neighborhood photo walk and photograph the architecture" : together;
          const person = (f: MockFriend) => ({ kind: f.kind, id: f.id, display_name: f.name });
          return {
            idea: {
              topic, person: person(friend), reason: `You saved “${memory.title}”, and ${friend.name} is into ${topic}.`,
              activity: `You could ${solo}.`, draft: `Hey ${first(friend.name)}, want to ${solo} this weekend?`,
              group: extra ? {
                person: person(extra), reason: architect ? `${extra.name} is into architecture.` : `${extra.name} is also into ${topic}.`,
                activity: `The three of you could ${outing}.`,
                draft: `Hey ${first(friend.name)} and ${first(extra.name)}, want to ${outing} this weekend?`,
              } : null,
            },
          };
        }
        return { idea: null };
      }),
    getHelp: () =>
      wait(() => ({
        view: "help" as const,
        display_name: state.displayName,
        topics: [
          {
            key: "people",
            title: "Keep track of your people",
            description: "Add friends, what they're into and what you want to ask them next time.",
            examples: ["Add a person", "Import a list"],
          },
          {
            key: "search",
            title: "Find the right person",
            description: "Search your circle by interest, place or anything in your notes.",
            examples: ["photography", "who likes board games"],
          },
        ],
        setup: setup(),
        privacy: [
          "Venn only holds what you approved or typed in yourself.",
          "Venn never sends messages for you.",
        ],
        note: "",
      })),

    /* ----------------------------------------------------------- memories */
    listMemories: (p = {}) =>
      wait(() => {
        let list = [...state.memories];
        if (p.category) list = list.filter((m) => m.category === p.category);
        const ts = tokens(p.q ?? "");
        if (ts.length) {
          list = list.filter((m) =>
            ts.every((t) => hit([m.title, m.description, ...m.tags, ...m.people].join(" "), t)),
          );
        }
        return list.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((m) => ({ ...m }));
      }),
    createMemory: (input) =>
      wait(() => {
        const title = input.title.trim();
        const description = input.description.trim();
        if (!title || !description) fail("INVALID_REQUEST", "A memory needs a title and a description.", 400);
        if (/\b(password|passcode|credit card|ssn|diagnos)/i.test(`${title} ${description}`)) {
          fail(
            "PRIVACY_VIOLATION",
            "Venn doesn't save passwords, health or financial details. Remove them and try again.",
            422,
          );
        }
        const people = unique(input.people ?? []);
        const added = people.filter((n) => !knows(n)).map((n) => toPerson(addPerson({ name: n })));
        const m = memory(newId("mem"), input.category, title, description, unique(input.tags ?? []), 0, {
          visibility: input.visibility ?? "PRIVATE",
          people,
          created_at: new Date().toISOString(),
        });
        state.memories.unshift(m);
        return { memory: { ...m }, people_added: added };
      }),
    updateMemory: (id, patch) =>
      wait(() => {
        const m = state.memories.find((x) => x.memory_id === id);
        if (!m) fail("NOT_FOUND", "memory not found", 404);
        if (patch.title !== undefined) {
          if (!patch.title.trim()) fail("INVALID_REQUEST", "The title can't be empty.", 400);
          m.title = patch.title.trim();
        }
        if (patch.description !== undefined) m.description = patch.description.trim();
        if (patch.visibility !== undefined) m.visibility = patch.visibility;
        return { ...m };
      }),
    deleteMemory: (id) =>
      wait(() => {
        if (!state.memories.some((m) => m.memory_id === id)) fail("NOT_FOUND", "memory not found", 404);
        state.memories = state.memories.filter((m) => m.memory_id !== id);
      }),

    /* ------------------------------------------------------------- people */
    listPeople: () => wait(() => state.friends.filter((f) => f.kind === "person").map(toPerson)),
    createPerson: (input) => wait(() => toPerson(addPerson(input))),
    updatePerson: (id, patch) =>
      wait(() => {
        const f = find("person", id);
        if (patch.name !== undefined) {
          if (!patch.name.trim()) fail("INVALID_REQUEST", "A name is required.", 400);
          f.name = patch.name.trim();
        }
        if (patch.relationship !== undefined) f.relationship = patch.relationship.trim() || null;
        if (patch.notes !== undefined) f.notes = patch.notes.trim() || null;
        if (patch.interests !== undefined) f.interests = unique(patch.interests);
        return toPerson(f);
      }),
    deletePerson: (id) =>
      wait(() => {
        find("person", id);
        state.friends = state.friends.filter((f) => !(f.kind === "person" && f.id === id));
        state.plans.forEach((p) => {
          p.members = p.members.filter((m) => !(m.kind === "person" && m.id === id));
        });
      }),
    previewImport: (people, source) =>
      wait(() => {
        if (people.length < 1 || people.length > 50) {
          fail("INVALID_REQUEST", "Import between 1 and 50 people at a time.", 400);
        }
        const candidates: T.ImportCandidate[] = people
          .filter((p) => p.name.trim() !== "")
          .map((p, index) => ({
            index,
            name: p.name.trim(),
            relationship: p.relationship?.trim() || null,
            notes: p.notes?.trim() || null,
            interests: unique(p.interests ?? []),
            last_met_days_ago: p.last_met_days_ago ?? null,
            already_added: state.friends.some((f) => f.kind === "person" && !f.isSample && same(f.name, p.name)),
          }));
        const importId = newId("imp");
        const expires = Date.now() + DAY;
        state.imports.set(importId, { candidates, isSample: false, expires });
        return {
          view: "people_import" as const,
          import_id: importId,
          expires_at: new Date(expires).toISOString(),
          source: source ?? null,
          candidates,
          skipped: people.length - candidates.length,
          note: "Nothing is added until you choose who to import.",
        };
      }),
    linkedinConnections: (cookies) =>
      wait(() => {
        if (!cookies.includes("li_at") && cookies.trim().length < 20) {
          fail("INVALID_REQUEST", "These cookies do not include li_at, LinkedIn's sign-in cookie.", 400);
        }
        const connections = LINKEDIN_DEMO.map(([public_identifier, name, headline], i) => ({
          public_identifier,
          name,
          headline,
          profile_url: `https://www.linkedin.com/in/${public_identifier}`,
          connected_on: ago(20 + i * 37).slice(0, 10),
          already_added: state.friends.some((f) => f.kind === "person" && !f.isSample && same(f.name, name)),
        }));
        return {
          connections,
          count: connections.length,
          total: null,
          truncated: true,
          stopped:
            "LinkedIn signed this session out (it cleared li_at) after the first pages. What was read is below.",
          details_available: true,
          max_details: 25,
          max_import: 50,
        };
      }),
    linkedinExport: (csv) =>
      wait(() => {
        if (!/first name/i.test(csv)) {
          fail("INVALID_REQUEST", "This file does not look like a LinkedIn connections export.", 400);
        }
        const connections = LINKEDIN_DEMO.slice(0, 4).map(([public_identifier, name, headline]) => ({
          public_identifier,
          name,
          headline,
          profile_url: `https://www.linkedin.com/in/${public_identifier}`,
          connected_on: null,
          already_added: state.friends.some((f) => f.kind === "person" && !f.isSample && same(f.name, name)),
        }));
        return {
          connections,
          count: connections.length,
          total: connections.length,
          truncated: false,
          stopped: null,
          details_available: true,
          max_details: 25,
          max_import: 50,
        };
      }),
    linkedinPreview: (people) =>
      wait(() => {
        const candidates: T.ImportCandidate[] = people.map((p, index) => {
          const demo = LINKEDIN_DEMO.find(([id]) => id === p.public_identifier);
          return {
            index,
            name: p.name,
            relationship: "LinkedIn connection",
            notes: [p.headline, demo?.[3]].filter(Boolean).join(". ") + ".",
            interests: demo?.[4] ?? [],
            last_met_days_ago: null,
            already_added: state.friends.some((f) => f.kind === "person" && !f.isSample && same(f.name, p.name)),
          };
        });
        const importId = newId("imp");
        const expires = Date.now() + DAY;
        state.imports.set(importId, { candidates, isSample: false, expires });
        return {
          view: "people_import" as const,
          import_id: importId,
          expires_at: new Date(expires).toISOString(),
          source: "linkedin",
          candidates,
          skipped: 0,
          note: "",
          details_for: candidates.length,
          details_error: null,
        };
      }),
    demoPeoplePreview: (platform) =>
      wait(() => {
        const instagram = platform === "instagram";
        const names = instagram ? INSTAGRAM_NAMES : DEMO_NAMES;
        const surnames = instagram ? INSTAGRAM_SURNAMES : DEMO_SURNAMES;
        const bios = instagram ? INSTAGRAM_BIOS : DEMO_ROLES;
        const relationship = instagram ? "Instagram connection" : "LinkedIn connection";
        const candidates = surnames.flatMap((_, group) =>
          names.map((firstName, i): T.ImportCandidate => {
            const name = `${firstName} ${surnames[(i + group) % surnames.length]}`;
            const [bio, ...interests] = bios[(i + 3 * group) % bios.length];
            return {
              index: group * names.length + i,
              name,
              relationship,
              notes: `${bio}.`,
              interests,
              already_added: state.friends.some((f) => f.kind === "person" && same(f.name, name)),
              last_met_days_ago: null,
            };
          }),
        );
        const importId = newId("imp");
        const expires = Date.now() + DAY;
        state.imports.set(importId, { candidates, isSample: true, expires });
        return {
          view: "people_import" as const,
          import_id: importId,
          expires_at: new Date(expires).toISOString(),
          source: `${platform}_demo`,
          candidates,
          skipped: 0,
          note: "Nothing is added until you confirm.",
        };
      }),
    importPeople: (importId, indexes) =>
      wait(() => {
        const proposal = state.imports.get(importId);
        if (!proposal) fail("NOT_FOUND", "This import is no longer available. Prepare a new one.", 404);
        if (proposal.expires < Date.now()) fail("INVALID_REQUEST", "This import expired. Propose a new one.", 400);
        const { candidates, isSample } = proposal;
        const limit = isSample ? 100 : 50;
        if (indexes.length === 0 || indexes.length > limit || indexes.some((i) => !candidates[i])) {
          fail("INVALID_REQUEST", `Choose between 1 and ${limit} people from this review.`, 400);
        }
        const selected = candidates.filter(
          (c) => indexes.includes(c.index) &&
            !(isSample && state.friends.some((f) => f.kind === "person" && same(f.name, c.name))),
        );
        if (state.friends.filter((f) => f.kind === "person").length + selected.length > 500) {
          fail("INVALID_REQUEST", "You can keep notes on up to 500 people.", 400);
        }
        const imported = selected.map((c) =>
          toPerson(
            addPerson(
              {
                name: c.name,
                relationship: c.relationship ?? undefined,
                notes: c.notes ?? undefined,
                interests: c.interests,
                last_met_days_ago: c.last_met_days_ago ?? undefined,
              },
              isSample,
            ),
          ),
        );
        state.imports.delete(importId);
        return imported;
      }),

    /* ------------------------------------------------------------ friends */
    listFriends: () =>
      wait(() =>
        state.friends.map((f) => ({
          kind: f.kind,
          id: f.id,
          display_name: f.name,
          on_venn: f.kind === "connection",
          relationship: f.relationship,
          interests: [...f.interests],
          last_interaction_at: f.last,
          since: f.since,
          is_sample: f.isSample,
          open_follow_ups: f.followUps.length,
        })),
      ),
    getFriend: (kind, id) =>
      wait(() => {
        const f = find(kind, id);
        return {
          view: "friend" as const,
          kind: f.kind,
          id: f.id,
          display_name: f.name,
          on_venn: f.kind === "connection",
          since: f.since,
          last_interaction_at: f.last,
          bio: f.bio,
          relationship: f.relationship,
          notes: f.notes,
          interests: [...f.interests],
          shared_interests: sharedWith(f),
          shared_memories: f.shared.map((m) => ({ ...m })),
          recent_interactions: f.hangouts.slice(0, 5),
          follow_ups: f.followUps.map((x) => ({ ...x })),
          is_sample: f.isSample,
        };
      }),
    getVenn: (kind, id) =>
      wait(() => {
        const f = find(kind, id);
        const shared = sharedWith(f);
        const mine = myInterests().filter((m) => !shared.some((s) => same(s, m)));
        const theirs = f.interests.filter((i) => !shared.some((s) => same(s, i)));
        const n = first(f.name);
        return {
          view: "venn" as const,
          kind: f.kind,
          id: f.id,
          display_name: f.name,
          on_venn: f.kind === "connection",
          you_only: mine.slice(0, 8),
          shared: shared.slice(0, 8),
          them_only: theirs.slice(0, 8),
          summary:
            shared.length === 0
              ? `Nothing in common with ${n} on record yet.`
              : `You and ${n} share ${shared.length} ${shared.length === 1 ? "thing" : "things"}.`,
          suggestions: ideasFor(f)
            .filter((i) => i.grounded_in.some((g) => shared.some((s) => same(s, g))))
            .slice(0, 2),
          note:
            f.kind === "connection"
              ? `${n}'s side is what ${n} chose to share with you.`
              : `${n}'s side comes from your own notes.`,
        };
      }),
    getIdeas: (kind, id) =>
      wait(() => {
        const f = find(kind, id);
        const shared = sharedWith(f);
        return {
          view: "activity_ideas" as const,
          kind: f.kind,
          id: f.id,
          display_name: f.name,
          shared_interests: shared,
          match_score: Math.min(1, shared.length / 3),
          score_explanation: shared.map((s) => `You both like ${s}.`),
          suggestions: ideasFor(f),
          note: "Ideas come from what's saved in Venn. Nothing is booked or sent.",
        };
      }),
    getBrief: (kind, id) =>
      wait(() => {
        const f = find(kind, id);
        const shared = sharedWith(f);
        const n = first(f.name);
        const starters = [
          ...shared.map((s) => `You're both into ${s} — ask what ${n} has been up to with it lately.`),
          ...f.interests
            .filter((i) => !shared.some((s) => same(s, i)))
            .slice(0, 2)
            .map((i) => `Ask how ${i} is going.`),
          ...state.memories
            .filter((m) => m.people.some((p) => same(p, f.name) || same(p, n)))
            .slice(0, 1)
            .map((m) => `Bring up “${m.title}”.`),
        ];
        const days = f.last ? Math.floor((Date.now() - new Date(f.last).getTime()) / DAY) : null;
        return {
          view: "brief" as const,
          kind: f.kind,
          id: f.id,
          display_name: f.name,
          on_venn: f.kind === "connection",
          relationship: f.relationship,
          notes: f.notes,
          last_interaction_at: f.last,
          last_activity: f.hangouts[0]?.activity ?? null,
          days_since_last_interaction: days,
          interests: [...f.interests],
          shared_interests: shared,
          shared_memories: f.shared.map((m) => ({ ...m })),
          things_to_ask: f.followUps.map((x) => ({ ...x })),
          conversation_starters: starters.slice(0, 4),
          note: "A private brief for you. Venn never contacts your friends.",
        };
      }),
    logInteraction: (kind, id, activity) =>
      wait(() => {
        logHangout(find(kind, id), activity?.trim() || null);
      }),
    addFollowUp: (kind, id, text) =>
      wait(() => {
        const f = find(kind, id);
        const t = text.trim();
        if (!t) fail("INVALID_REQUEST", "Write what you want to follow up on.", 400);
        if (t.length > 200) fail("INVALID_REQUEST", "Keep a follow-up under 200 characters.", 400);
        const fu = { follow_up_id: newId("fu"), text: t, created_at: new Date().toISOString() };
        f.followUps.push(fu);
        return { ...fu };
      }),

    /* ------------------------------------------- search, this week, etc. */
    search: (q) =>
      wait(() => {
        const ts = tokens(q);
        const results: T.SearchResult[] = [];
        const matchingMemories = ts.length
          ? state.memories.filter((m) => ts.some((t) => hit([m.title, m.description, ...m.tags].join(" "), t)))
          : [];
        if (ts.length) {
          for (const f of state.friends) {
            const n = first(f.name);
            const fromMemory = matchingMemories.find((m) => m.people.some((p) => same(p, f.name) || same(p, n)));
            const interests = f.interests.filter((i) => ts.some((t) => hit(i, t)));
            const shared = f.shared.find((m) => ts.some((t) => hit([m.title, m.description, ...m.tags].join(" "), t)));
            const inNotes = ts.some((t) => hit([f.notes ?? "", f.relationship ?? "", f.bio ?? ""].join(" "), t));
            const byName = ts.some((t) => hit(f.name, t));
            if (!fromMemory && !interests.length && !shared && !inNotes && !byName) continue;
            let why: string;
            if (fromMemory) why = `From your memory “${fromMemory.title}”.`;
            else if (shared) why = `${n} shared “${shared.title}”.`;
            else if (interests.length) why = `Your notes list “${interests[0]}”.`;
            else if (inNotes) why = `Your notes about ${n} mention it.`;
            else why = "The name matches.";
            results.push({
              kind: f.kind,
              id: f.id,
              display_name: f.name,
              on_venn: f.kind === "connection",
              relationship: f.relationship,
              matched: unique([...interests, ...(shared ? shared.tags.filter((t) => ts.some((x) => hit(t, x))) : [])]),
              snippet: fromMemory ? fromMemory.description : (shared?.description ?? null),
              why,
              last_interaction_at: f.last,
              is_sample: f.isSample,
            });
          }
        }
        // People found through one of your own memories come first.
        results.sort((a, b) => Number(b.why.startsWith("From your memory")) - Number(a.why.startsWith("From your memory")));
        return {
          view: "people_search" as const,
          query: q,
          results,
          count: results.length,
          searched: state.friends.length,
          memories: matchingMemories.slice(0, 5).map((m) => ({ ...m })),
          note: "Search looks at your notes, your saved memories and what connections shared with you.",
        };
      }),
    getThisWeek: () =>
      wait(() => {
        const actions: T.WeekAction[] = [];
        const used = new Set<string>();
        const daysOf = (f: MockFriend) => (f.last ? Math.floor((Date.now() - new Date(f.last).getTime()) / DAY) : -1);
        const overdue = [...state.friends].filter((f) => daysOf(f) >= 45).sort((a, b) => daysOf(b) - daysOf(a))[0];
        if (overdue) {
          const n = first(overdue.name);
          const topic = sharedWith(overdue)[0];
          used.add(overdue.id);
          actions.push({
            type: "reach_out",
            kind: overdue.kind,
            id: overdue.id,
            display_name: overdue.name,
            title: `Reach out to ${n}`,
            reason: `No logged hangout in ${daysOf(overdue)} days.`,
            draft_message: `Hi ${n}! It's been too long. Want to catch up soon${
              topic ? ` — maybe something around ${topic}` : ""
            }?`,
            follow_up: null,
            suggestion: null,
          });
        }
        const open = state.friends.flatMap((f) => f.followUps.map((fu) => ({ f, fu })))
          .sort((a, b) => a.fu.created_at.localeCompare(b.fu.created_at));
        const pending = open.find(({ f }) => !used.has(f.id)) ?? open[0];
        if (pending) {
          used.add(pending.f.id);
          actions.push({
            type: "follow_up",
            kind: pending.f.kind,
            id: pending.f.id,
            display_name: pending.f.name,
            title: `Follow up with ${first(pending.f.name)}`,
            reason: `You wanted to: ${pending.fu.text.charAt(0).toLowerCase()}${pending.fu.text.slice(1)}.`,
            draft_message: null,
            follow_up: { ...pending.fu },
            suggestion: null,
          });
        }
        const planFriend = state.friends.find(
          (f) =>
            !used.has(f.id) &&
            sharedWith(f).length > 0 &&
            !state.plans.some((p) => p.status === "planned" && p.members.some((m) => m.id === f.id)),
        );
        if (planFriend) {
          const idea = ideasFor(planFriend)[0];
          actions.push({
            type: "plan",
            kind: planFriend.kind,
            id: planFriend.id,
            display_name: planFriend.name,
            title: `Plan something with ${first(planFriend.name)}`,
            reason: `You both like ${sharedWith(planFriend)[0]}.`,
            draft_message: null,
            follow_up: null,
            suggestion: idea,
          });
        }
        return {
          view: "this_week" as const,
          actions,
          empty_reason: actions.length
            ? null
            : "Nothing is due this week. Add a person or log a hangout and Venn will suggest what to do next.",
          note: "Venn never sends anything for you.",
        };
      }),
    getReconnect: () =>
      wait(() => ({
        view: "reconnect" as const,
        min_days: 30,
        candidates: state.friends
          .filter((f) => f.last && Date.now() - new Date(f.last).getTime() >= 30 * DAY)
          .map((f) => {
            const days = Math.floor((Date.now() - new Date(f.last as string).getTime()) / DAY);
            return {
              kind: f.kind,
              id: f.id,
              display_name: f.name,
              days_since_last_interaction: days,
              last_activity: f.hangouts[0]?.activity ?? null,
              reason: `No logged hangout in ${days} days.`,
              suggested_activity: ideasFor(f)[0].title,
            };
          })
          .sort((a, b) => b.days_since_last_interaction - a.days_since_last_interaction),
      })),
    getQuiz: () =>
      wait(() => {
        const pool = state.friends.filter((f) => f.interests.length > 0);
        return {
          view: "quiz" as const,
          mode: "circle",
          title: "Who's who in your circle?",
          questions: pool.slice(0, 4).map((f) => {
            const others = pool.filter((o) => o.id !== f.id).slice(0, 2);
            return {
              prompt: `Who is into ${f.interests[0]}?`,
              options: [f.name, ...others.map((o) => o.name)],
              answer_index: 0,
              explanation: `${first(f.name)}'s interests include ${f.interests[0]}.`,
            };
          }),
          note: "",
        };
      }),

    /* ---------------------------------------------------------- follow-ups */
    listFollowUps: () =>
      wait(() =>
        state.friends
          .flatMap((f) => f.followUps.map((fu) => ({ ...fu, kind: f.kind, id: f.id, display_name: f.name })))
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      ),
    completeFollowUp: (id) =>
      wait(() => {
        const f = state.friends.find((x) => x.followUps.some((fu) => fu.follow_up_id === id));
        if (!f) fail("NOT_FOUND", "follow-up not found", 404);
        f.followUps = f.followUps.filter((fu) => fu.follow_up_id !== id);
      }),

    /* --------------------------------------------------------------- plans */
    listPlans: (status = "planned") =>
      wait(() =>
        state.plans
          .filter((p) => status === "all" || p.status === status)
          .map((p) => ({ ...p, members: p.members.map((m) => ({ ...m })) })),
      ),
    createPlan: (input) =>
      wait(() => {
        const title = input.title.trim();
        if (!title) fail("INVALID_REQUEST", "A plan needs a title.", 400);
        if (title.length > 120) fail("INVALID_REQUEST", "Keep the title under 120 characters.", 400);
        const members: T.PlanMember[] = [
          ...(input.connection_ids ?? []).map((id) => find("connection", id)),
          ...(input.person_ids ?? []).map((id) => find("person", id)),
        ].map((f) => ({ kind: f.kind, id: f.id, display_name: f.name }));
        if (members.length > 6) fail("INVALID_REQUEST", "A plan can have at most 6 friends.", 400);
        const plan: T.Plan = {
          plan_id: newId("plan"),
          title,
          details: input.details?.trim() || null,
          planned_for: input.planned_for || null,
          status: "planned",
          members,
          created_at: new Date().toISOString(),
        };
        state.plans.unshift(plan);
        return { ...plan };
      }),
    completePlan: (id) =>
      wait(() => {
        const plan = state.plans.find((p) => p.plan_id === id);
        if (!plan) fail("NOT_FOUND", "plan not found", 404);
        plan.status = "done";
        let logged = 0;
        for (const m of plan.members) {
          const f = state.friends.find((x) => x.kind === m.kind && x.id === m.id);
          if (f) {
            logHangout(f, plan.title);
            logged++;
          }
        }
        return { logged };
      }),
    deletePlan: (id) =>
      wait(() => {
        if (!state.plans.some((p) => p.plan_id === id)) fail("NOT_FOUND", "plan not found", 404);
        state.plans = state.plans.filter((p) => p.plan_id !== id);
      }),

    /* ---------------------------------------------------------- connecting */
    createInvite: (maxUses = 1) =>
      wait(() => {
        const code = `VENN-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const link = `${SITE}/join/${code}`;
        state.inviteExpiresAt = ahead(7, 12);
        return {
          view: "invite" as const,
          code,
          expires_at: state.inviteExpiresAt,
          max_uses: maxUses,
          share_text: `I'm using Venn to keep up with friends. Connect with me: ${link} (code ${code})`,
          note: "Send this yourself. Venn never contacts anyone for you.",
          link,
          qr: mockQrRows(link),
        };
      }),
    redeemInvite: (code) =>
      wait(() => {
        const c = code.trim().toUpperCase();
        if (!/^VENN-[A-Z0-9]{4}$/.test(c)) {
          fail("NOT_FOUND", "That code isn't valid or has expired. Check it with your friend.", 404);
        }
        return {
          status: "pending",
          request_id: newId("req"),
          inviter_display_name: "Hana Kim",
          message: "Request sent to Hana Kim. You'll be connected once they accept.",
        };
      }),
    respondRequest: (id, accept) =>
      wait(() => {
        const r = state.requests.find((x) => x.request_id === id);
        if (!r) fail("NOT_FOUND", "request not found", 404);
        state.requests = state.requests.filter((x) => x.request_id !== id);
        if (!accept) return { request_id: id, status: "declined", connection_id: null };
        const f = friend({
          kind: "connection",
          id: newId("con"),
          name: r.sender_display_name,
          bio: "New on Venn.",
          interests: ["cycling", "coffee"],
          since: new Date().toISOString(),
          isSample: r.isSample,
        });
        state.friends.push(f);
        return { request_id: id, status: "accepted", connection_id: f.id };
      }),

    /* ------------------------------------------------------------- answers */
    createQuestionLink: (input) =>
      wait(() => {
        const person = input.person_id ? find("person", input.person_id) : null;
        const forName = person?.name ?? (input.name?.trim() || null);
        const link = `${SITE}/q/${Math.random().toString(36).slice(2, 8)}`;
        const l: MockLink = {
          link_id: newId("lnk"),
          for_name: forName,
          link,
          expires_at: ahead(14, 12),
          responses: 0,
          active: true,
          person_id: person?.id ?? null,
        };
        state.links.unshift(l);
        return {
          view: "ask_link" as const,
          link_id: l.link_id,
          link,
          qr: mockQrRows(link),
          expires_at: l.expires_at,
          for_name: forName,
          share_text: `${forName ? `Hi ${first(forName)}! ` : ""}I'm trying to be a better friend. Would you answer four quick questions for me? ${link}`,
          questions: QUESTIONS,
          max_responses: person ? 1 : 10,
          note: "Answers wait for your review. Nothing is saved to your notes until you approve it.",
        };
      }),
    revokeQuestionLink: (id) =>
      wait(() => {
        const l = state.links.find((x) => x.link_id === id);
        if (!l) fail("NOT_FOUND", "link not found", 404);
        l.active = false;
      }),
    getAnswers: () =>
      wait(() => ({
        view: "answers" as const,
        responses: state.responses.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i })) })),
        links: state.links.map(({ person_id: _p, ...l }) => l),
        note: "Nothing here is in your notes yet. Choose what to keep.",
      })),
    saveAnswers: (id, keys, name) =>
      wait(() => {
        const r = state.responses.find((x) => x.response_id === id);
        if (!r) fail("NOT_FOUND", "response not found", 404);
        let f = r.person_id ? state.friends.find((x) => x.kind === "person" && x.id === r.person_id) : undefined;
        if (!f) {
          const n = (name ?? r.name).trim();
          if (!n) fail("INVALID_REQUEST", "Give this person a name.", 400);
          if (n.length > 80) fail("INVALID_REQUEST", "Keep the name under 80 characters.", 400);
          f = state.friends.find((x) => x.kind === "person" && same(x.name, n)) ?? addPerson({ name: n });
        }
        const chosen = r.items.filter((i) => keys.includes(i.key));
        const added: string[] = [];
        let followUp: T.FollowUp | null = null;
        for (const item of chosen) {
          if (item.key === "into") {
            for (const i of item.answer.split(/,|;|\band\b/)) {
              const v = i.trim().toLowerCase();
              if (v && !f.interests.some((x) => same(x, v))) {
                f.interests.push(v);
                added.push(v);
              }
            }
          } else if (item.key === "ask") {
            followUp = { follow_up_id: newId("fu"), text: `Ask: ${item.answer}`, created_at: new Date().toISOString() };
            f.followUps.push(followUp);
          } else {
            const line = `${item.key === "together" ? "Wants to do together" : "A treat they like"}: ${item.answer}`;
            f.notes = f.notes ? `${f.notes}\n${line}` : line;
          }
        }
        state.responses = state.responses.filter((x) => x.response_id !== id);
        return { saved: true, response_id: id, person: toPerson(f), added_interests: added, follow_up: followUp };
      }),
    discardAnswers: (id) =>
      wait(() => {
        if (!state.responses.some((x) => x.response_id === id)) fail("NOT_FOUND", "response not found", 404);
        state.responses = state.responses.filter((x) => x.response_id !== id);
      }),

    /* -------------------------------------------------------------- sample */
    loadSample: () =>
      wait(() => {
        if (state.sampleLoaded) fail("INVALID_REQUEST", "The sample friends are already loaded.", 400);
        const connections = [
          friend({
            kind: "connection",
            id: newId("con"),
            name: "Alex Rivera",
            bio: "Sample friend. Weekend hiker and amateur barista.",
            interests: ["hiking", "coffee", "photography"],
            shared: [
              {
                category: "INTEREST",
                title: "Sunrise hikes",
                description: "Up before dawn most Sundays.",
                tags: ["hiking"],
              },
            ],
            last: ago(62),
            since: ago(1),
            isSample: true,
            hangouts: [{ occurred_at: ago(62), activity: "Sunrise hike" }],
          }),
          friend({
            kind: "connection",
            id: newId("con"),
            name: "Sam Lee",
            bio: "Sample friend. Cooks for a crowd.",
            interests: ["cooking", "board games", "karaoke"],
            shared: [
              {
                category: "INTEREST",
                title: "Dinner parties",
                description: "Hosts a big dinner once a month.",
                tags: ["cooking"],
              },
            ],
            last: ago(18),
            since: ago(1),
            isSample: true,
            hangouts: [{ occurred_at: ago(18), activity: "Dinner at Sam's" }],
          }),
        ];
        state.friends.push(...connections);
        const people = [
          addPerson(
            { name: "Noor Haddad", relationship: "Cousin", interests: ["film", "baking"], last_met_days_ago: 95 },
            true,
          ),
          addPerson(
            {
              name: "Ben Carter",
              relationship: "Climbing partner",
              interests: ["climbing", "trail running"],
              last_met_days_ago: 11,
            },
            true,
          ),
          addPerson({ name: "Mina Sato", relationship: "Old colleague", interests: ["travel", "tea"] }, true),
        ];
        people[0].followUps.push({ follow_up_id: newId("fu"), text: "Ask about the film festival", created_at: ago(4) });
        state.requests.push({
          request_id: newId("req"),
          sender_display_name: "Riley Brooks",
          created_at: ago(0, 3),
          isSample: true,
        });
        const before = state.memories.length;
        state.memories.push(
          memory("mem_s1", "INTEREST", "Weekend hikes", "Short hikes close to the city.", ["hiking"], 1, {
            source: "sample",
            people: ["Alex"],
          }),
          memory("mem_s2", "INTEREST", "Cooking for friends", "Trying one new recipe a month.", ["cooking"], 1, {
            source: "sample",
            people: ["Sam"],
          }),
        );
        state.sampleLoaded = true;
        return {
          loaded: true,
          connections: connections.length,
          people: people.length,
          pending_requests: 1,
          memories_added: state.memories.length - before,
        };
      }),
    removeSample: () =>
      wait(() => {
        const friends = state.friends.filter((f) => f.isSample);
        const ids = new Set(friends.map((f) => f.id));
        const memories = state.memories.filter((m) => m.source === "sample").length;
        state.friends = state.friends.filter((f) => !f.isSample);
        state.memories = state.memories.filter((m) => m.source !== "sample");
        state.requests = state.requests.filter((r) => !r.isSample);
        for (const [id, proposal] of state.imports) {
          if (proposal.isSample) state.imports.delete(id);
        }
        state.plans.forEach((p) => {
          p.members = p.members.filter((m) => !ids.has(m.id));
        });
        state.sampleLoaded = false;
        return {
          removed: true,
          friends: friends.filter((f) => f.kind !== "person").length,
          people: friends.filter((f) => f.kind === "person").length,
          memories,
        };
      }),
  };
  return api;
}
