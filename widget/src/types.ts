// Data contract for Venn tool results (structuredContent).
// Everything coming from a tool result is untrusted: the parse* helpers below
// coerce unknown JSON into well-typed objects with safe defaults so React never
// receives non-string children or undefined arrays.

export const MEMORY_CATEGORIES = [
  "INTEREST",
  "DISLIKE",
  "PREFERENCE",
  "EXPERIENCE",
  "PERSONAL_MEMORY",
  "SOCIAL_GOAL",
  "RELATIONSHIP_CONTEXT",
  "WORK",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const VISIBILITIES = ["PRIVATE", "SHARED_WITH_CONNECTIONS", "PUBLIC_PROFILE"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PRIVATE: "Private (only me)",
  SHARED_WITH_CONNECTIONS: "Shared with connections",
  PUBLIC_PROFILE: "Public profile",
};

/** Short labels used on badges. */
export const VISIBILITY_SHORT: Record<Visibility, string> = {
  PRIVATE: "Private",
  SHARED_WITH_CONNECTIONS: "Friends",
  PUBLIC_PROFILE: "Public",
};

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  INTEREST: "Interest",
  DISLIKE: "Dislike",
  PREFERENCE: "Preference",
  EXPERIENCE: "Experience",
  PERSONAL_MEMORY: "Personal memory",
  SOCIAL_GOAL: "Social goal",
  RELATIONSHIP_CONTEXT: "Relationship",
  WORK: "Work & projects",
};

/** Plural labels used as group headings in the dashboard. */
export const CATEGORY_GROUP_LABELS: Record<MemoryCategory, string> = {
  INTEREST: "Interests",
  DISLIKE: "Dislikes",
  PREFERENCE: "Preferences",
  EXPERIENCE: "Experiences",
  PERSONAL_MEMORY: "Personal memories",
  SOCIAL_GOAL: "Social goals",
  RELATIONSHIP_CONTEXT: "Relationships",
  WORK: "Work & projects",
};

export const PROFILE_VISIBILITIES = ["PRIVATE", "CONNECTIONS", "PUBLIC"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const PROFILE_VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  PRIVATE: "Private profile",
  CONNECTIONS: "Visible to friends",
  PUBLIC: "Public profile",
};

/** Input limits shared by the forms (mirrors the server-side validation). */
export const LIMITS = {
  displayName: 60,
  bio: 500,
  memoryTitle: 120,
  memoryDescription: 500,
  personName: 80,
  relationship: 80,
  notes: 1000,
  interestCount: 12,
  interestLength: 40,
  activity: 120,
  goals: 6,
  followUp: 200,
  vennRegion: 8,
  planTitle: 120,
  planDetails: 500,
  planMembers: 6,
  searchQuery: 120,
  groupMin: 2,
  groupMax: 6,
  importAreas: 10,
} as const;

/** A friend is a mutual Venn connection or a private "person" note. */
export const FRIEND_KINDS = ["connection", "person"] as const;
export type FriendKind = (typeof FRIEND_KINDS)[number];

/** Tool argument identifying a friend: `{connection_id}` or `{person_id}`. */
export function friendArg(kind: FriendKind, id: string): Record<string, string> {
  return kind === "person" ? { person_id: id } : { connection_id: id };
}

export interface Memory {
  memory_id: string;
  category: MemoryCategory;
  title: string;
  description: string;
  tags: string[];
  visibility: Visibility;
  created_at: string;
  /** Where the memory came from; null for memories learned in conversation. */
  source: MemorySource | null;
  /** First names of the people this memory is about; empty for most memories. */
  people: string[];
}

/** Sources a memory can be imported from. */
export const MEMORY_SOURCES = ["chatgpt_memory", "sample"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const PROPOSAL_SOURCES = ["conversation", "chatgpt_memory"] as const;
export type ProposalSource = (typeof PROPOSAL_SOURCES)[number];

export interface MemoryProposal {
  index: number;
  category: MemoryCategory;
  title: string;
  description: string;
  tags: string[];
  suggested_visibility: Visibility;
  /** True when Venn already holds this memory; it starts un-approved. */
  already_saved: boolean;
  /** Names this memory is about. */
  people: string[];
  /** Names that approving this memory also adds as private notes. */
  new_people: string[];
}

export interface Profile {
  user_id: string;
  display_name: string;
  bio: string | null;
  social_goals: string[];
  interests: string[];
  memory_count: number;
  profile_visibility: ProfileVisibility;
}

export interface Connection {
  connection_id: string;
  user_id: string;
  display_name: string;
  since: string;
  last_interaction_at: string | null;
  /** Made-up friend from the sample circle. */
  is_sample: boolean;
}

export interface Person {
  person_id: string;
  name: string;
  relationship: string | null;
  notes: string | null;
  interests: string[];
  last_interaction_at: string | null;
  created_at: string;
  /** Made-up person from the sample circle. */
  is_sample: boolean;
}

export interface PendingRequest {
  request_id: string;
  sender_display_name: string;
  created_at: string;
}

export interface MemoryReviewViewData {
  view: "memory_review";
  proposal_id: string;
  expires_at: string;
  source: ProposalSource;
  weekly_update?: boolean;
  proposals: MemoryProposal[];
}

export interface MemoryImportArea {
  value: string;
  label: string;
  description: string;
  selected: boolean;
}

export interface MemoryImportViewData {
  view: "memory_import";
  areas: MemoryImportArea[];
  always_excluded: string;
  imported_count: number;
  max_items: number;
}

/** The three onboarding steps, in the order the server sends them. */
export const SETUP_KEYS = ["about_you", "your_people", "connect"] as const;
export type SetupKey = (typeof SETUP_KEYS)[number];

export interface SetupStep {
  key: SetupKey;
  title: string;
  description: string;
  done: boolean;
}

export interface DashboardViewData {
  view: "dashboard";
  profile: Profile;
  memories: Memory[];
  connections: Connection[];
  people: Person[];
  pending_requests: PendingRequest[];
  /** Onboarding steps; empty when the server did not send any. */
  setup: SetupStep[];
  /** Open plans, soonest first. */
  plans: Plan[];
  /** Answers from question links that wait for review. */
  pending_answers: number;
  /** True while the made-up sample circle is loaded. */
  sample_loaded: boolean;
}

export interface PlanMember {
  kind: FriendKind;
  id: string;
  display_name: string;
}

export interface Plan {
  plan_id: string;
  title: string;
  details: string | null;
  planned_for: string | null;
  status: "planned" | "done";
  members: PlanMember[];
  created_at: string;
}

export interface InviteViewData {
  view: "invite";
  code: string;
  expires_at: string;
  max_uses: number;
  share_text: string;
  note: string;
  /** URL the friend can open; "" when the server did not send one. */
  link: string;
  /** QR rows of '0'/'1' ('1' = dark). Empty when absent or malformed. */
  qr: string[];
}

export interface ActivitySuggestion {
  title: string;
  description: string;
  grounded_in: string[];
  suggested_action: string;
}

export interface ActivityIdeasViewData {
  view: "activity_ideas";
  kind: FriendKind;
  id: string;
  display_name: string;
  shared_interests: string[];
  /** 0..1 (clamped) */
  match_score: number;
  score_explanation: string[];
  suggestions: ActivitySuggestion[];
  note: string;
}

export interface ReconnectCandidate {
  kind: FriendKind;
  id: string;
  display_name: string;
  days_since_last_interaction: number;
  last_activity: string | null;
  reason: string;
  suggested_activity: string;
}

export interface ReconnectViewData {
  view: "reconnect";
  min_days: number;
  candidates: ReconnectCandidate[];
}

/** Something the user wants to ask a friend about next time. */
export interface FollowUp {
  follow_up_id: string;
  text: string;
  created_at: string;
}

export interface SharedMemory {
  category: MemoryCategory;
  title: string;
  description: string;
  tags: string[];
}

export interface Interaction {
  occurred_at: string;
  activity: string | null;
}

export interface FriendViewData {
  view: "friend";
  kind: FriendKind;
  id: string;
  display_name: string;
  on_venn: boolean;
  since: string;
  last_interaction_at: string | null;
  bio: string | null;
  relationship: string | null;
  notes: string | null;
  interests: string[];
  shared_interests: string[];
  shared_memories: SharedMemory[];
  recent_interactions: Interaction[];
  follow_ups: FollowUp[];
}

export interface GoalOption {
  value: string;
  label: string;
}

export interface WelcomeViewData {
  view: "welcome";
  display_name: string;
  goal_options: GoalOption[];
  setup: SetupStep[];
  sample_loaded: boolean;
}

export interface HelpTopic {
  key: string;
  title: string;
  description: string;
  /** Things the user can say; at most 4. */
  examples: string[];
}

export interface HelpViewData {
  view: "help";
  display_name: string;
  topics: HelpTopic[];
  setup: SetupStep[];
  privacy: string[];
  /** Model-facing; never displayed. */
  note: string;
}

export interface ImportCandidate {
  index: number;
  name: string;
  relationship: string | null;
  notes: string | null;
  interests: string[];
  last_met_days_ago: number | null;
  already_added: boolean;
}

export const DEMO_PLATFORM_LABELS = { instagram: "Instagram", linkedin: "LinkedIn" } as const;
export type DemoPlatform = keyof typeof DEMO_PLATFORM_LABELS;

export interface PeopleImportViewData {
  view: "people_import";
  import_id: string;
  expires_at: string;
  source: string | null;
  demo_platform: DemoPlatform | null;
  candidates: ImportCandidate[];
  skipped: number;
  note: string;
}

export interface SearchResult {
  kind: FriendKind;
  id: string;
  display_name: string;
  on_venn: boolean;
  relationship: string | null;
  matched: string[];
  snippet: string | null;
  last_interaction_at: string | null;
  /** One plain sentence saying why this person matched; "" when the server sent none. */
  why: string;
}

export interface PeopleSearchViewData {
  view: "people_search";
  query: string;
  results: SearchResult[];
  count: number;
  searched: number;
  note: string;
  /** The user's own memories that match the query (at most 5). */
  memories: Memory[];
}

export interface GroupMember {
  kind: FriendKind;
  id: string;
  display_name: string;
  interests: string[];
}

export interface PartialOverlap {
  interest: string;
  /** Display names; the user appears as "You". */
  members: string[];
}

export interface GroupPlanViewData {
  view: "group_plan";
  members: GroupMember[];
  common_to_all: string[];
  common_to_some: PartialOverlap[];
  suggestions: ActivitySuggestion[];
  note: string;
}

export interface BriefViewData {
  view: "brief";
  kind: FriendKind;
  id: string;
  display_name: string;
  on_venn: boolean;
  relationship: string | null;
  notes: string | null;
  last_interaction_at: string | null;
  last_activity: string | null;
  days_since_last_interaction: number | null;
  interests: string[];
  shared_interests: string[];
  shared_memories: SharedMemory[];
  things_to_ask: FollowUp[];
  conversation_starters: string[];
  note: string;
}

export interface QuizQuestion {
  prompt: string;
  /** 2 to 4 options. */
  options: string[];
  answer_index: number;
  explanation: string;
}

export interface QuizViewData {
  view: "quiz";
  mode: "friend" | "circle";
  kind: "connection" | null;
  id: string | null;
  display_name: string | null;
  title: string;
  questions: QuizQuestion[];
  common_ground: string[];
  next: { title: string; description: string } | null;
  note: string;
}

export type ViewData =
  | MemoryReviewViewData
  | MemoryImportViewData
  | DashboardViewData
  | InviteViewData
  | ActivityIdeasViewData
  | ReconnectViewData
  | FriendViewData
  | WelcomeViewData
  | PeopleImportViewData
  | PeopleSearchViewData
  | GroupPlanViewData
  | BriefViewData
  | QuizViewData
  | HelpViewData
  | VennViewData
  | ThisWeekViewData
  | AskLinkViewData
  | AnswersViewData
  | ReplyViewData
  | SavedRepliesViewData;

export type Reply = { title: string; body: string } & (
  | { kind: "advice" | "draft" }
  | { kind: "checklist"; steps: string[] }
  | { kind: "discussion"; question: string }
  | { kind: "thread"; entries: { title: string; body: string }[] }
);
export interface ReplyViewData {
  view: "reply";
  reply: Reply;
}
export interface SavedReply {
  reply_id: string;
  reply: Reply;
}
export interface SavedRepliesViewData {
  view: "saved_replies";
  replies: SavedReply[];
}

export type ViewName = ViewData["view"];

// Tool result payloads for non-view tools.
export interface SaveMemoriesResult {
  saved: Memory[];
  count: number;
  /** Private notes created because approved memories named new people. */
  people_added: Person[];
}

// --- Venn card, this week, question links, plans (contract v2) ---

export interface VennViewData {
  view: "venn";
  kind: FriendKind;
  id: string;
  display_name: string;
  on_venn: boolean;
  you_only: string[];
  shared: string[];
  them_only: string[];
  summary: string;
  suggestions: ActivitySuggestion[];
  note: string;
}

export const WEEK_ACTION_TYPES = ["reach_out", "follow_up", "plan"] as const;
export type WeekActionType = (typeof WEEK_ACTION_TYPES)[number];

export interface WeekAction {
  type: WeekActionType;
  kind: FriendKind;
  id: string;
  display_name: string;
  title: string;
  reason: string;
  draft_message: string | null;
  follow_up: FollowUp | null;
  suggestion: ActivitySuggestion | null;
}

export interface ThisWeekViewData {
  view: "this_week";
  actions: WeekAction[];
  empty_reason: string | null;
  note: string;
}

export interface AskLinkViewData {
  view: "ask_link";
  link_id: string;
  link: string;
  qr: string[];
  expires_at: string;
  for_name: string | null;
  share_text: string;
  questions: string[];
  max_responses: number;
  note: string;
}

export interface AnswerItem {
  key: string;
  question: string;
  answer: string;
  saves_as: string;
}

export interface AnswerResponse {
  response_id: string;
  name: string;
  received_at: string;
  person_id: string | null;
  person_name: string | null;
  items: AnswerItem[];
}

export interface QuestionLink {
  link_id: string;
  for_name: string | null;
  link: string;
  expires_at: string;
  responses: number;
  active: boolean;
}

export interface AnswersViewData {
  view: "answers";
  responses: AnswerResponse[];
  links: QuestionLink[];
  note: string;
}

export interface SaveAnswersResult {
  saved: boolean;
  person: Person | null;
  added_interests: string[];
  follow_up: FollowUp | null;
}
export interface DeleteMemoryResult {
  deleted: boolean;
  memory_id: string;
}
export interface RespondConnectionResult {
  request_id: string;
  status: "ACCEPTED" | "REJECTED" | string;
  connection_id: string | null;
}
export interface ImportPeopleResult {
  imported: Person[];
  count: number;
}
export interface LogInteractionResult {
  recorded: boolean;
  kind: FriendKind | null;
  id: string;
  last_interaction_at: string | null;
}

// ---------------------------------------------------------------------------
// Defensive coercion helpers
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

export function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function strArr(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string" && x.trim() !== "");
}
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}
function objs(v: unknown): Obj[] {
  return arr(v).filter(isObj);
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function daysOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.max(0, Math.floor(n));
}

const MAX_QR_MODULES = 177; // QR version 40

/** Keep the QR only when it is a square grid of '0'/'1'; otherwise hide it. */
function parseQr(v: unknown): string[] {
  const rows = arr(v);
  const n = rows.length;
  if (n < 11 || n > MAX_QR_MODULES) return [];
  const out: string[] = [];
  for (const r of rows) {
    if (typeof r !== "string" || r.length !== n || !/^[01]+$/.test(r)) return [];
    out.push(r);
  }
  return out;
}

/** Only http(s) links are ever offered to copy or open. */
function parseLink(v: unknown): string {
  if (typeof v !== "string") return "";
  const link = v.trim();
  return /^https?:\/\/\S+$/i.test(link) ? link : "";
}

/** Missing or malformed → []. Steps with unknown or repeated keys are dropped. */
export function parseSetup(v: unknown): SetupStep[] {
  const seen = new Set<string>();
  const out: SetupStep[] = [];
  for (const s of objs(v)) {
    const key = s.key;
    if (typeof key !== "string" || !(SETUP_KEYS as readonly string[]).includes(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key: key as SetupKey,
      title: str(s.title).trim() || humanize(key),
      description: str(s.description).trim(),
      done: s.done === true,
    });
  }
  return out;
}

const MAX_HELP_TOPICS = 10;
const MAX_HELP_EXAMPLES = 4;

function parseHelpTopics(v: unknown): HelpTopic[] {
  const out: HelpTopic[] = [];
  for (const t of objs(v)) {
    const title = str(t.title).trim();
    if (!title) continue;
    out.push({
      key: str(t.key).trim(),
      title,
      description: str(t.description).trim(),
      examples: strArr(t.examples).slice(0, MAX_HELP_EXAMPLES),
    });
    if (out.length === MAX_HELP_TOPICS) break;
  }
  return out;
}

function parseSharedMemory(m: Obj): SharedMemory {
  return {
    category: oneOf(m.category, MEMORY_CATEGORIES, "PERSONAL_MEMORY"),
    title: str(m.title),
    description: str(m.description),
    tags: strArr(m.tags),
  };
}

function parseSuggestion(s: Obj): ActivitySuggestion {
  return {
    title: str(s.title),
    description: str(s.description),
    grounded_in: strArr(s.grounded_in),
    suggested_action: str(s.suggested_action),
  };
}

export function parseFollowUp(v: unknown): FollowUp {
  const o = isObj(v) ? v : {};
  return { follow_up_id: str(o.follow_up_id), text: str(o.text), created_at: str(o.created_at) };
}

function parseFollowUps(v: unknown): FollowUp[] {
  return objs(v)
    .map(parseFollowUp)
    .filter((f) => f.follow_up_id !== "" && f.text.trim() !== "");
}

function parseQuizQuestion(q: Obj): QuizQuestion | null {
  const raw = arr(q.options);
  const answer = num(q.answer_index, -1);
  // Drop blank options while keeping the answer pointing at the same option.
  const options: string[] = [];
  let answer_index = -1;
  raw.forEach((o, i) => {
    if (typeof o !== "string" || o.trim() === "" || options.length >= 4) return;
    if (i === answer) answer_index = options.length;
    options.push(o);
  });
  const prompt = str(q.prompt);
  if (!prompt || options.length < 2 || answer_index < 0) return null;
  return { prompt, options, answer_index, explanation: str(q.explanation) };
}

export function parseMemory(v: unknown): Memory {
  const o = isObj(v) ? v : {};
  return {
    memory_id: str(o.memory_id),
    category: oneOf(o.category, MEMORY_CATEGORIES, "PERSONAL_MEMORY"),
    title: str(o.title),
    description: str(o.description),
    tags: strArr(o.tags),
    visibility: oneOf(o.visibility, VISIBILITIES, "PRIVATE"),
    created_at: str(o.created_at),
    source: o.source === "chatgpt_memory" || o.source === "sample" ? o.source : null,
    people: cleanNames(o.people),
  };
}

/** Trimmed, non-empty, de-duplicated names. */
function cleanNames(v: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of strArr(v)) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export function parsePlan(v: unknown): Plan {
  const o = isObj(v) ? v : {};
  return {
    plan_id: str(o.plan_id),
    title: str(o.title),
    details: strOrNull(o.details),
    planned_for: strOrNull(o.planned_for),
    status: o.status === "done" ? "done" : "planned",
    members: objs(o.members)
      .map((m) => ({
        kind: oneOf(m.kind, FRIEND_KINDS, "connection"),
        id: str(m.id),
        display_name: str(m.display_name, "Friend") || "Friend",
      }))
      .filter((m) => m.id !== ""),
    created_at: str(o.created_at),
  };
}

function parsePlans(v: unknown): Plan[] {
  return objs(v)
    .map(parsePlan)
    .filter((p) => p.plan_id !== "" && p.title.trim() !== "" && p.status === "planned");
}

function parseQuestionLink(l: Obj): QuestionLink {
  return {
    link_id: str(l.link_id),
    for_name: strOrNull(l.for_name),
    link: parseLink(l.link),
    expires_at: str(l.expires_at),
    responses: Math.max(0, Math.floor(num(l.responses))),
    active: l.active === true,
  };
}

export function parseProfile(v: unknown): Profile {
  const o = isObj(v) ? v : {};
  return {
    user_id: str(o.user_id),
    display_name: str(o.display_name, "You") || "You",
    bio: strOrNull(o.bio),
    social_goals: strArr(o.social_goals),
    interests: strArr(o.interests),
    memory_count: num(o.memory_count),
    profile_visibility: oneOf(o.profile_visibility, PROFILE_VISIBILITIES, "PRIVATE"),
  };
}

function parseConnection(c: Obj): Connection {
  return {
    connection_id: str(c.connection_id),
    user_id: str(c.user_id),
    display_name: str(c.display_name, "Friend") || "Friend",
    since: str(c.since),
    last_interaction_at: strOrNull(c.last_interaction_at),
    is_sample: c.is_sample === true,
  };
}

export function parsePerson(v: unknown): Person {
  const o = isObj(v) ? v : {};
  return {
    person_id: str(o.person_id),
    name: str(o.name, "Friend") || "Friend",
    relationship: strOrNull(o.relationship),
    notes: strOrNull(o.notes),
    interests: strArr(o.interests),
    last_interaction_at: strOrNull(o.last_interaction_at),
    created_at: str(o.created_at),
    is_sample: o.is_sample === true,
  };
}

function parseDashboard(sc: Obj): DashboardViewData {
  return {
    view: "dashboard",
    profile: parseProfile(sc.profile),
    memories: objs(sc.memories).map(parseMemory),
    connections: objs(sc.connections).map(parseConnection),
    people: objs(sc.people).map(parsePerson),
    pending_requests: objs(sc.pending_requests).map((r) => ({
      request_id: str(r.request_id),
      sender_display_name: str(r.sender_display_name, "Someone") || "Someone",
      created_at: str(r.created_at),
    })),
    setup: parseSetup(sc.setup),
    plans: parsePlans(sc.plans),
    pending_answers: Math.max(0, Math.floor(num(sc.pending_answers))),
    sample_loaded: sc.sample_loaded === true,
  };
}

function parseReply(value: unknown): Reply | null {
  if (!isObj(value)) return null;
  const title = strOrNull(value.title);
  const body = strOrNull(value.body);
  if (!title || !body) return null;
  if (value.kind === "advice" || value.kind === "draft") return { kind: value.kind, title, body };
  if (value.kind === "discussion") {
    const question = strOrNull(value.question);
    return question ? { kind: "discussion", title, body, question } : null;
  }
  if (value.kind === "thread") {
    const entries = objs(value.entries).flatMap((entry) => {
      const title = strOrNull(entry.title);
      const body = strOrNull(entry.body);
      return title && body ? [{ title, body }] : [];
    });
    return entries.length >= 2 && entries.length <= 6 ? { kind: "thread", title, body, entries } : null;
  }
  if (value.kind !== "checklist") return null;
  const steps = strArr(value.steps);
  return steps.length ? { kind: "checklist", title, body, steps } : null;
}

/** Parse the tool result and any widget-only fields. */
export function parseView(sc: unknown, meta?: unknown): ViewData | null {
  if (!isObj(sc)) return null;
  switch (sc.view) {
    case "reply": {
      const reply = parseReply(sc.reply);
      return reply && { view: "reply", reply };
    }
    case "saved_replies":
      return {
        view: "saved_replies",
        replies: objs(isObj(meta) ? meta.replies ?? sc.replies : sc.replies).flatMap((item) => {
          const reply = parseReply(item.reply);
          const reply_id = strOrNull(item.reply_id);
          return reply && reply_id ? [{ reply_id, reply }] : [];
        }),
      };
    case "memory_review":
      return {
        view: "memory_review",
        proposal_id: str(sc.proposal_id),
        expires_at: str(sc.expires_at),
        source: oneOf(sc.source, PROPOSAL_SOURCES, "conversation"),
        weekly_update: sc.weekly_update === true,
        proposals: objs(sc.proposals).map((p, i) => ({
          index: num(p.index, i),
          category: oneOf(p.category, MEMORY_CATEGORIES, "PERSONAL_MEMORY"),
          title: str(p.title),
          description: str(p.description),
          tags: strArr(p.tags),
          suggested_visibility: oneOf(p.suggested_visibility, VISIBILITIES, "PRIVATE"),
          already_saved: p.already_saved === true,
          people: cleanNames(p.people),
          new_people: cleanNames(p.new_people),
        })),
      };
    case "memory_import": {
      const seen = new Set<string>();
      const areas: MemoryImportArea[] = [];
      for (const a of objs(sc.areas)) {
        const value = str(a.value).trim();
        const label = str(a.label).trim();
        if (!value || !label || seen.has(value)) continue;
        seen.add(value);
        areas.push({ value, label, description: str(a.description).trim(), selected: a.selected === true });
        if (areas.length === LIMITS.importAreas) break;
      }
      return {
        view: "memory_import",
        areas,
        always_excluded: str(sc.always_excluded),
        imported_count: Math.max(0, Math.floor(num(sc.imported_count))),
        max_items: Math.max(1, Math.floor(num(sc.max_items, 30))),
      };
    }
    case "dashboard":
      return parseDashboard(sc);
    case "invite":
      return {
        view: "invite",
        code: str(sc.code),
        expires_at: str(sc.expires_at),
        max_uses: Math.max(0, Math.floor(num(sc.max_uses, 1))),
        share_text: str(sc.share_text),
        note: str(sc.note),
        link: parseLink(sc.link),
        qr: parseQr(sc.qr),
      };
    case "activity_ideas":
      return {
        view: "activity_ideas",
        kind: oneOf(sc.kind, FRIEND_KINDS, "connection"),
        id: str(sc.id),
        display_name: str(sc.display_name, "your friend") || "your friend",
        shared_interests: strArr(sc.shared_interests),
        match_score: Math.min(1, Math.max(0, num(sc.match_score))),
        score_explanation: strArr(sc.score_explanation),
        suggestions: objs(sc.suggestions).map(parseSuggestion),
        note: str(sc.note),
      };
    case "reconnect":
      return {
        view: "reconnect",
        min_days: Math.max(0, Math.floor(num(sc.min_days))),
        candidates: objs(sc.candidates).map((c) => ({
          kind: oneOf(c.kind, FRIEND_KINDS, "connection"),
          id: str(c.id),
          display_name: str(c.display_name, "Friend") || "Friend",
          days_since_last_interaction: Math.max(0, Math.floor(num(c.days_since_last_interaction))),
          last_activity: strOrNull(c.last_activity),
          reason: str(c.reason),
          suggested_activity: str(c.suggested_activity),
        })),
      };
    case "friend": {
      const kind = oneOf(sc.kind, FRIEND_KINDS, "connection");
      return {
        view: "friend",
        kind,
        id: str(sc.id),
        display_name: str(sc.display_name, "Friend") || "Friend",
        on_venn: typeof sc.on_venn === "boolean" ? sc.on_venn : kind === "connection",
        since: str(sc.since),
        last_interaction_at: strOrNull(sc.last_interaction_at),
        bio: strOrNull(sc.bio),
        relationship: strOrNull(sc.relationship),
        notes: strOrNull(sc.notes),
        interests: strArr(sc.interests),
        shared_interests: strArr(sc.shared_interests),
        shared_memories: objs(sc.shared_memories).map(parseSharedMemory),
        recent_interactions: objs(sc.recent_interactions).map(parseInteraction),
        follow_ups: parseFollowUps(sc.follow_ups),
      };
    }
    case "people_import":
      return {
        view: "people_import",
        import_id: str(sc.import_id),
        expires_at: str(sc.expires_at),
        source: strOrNull(sc.source),
        demo_platform: sc.demo_platform === "instagram" || sc.demo_platform === "linkedin" ? sc.demo_platform : null,
        candidates: objs(sc.candidates).map((c, i) => ({
          index: Math.floor(num(c.index, i)),
          name: str(c.name, "Someone") || "Someone",
          relationship: strOrNull(c.relationship),
          notes: strOrNull(c.notes),
          interests: strArr(c.interests),
          last_met_days_ago: daysOrNull(c.last_met_days_ago),
          already_added: c.already_added === true,
        })),
        skipped: Math.max(0, Math.floor(num(sc.skipped))),
        note: str(sc.note),
      };
    case "people_search": {
      const results = objs(sc.results)
        .map((r): SearchResult => {
          const kind = oneOf(r.kind, FRIEND_KINDS, "connection");
          return {
            kind,
            id: str(r.id),
            display_name: str(r.display_name, "Friend") || "Friend",
            on_venn: typeof r.on_venn === "boolean" ? r.on_venn : kind === "connection",
            relationship: strOrNull(r.relationship),
            matched: strArr(r.matched),
            snippet: strOrNull(r.snippet),
            last_interaction_at: strOrNull(r.last_interaction_at),
            why: str(r.why).trim(),
          };
        })
        .filter((r) => r.id !== "");
      return {
        view: "people_search",
        query: str(sc.query),
        results,
        count: Math.max(0, Math.floor(num(sc.count, results.length))),
        searched: Math.max(0, Math.floor(num(sc.searched))),
        note: str(sc.note),
        memories: objs(sc.memories)
          .map(parseMemory)
          .filter((m) => m.title.trim() !== "")
          .slice(0, 5),
      };
    }
    case "group_plan":
      return {
        view: "group_plan",
        members: objs(sc.members).map((m) => ({
          kind: oneOf(m.kind, FRIEND_KINDS, "connection"),
          id: str(m.id),
          display_name: str(m.display_name, "Friend") || "Friend",
          interests: strArr(m.interests),
        })),
        common_to_all: strArr(sc.common_to_all),
        common_to_some: objs(sc.common_to_some)
          .map((o) => ({ interest: str(o.interest), members: strArr(o.members) }))
          .filter((o) => o.interest !== ""),
        suggestions: objs(sc.suggestions).map(parseSuggestion),
        note: str(sc.note),
      };
    case "brief": {
      const kind = oneOf(sc.kind, FRIEND_KINDS, "connection");
      return {
        view: "brief",
        kind,
        id: str(sc.id),
        display_name: str(sc.display_name, "your friend") || "your friend",
        on_venn: typeof sc.on_venn === "boolean" ? sc.on_venn : kind === "connection",
        relationship: strOrNull(sc.relationship),
        notes: strOrNull(sc.notes),
        last_interaction_at: strOrNull(sc.last_interaction_at),
        last_activity: strOrNull(sc.last_activity),
        days_since_last_interaction: daysOrNull(sc.days_since_last_interaction),
        interests: strArr(sc.interests),
        shared_interests: strArr(sc.shared_interests),
        shared_memories: objs(sc.shared_memories).map(parseSharedMemory),
        things_to_ask: parseFollowUps(sc.things_to_ask),
        conversation_starters: strArr(sc.conversation_starters),
        note: str(sc.note),
      };
    }
    case "quiz": {
      const mode = sc.mode === "friend" ? "friend" : "circle";
      const next = isObj(sc.next) && str(sc.next.title) !== "" ? sc.next : null;
      return {
        view: "quiz",
        mode,
        kind: sc.kind === "connection" ? "connection" : null,
        id: strOrNull(sc.id),
        display_name: strOrNull(sc.display_name),
        title: str(sc.title) || (mode === "friend" ? "How well do you know them?" : "Who's who in your circle?"),
        questions: objs(sc.questions)
          .map(parseQuizQuestion)
          .filter((q): q is QuizQuestion => q !== null),
        common_ground: strArr(sc.common_ground),
        next: next ? { title: str(next.title), description: str(next.description) } : null,
        note: str(sc.note),
      };
    }
    case "venn": {
      const id = str(sc.id);
      if (!id) return null;
      const kind = oneOf(sc.kind, FRIEND_KINDS, "connection");
      const labels = (v: unknown) => cleanNames(v).slice(0, LIMITS.vennRegion);
      return {
        view: "venn",
        kind,
        id,
        display_name: str(sc.display_name, "Friend") || "Friend",
        on_venn: typeof sc.on_venn === "boolean" ? sc.on_venn : kind === "connection",
        you_only: labels(sc.you_only),
        shared: labels(sc.shared),
        them_only: labels(sc.them_only),
        summary: str(sc.summary).trim(),
        suggestions: objs(sc.suggestions)
          .map(parseSuggestion)
          .filter((s) => s.title.trim() !== "")
          .slice(0, 2),
        note: str(sc.note),
      };
    }
    case "this_week": {
      const actions = objs(sc.actions)
        .map((a): WeekAction => {
          const followUp = isObj(a.follow_up) ? parseFollowUp(a.follow_up) : null;
          const suggestion = isObj(a.suggestion) ? parseSuggestion(a.suggestion) : null;
          const draft = strOrNull(a.draft_message);
          return {
            type: oneOf(a.type, WEEK_ACTION_TYPES, "reach_out"),
            kind: oneOf(a.kind, FRIEND_KINDS, "connection"),
            id: str(a.id),
            display_name: str(a.display_name, "Friend") || "Friend",
            title: str(a.title),
            reason: str(a.reason),
            draft_message: draft && draft.trim() !== "" ? draft : null,
            follow_up: followUp && followUp.follow_up_id !== "" && followUp.text.trim() !== "" ? followUp : null,
            suggestion: suggestion && suggestion.title.trim() !== "" ? suggestion : null,
          };
        })
        .filter((a) => a.id !== "")
        .slice(0, 3);
      return { view: "this_week", actions, empty_reason: strOrNull(sc.empty_reason), note: str(sc.note) };
    }
    case "ask_link": {
      const link = parseLink(sc.link);
      const linkId = str(sc.link_id);
      if (!link || !linkId) return null;
      return {
        view: "ask_link",
        link_id: linkId,
        link,
        qr: parseQr(sc.qr),
        expires_at: str(sc.expires_at),
        for_name: strOrNull(sc.for_name),
        share_text: str(sc.share_text),
        questions: strArr(sc.questions).filter((q) => q.trim() !== ""),
        max_responses: Math.max(0, Math.floor(num(sc.max_responses))),
        note: str(sc.note),
      };
    }
    case "answers":
      return {
        view: "answers",
        responses: objs(sc.responses)
          .map((r): AnswerResponse => {
            const seen = new Set<string>();
            const items: AnswerItem[] = [];
            for (const it of objs(r.items)) {
              const key = str(it.key);
              const answer = str(it.answer);
              if (!key || seen.has(key) || answer.trim() === "") continue;
              seen.add(key);
              items.push({ key, question: str(it.question), answer, saves_as: str(it.saves_as) });
            }
            return {
              response_id: str(r.response_id),
              name: str(r.name),
              received_at: str(r.received_at),
              person_id: strOrNull(r.person_id),
              person_name: strOrNull(r.person_name),
              items,
            };
          })
          .filter((r) => r.response_id !== "" && r.items.length > 0),
        links: objs(sc.links)
          .map(parseQuestionLink)
          .filter((l) => l.link_id !== ""),
        note: str(sc.note),
      };
    case "welcome":
      return {
        view: "welcome",
        display_name: str(sc.display_name),
        goal_options: objs(sc.goal_options)
          .map((g) => ({ value: str(g.value), label: str(g.label) || humanize(str(g.value)) }))
          .filter((g) => g.value !== ""),
        setup: parseSetup(sc.setup),
        sample_loaded: sc.sample_loaded === true,
      };
    case "help":
      return {
        view: "help",
        display_name: str(sc.display_name),
        topics: parseHelpTopics(sc.topics),
        setup: parseSetup(sc.setup),
        privacy: strArr(sc.privacy),
        note: str(sc.note),
      };
    default:
      return null;
  }
}

function parseInteraction(i: Obj): Interaction {
  return { occurred_at: str(i.occurred_at), activity: strOrNull(i.activity) };
}

export function parseSaveMemories(v: unknown): SaveMemoriesResult {
  const o = isObj(v) ? v : {};
  const saved = objs(o.saved).map(parseMemory);
  return {
    saved,
    count: num(o.count, saved.length),
    people_added: objs(o.people_added)
      .map(parsePerson)
      .filter((p) => p.person_id !== ""),
  };
}

export function parseSaveAnswers(v: unknown): SaveAnswersResult {
  const o = isObj(v) ? v : {};
  const person = hasId(o.person, "person_id") ? parsePerson(o.person) : null;
  const followUp = isObj(o.follow_up) ? parseFollowUp(o.follow_up) : null;
  return {
    saved: o.saved === true,
    person,
    added_interests: strArr(o.added_interests),
    follow_up: followUp && followUp.follow_up_id !== "" ? followUp : null,
  };
}

/** First word of a name, for compact labels ("Maya Chen" → "Maya"). */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  // "Mrs. Choi" has no usable first name: keep the whole thing.
  if (parts.length > 1 && /^(mr|mrs|ms|miss|mx|dr|prof|aunt|uncle|coach)\.?$/i.test(parts[0])) return name.trim();
  return parts[0] || name;
}

/** "Sat, Nov 28, 11:00 AM" in the user's locale; "" when the timestamp is unusable. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function parseDeleteMemory(v: unknown): DeleteMemoryResult {
  const o = isObj(v) ? v : {};
  return {
    deleted: o.deleted === true,
    memory_id: str(o.memory_id),
  };
}

export function parseRespondConnection(v: unknown): RespondConnectionResult {
  const o = isObj(v) ? v : {};
  return {
    request_id: str(o.request_id),
    status: str(o.status),
    connection_id: strOrNull(o.connection_id),
  };
}

export function parseImportPeople(v: unknown): ImportPeopleResult {
  const o = isObj(v) ? v : {};
  const imported = objs(o.imported).map(parsePerson);
  return { imported, count: Math.max(0, Math.floor(num(o.count, imported.length))) };
}

export function parseLogInteraction(v: unknown): LogInteractionResult {
  const o = isObj(v) ? v : {};
  return {
    recorded: o.recorded === true,
    kind: o.kind === "connection" || o.kind === "person" ? o.kind : null,
    id: str(o.id),
    last_interaction_at: strOrNull(o.last_interaction_at),
  };
}

/** True when `v` is an object carrying a non-empty string under `key`. */
export function hasId(v: unknown, key: string): v is Obj {
  return isObj(v) && typeof v[key] === "string" && v[key] !== "";
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** "today", "yesterday", "12 days ago", or a date for anything older than ~2 months. */
export function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return formatDate(iso);
}

/** "make_friends" → "Make friends". Free text is returned unchanged. */
export function humanize(value: string): string {
  if (!/^[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/.test(value) || !/[_]|^[a-z0-9]+$|^[A-Z0-9]+$/.test(value)) return value;
  const words = value.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "today", "yesterday", "12 days ago", "about 3 months ago", "over a year ago". */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 365) return `about ${Math.round(days / 30)} months ago`;
  return days < 730 ? "over a year ago" : `about ${Math.round(days / 365)} years ago`;
}

/** "Jun", "Jun and Hana", "Jun, Hana and Taeyang". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Split friends into the `{connection_ids, person_ids}` argument of venn_plan_group. */
export function groupArgs(friends: { kind: FriendKind; id: string }[]): { connection_ids: string[]; person_ids: string[] } {
  const picked = friends.slice(0, LIMITS.groupMax);
  return {
    connection_ids: picked.filter((f) => f.kind === "connection").map((f) => f.id),
    person_ids: picked.filter((f) => f.kind === "person").map((f) => f.id),
  };
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
