// Payload shapes of the Venn web API (docs/WEB_API.md) and defensive parsers.
// Adapted from widget/src/types.ts: every parser tolerates missing or malformed
// optional fields and ignores unknown ones, so a slightly different server
// build degrades to empty lists instead of crashing a screen.

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
  PRIVATE: "Private",
  SHARED_WITH_CONNECTIONS: "Shared with connections",
  PUBLIC_PROFILE: "Public profile",
};

export const VISIBILITY_HINTS: Record<Visibility, string> = {
  PRIVATE: "Only you can see it.",
  SHARED_WITH_CONNECTIONS: "Friends you are connected with on Venn can see it.",
  PUBLIC_PROFILE: "Anyone who can see your Venn profile can see it.",
};

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  INTEREST: "Interest",
  DISLIKE: "Dislike",
  PREFERENCE: "Preference",
  EXPERIENCE: "Experience",
  PERSONAL_MEMORY: "Personal memory",
  SOCIAL_GOAL: "Social goal",
  RELATIONSHIP_CONTEXT: "About a relationship",
  WORK: "Work",
};

export const CATEGORY_GROUP_LABELS: Record<MemoryCategory, string> = {
  INTEREST: "Interests",
  DISLIKE: "Dislikes",
  PREFERENCE: "Preferences",
  EXPERIENCE: "Experiences",
  PERSONAL_MEMORY: "Personal memories",
  SOCIAL_GOAL: "Social goals",
  RELATIONSHIP_CONTEXT: "Relationships",
  WORK: "Work",
};

/** Input limits, mirroring the server's validation. */
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
  followUp: 200,
  searchQuery: 120,
  planTitle: 120,
  planDetails: 500,
  planMembers: 6,
  answerName: 80,
  importPeople: 50,
  tagCount: 8,
} as const;

export const DELETE_ACCOUNT_PHRASE = "DELETE MY VENN ACCOUNT";

export const FRIEND_KINDS = ["connection", "person"] as const;
export type FriendKind = (typeof FRIEND_KINDS)[number];

/* ------------------------------------------------------------------ shapes */

import { openSlots, seoulWeek } from "./overlapWindow";

export const OVERLAP_AREAS = ["seongsu", "hongdae", "yeonnam"] as const;
export const OVERLAP_INTERESTS = ["photography", "architecture", "walking", "coffee", "books", "art"] as const;

export interface OverlapPreference {
  area: string;
  date: string;
  slot: string;
  interests: string[];
}
export type OverlapInput = OverlapPreference & { adults_confirmed: true };
export type OverlapAction = "yes" | "pass" | "block" | "suggest_spot";
export interface OverlapMeetingPoint {
  label: string;
  status: "available" | "suggested_by_you" | "suggested_to_you" | "agreed";
}
export type OverlapReportReason = "safety" | "spam" | "other";
export interface OverlapMatch {
  id: string;
  status: "offered" | "waiting" | "introduced";
  title: string;
  reason: string;
  challenge: string;
  other_name: string | null;
  meeting_point: OverlapMeetingPoint | null;
}
export interface OverlapState {
  preference: OverlapPreference | null;
  match: OverlapMatch | null;
}

export function parseOverlapState(value: unknown): OverlapState {
  const empty = { preference: null, match: null };
  if (!isObj(value) || !isObj(value.preference)) return empty;
  const { area, date, slot, interests } = value.preference;
  const text = (s: unknown): s is string => typeof s === "string" && !!s.trim();
  if (!OVERLAP_AREAS.some(a => a === area) || !text(area) || !text(date) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
      !seoulWeek().includes(date) || !text(slot) || !openSlots(date).includes(slot) ||
      !Array.isArray(interests) || !interests.length || interests.length > 3 || new Set(interests).size !== interests.length ||
      !interests.every(i => OVERLAP_INTERESTS.some(code => code === i))) return empty;
  const preference = { area, date, slot, interests: [...interests] };
  const m = value.match;
  if (!isObj(m) || !text(m.id) || !text(m.title) || !text(m.reason) || !text(m.challenge) ||
      (m.status !== "offered" && m.status !== "waiting" && m.status !== "introduced")) return { preference, match: null };
  const point = m.meeting_point;
  const meeting_point: OverlapMeetingPoint | null = m.status === "introduced" && isObj(point) && text(point.label) &&
    (point.status === "available" || point.status === "suggested_by_you" || point.status === "suggested_to_you" || point.status === "agreed")
    ? { label: point.label, status: point.status } : null;
  return { preference, match: { id: m.id, status: m.status, title: m.title, reason: m.reason, challenge: m.challenge, meeting_point,
    other_name: m.status === "introduced" && text(m.other_name) ? m.other_name : null } };
}

export interface Session {
  signed_in: boolean;
  auth_mode: string;
  sign_in_available: boolean;
  passcode_required: boolean;
  display_name: string | null;
  username: string | null;
}

export interface SignInResult {
  signed_in: boolean;
  user_id: string;
  display_name: string;
  username: string;
  created: boolean;
}

export interface Profile {
  user_id: string;
  display_name: string;
  bio: string | null;
  social_goals: string[];
  interests: string[];
  memory_count: number;
  profile_visibility: string;
}

export interface Me {
  user_id: string;
  display_name: string;
  username: string | null;
  auth_mode: string;
  mcp_url: string;
  profile: Profile;
}

export type MemorySource = "chatgpt_memory" | "sample";

export interface Memory {
  memory_id: string;
  category: MemoryCategory;
  title: string;
  description: string;
  tags: string[];
  visibility: Visibility;
  source: MemorySource | null;
  people: string[];
  created_at: string;
}

export interface Person {
  person_id: string;
  name: string;
  relationship: string | null;
  notes: string | null;
  interests: string[];
  last_interaction_at: string | null;
  created_at: string;
  is_sample: boolean;
}

export interface Connection {
  connection_id: string;
  user_id: string;
  display_name: string;
  since: string;
  last_interaction_at: string | null;
  is_sample: boolean;
}

export interface PendingRequest {
  request_id: string;
  sender_display_name: string;
  created_at: string;
}

export interface SetupStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
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

export interface DashboardHome {
  view: "dashboard";
  profile: Profile;
  memories: Memory[];
  connections: Connection[];
  people: Person[];
  pending_requests: PendingRequest[];
  setup: SetupStep[];
  plans: Plan[];
  pending_answers: number;
  sample_loaded: boolean;
}

export interface WelcomeHome {
  view: "welcome";
  display_name: string;
  goal_options: { value: string; label: string }[];
  setup: SetupStep[];
  sample_loaded: boolean;
}

export type Home = DashboardHome | WelcomeHome;

export interface CircleIdeaOption {
  person: { kind: FriendKind; id: string; display_name: string };
  activity: string;
  reason: string;
  draft: string;
}

export interface CircleIdeaResponse {
  idea: (CircleIdeaOption & { topic: string; group: CircleIdeaOption | null }) | null;
}

export interface HelpTopic {
  key: string;
  title: string;
  description: string;
  examples: string[];
}

export interface Help {
  view: "help";
  display_name: string;
  topics: HelpTopic[];
  setup: SetupStep[];
  privacy: string[];
  note: string;
}

export interface FriendSummary {
  kind: FriendKind;
  id: string;
  display_name: string;
  on_venn: boolean;
  relationship: string | null;
  interests: string[];
  last_interaction_at: string | null;
  since: string;
  is_sample: boolean;
  open_follow_ups: number;
}

export interface FollowUp {
  follow_up_id: string;
  text: string;
  created_at: string;
}

export interface FollowUpItem extends FollowUp {
  kind: FriendKind;
  id: string;
  display_name: string;
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

export interface Friend {
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
  is_sample: boolean;
}

export interface ActivitySuggestion {
  title: string;
  description: string;
  grounded_in: string[];
  suggested_action: string;
}

export interface VennCard {
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

export interface ActivityIdeas {
  view: "activity_ideas";
  kind: FriendKind;
  id: string;
  display_name: string;
  shared_interests: string[];
  match_score: number;
  score_explanation: string[];
  suggestions: ActivitySuggestion[];
  note: string;
}

export interface Brief {
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

export interface SearchResult {
  kind: FriendKind;
  id: string;
  display_name: string;
  on_venn: boolean;
  relationship: string | null;
  matched: string[];
  snippet: string | null;
  why: string;
  last_interaction_at: string | null;
  is_sample: boolean;
}

export interface PeopleSearch {
  view: "people_search";
  query: string;
  results: SearchResult[];
  count: number;
  searched: number;
  memories: Memory[];
  note: string;
}

export type WeekActionType = "reach_out" | "follow_up" | "plan";

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

export interface ThisWeek {
  view: "this_week";
  actions: WeekAction[];
  empty_reason: string | null;
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

export interface Reconnect {
  view: "reconnect";
  min_days: number;
  candidates: ReconnectCandidate[];
}

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer_index: number;
  explanation: string;
}

export interface Quiz {
  view: "quiz";
  mode: string;
  title: string;
  questions: QuizQuestion[];
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

export interface PeopleImport {
  view: "people_import";
  import_id: string;
  expires_at: string;
  source: string | null;
  candidates: ImportCandidate[];
  skipped: number;
  note: string;
}

export interface LinkedInConnection {
  public_identifier: string | null;
  name: string;
  headline: string | null;
  profile_url: string;
  connected_on: string | null;
  already_added: boolean;
}

export interface LinkedInConnections {
  connections: LinkedInConnection[];
  count: number;
  total: number | null;
  truncated: boolean;
  /** Set when LinkedIn stopped the read part-way; what was read is still usable. */
  stopped: string | null;
  /** Whether this server can fetch company, location and skills for the people picked. */
  details_available: boolean;
  max_details: number;
  max_import: number;
}

export interface LinkedInPick {
  public_identifier: string | null;
  name: string;
  headline: string | null;
}

export interface LinkedInImport extends PeopleImport {
  details_for: number;
  details_error: string | null;
}

export interface Invite {
  view: "invite";
  code: string;
  expires_at: string;
  max_uses: number;
  share_text: string;
  note: string;
  link: string;
  qr: string[];
}

export interface RedeemResult {
  status: string;
  request_id: string;
  inviter_display_name: string;
  message: string;
}

export interface RequestResult {
  request_id: string;
  status: string;
  connection_id: string | null;
}

export interface AskLink {
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

export interface Answers {
  view: "answers";
  responses: AnswerResponse[];
  links: QuestionLink[];
  note: string;
}

export interface SaveAnswersResult {
  saved: boolean;
  response_id: string;
  person: Person;
  added_interests: string[];
  follow_up: FollowUp | null;
}

export interface SampleLoaded {
  loaded: boolean;
  connections: number;
  people: number;
  pending_requests: number;
  memories_added: number;
}

export interface SampleRemoved {
  removed: boolean;
  friends: number;
  people: number;
  memories: number;
}

/* ------------------------------------------------------------ input shapes */

export interface SignInInput {
  username: string;
  display_name?: string;
  passcode?: string;
  create?: boolean;
}

export interface MemoryInput {
  category: MemoryCategory;
  title: string;
  description: string;
  tags?: string[];
  visibility?: Visibility;
  people?: string[];
}

export interface PersonInput {
  name: string;
  relationship?: string;
  notes?: string;
  interests?: string[];
  last_met_days_ago?: number;
}

export interface PlanInput {
  title: string;
  details?: string;
  planned_for?: string;
  connection_ids?: string[];
  person_ids?: string[];
}

/* ---------------------------------------------------------------- parsers */

type Obj = Record<string, unknown>;

export function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function obj(v: unknown): Obj {
  return isObj(v) ? v : {};
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function bool(v: unknown): boolean {
  return v === true;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function strArr(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string" && x.trim() !== "");
}
function objs(v: unknown): Obj[] {
  return arr(v).filter(isObj);
}
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}
function kindOf(v: unknown): FriendKind {
  return oneOf(v, FRIEND_KINDS, "person");
}

const MAX_QR_MODULES = 177; // QR version 40

/** Rows of '0'/'1'; anything that is not a square bit matrix becomes []. */
function parseQr(v: unknown): string[] {
  const rows = strArr(v);
  if (rows.length < 21 || rows.length > MAX_QR_MODULES) return [];
  for (const row of rows) if (row.length !== rows.length || !/^[01]+$/.test(row)) return [];
  return rows;
}

/** Only http(s) links are ever rendered as links or copied as such. */
function parseLink(v: unknown): string {
  const s = str(v).trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

export function parseSession(v: unknown): Session {
  const o = obj(v);
  return {
    signed_in: bool(o.signed_in),
    auth_mode: str(o.auth_mode),
    sign_in_available: bool(o.sign_in_available),
    passcode_required: bool(o.passcode_required),
    display_name: strOrNull(o.display_name),
    username: strOrNull(o.username),
  };
}

export function parseSignIn(v: unknown): SignInResult {
  const o = obj(v);
  return {
    signed_in: bool(o.signed_in),
    user_id: str(o.user_id),
    display_name: str(o.display_name),
    username: str(o.username),
    created: bool(o.created),
  };
}

export function parseProfile(v: unknown): Profile {
  const o = obj(v);
  return {
    user_id: str(o.user_id),
    display_name: str(o.display_name, "You"),
    bio: strOrNull(o.bio),
    social_goals: strArr(o.social_goals),
    interests: strArr(o.interests),
    memory_count: num(o.memory_count),
    profile_visibility: str(o.profile_visibility, "PRIVATE"),
  };
}

export function parseMe(v: unknown): Me {
  const o = obj(v);
  const profile = parseProfile(o.profile);
  return {
    user_id: str(o.user_id, profile.user_id),
    display_name: str(o.display_name, profile.display_name),
    username: strOrNull(o.username),
    auth_mode: str(o.auth_mode),
    mcp_url: str(o.mcp_url),
    profile,
  };
}

export function parseMemory(v: unknown): Memory {
  const o = obj(v);
  return {
    memory_id: str(o.memory_id),
    category: oneOf(o.category, MEMORY_CATEGORIES, "INTEREST"),
    title: str(o.title, "Untitled"),
    description: str(o.description),
    tags: strArr(o.tags),
    visibility: oneOf(o.visibility, VISIBILITIES, "PRIVATE"),
    source: o.source === "chatgpt_memory" || o.source === "sample" ? o.source : null,
    people: strArr(o.people),
    created_at: str(o.created_at),
  };
}

export function parseMemories(v: unknown): Memory[] {
  return objs(obj(v).memories)
    .map(parseMemory)
    .filter((m) => m.memory_id !== "");
}

export function parsePerson(v: unknown): Person {
  const o = obj(v);
  return {
    person_id: str(o.person_id),
    name: str(o.name, "Someone"),
    relationship: strOrNull(o.relationship),
    notes: strOrNull(o.notes),
    interests: strArr(o.interests),
    last_interaction_at: strOrNull(o.last_interaction_at),
    created_at: str(o.created_at),
    is_sample: bool(o.is_sample),
  };
}

export function parsePeople(v: unknown, key = "people"): Person[] {
  return objs(obj(v)[key])
    .map(parsePerson)
    .filter((p) => p.person_id !== "");
}

function parseConnection(o: Obj): Connection {
  return {
    connection_id: str(o.connection_id),
    user_id: str(o.user_id),
    display_name: str(o.display_name, "A friend"),
    since: str(o.since),
    last_interaction_at: strOrNull(o.last_interaction_at),
    is_sample: bool(o.is_sample),
  };
}

function parseSetup(v: unknown): SetupStep[] {
  return objs(v)
    .map((s) => ({ key: str(s.key), title: str(s.title), description: str(s.description), done: bool(s.done) }))
    .filter((s) => s.title !== "");
}

function parsePlanMember(o: Obj): PlanMember {
  return { kind: kindOf(o.kind), id: str(o.id), display_name: str(o.display_name, "A friend") };
}

export function parsePlan(v: unknown): Plan {
  const o = obj(v);
  return {
    plan_id: str(o.plan_id),
    title: str(o.title, "Untitled plan"),
    details: strOrNull(o.details),
    planned_for: strOrNull(o.planned_for),
    status: o.status === "done" ? "done" : "planned",
    members: objs(o.members).map(parsePlanMember),
    created_at: str(o.created_at),
  };
}

export function parsePlans(v: unknown): Plan[] {
  return objs(obj(v).plans)
    .map(parsePlan)
    .filter((p) => p.plan_id !== "");
}

function circleOption(v: unknown): CircleIdeaOption | null {
  const o = obj(v);
  const p = obj(o.person);
  const { kind } = p;
  const id = strOrNull(p.id), display_name = strOrNull(p.display_name);
  const reason = strOrNull(o.reason), activity = strOrNull(o.activity), draft = strOrNull(o.draft);
  if ((kind !== "connection" && kind !== "person") || !id || !display_name || !reason || !activity || !draft) return null;
  return { person: { kind, id, display_name }, reason, activity, draft };
}

export function parseCircleIdea(v: unknown): CircleIdeaResponse {
  const raw = obj(obj(v).idea);
  const solo = circleOption(raw);
  const topic = strOrNull(raw.topic);
  if (!solo || !topic) return { idea: null };
  const group = circleOption(raw.group);
  const different = group && (group.person.kind !== solo.person.kind || group.person.id !== solo.person.id);
  return { idea: { ...solo, topic, group: different ? group : null } };
}

export function parseHome(v: unknown): Home {
  const o = obj(v);
  if (o.view === "welcome") {
    return {
      view: "welcome",
      display_name: str(o.display_name, "there"),
      goal_options: objs(o.goal_options)
        .map((g) => ({ value: str(g.value), label: str(g.label) }))
        .filter((g) => g.value !== "" && g.label !== ""),
      setup: parseSetup(o.setup),
      sample_loaded: bool(o.sample_loaded),
    };
  }
  return {
    view: "dashboard",
    profile: parseProfile(o.profile),
    memories: objs(o.memories).map(parseMemory),
    connections: objs(o.connections)
      .map(parseConnection)
      .filter((c) => c.connection_id !== ""),
    people: objs(o.people)
      .map(parsePerson)
      .filter((p) => p.person_id !== ""),
    pending_requests: objs(o.pending_requests)
      .map((r) => ({
        request_id: str(r.request_id),
        sender_display_name: str(r.sender_display_name, "Someone"),
        created_at: str(r.created_at),
      }))
      .filter((r) => r.request_id !== ""),
    setup: parseSetup(o.setup),
    plans: objs(o.plans)
      .map(parsePlan)
      .filter((p) => p.plan_id !== ""),
    pending_answers: num(o.pending_answers),
    sample_loaded: bool(o.sample_loaded),
  };
}

export function parseHelp(v: unknown): Help {
  const o = obj(v);
  return {
    view: "help",
    display_name: str(o.display_name),
    topics: objs(o.topics)
      .map((t) => ({
        key: str(t.key),
        title: str(t.title),
        description: str(t.description),
        examples: strArr(t.examples).slice(0, 4),
      }))
      .filter((t) => t.title !== "")
      .slice(0, 10),
    setup: parseSetup(o.setup),
    privacy: strArr(o.privacy),
    note: str(o.note),
  };
}

export function parseFriendSummaries(v: unknown): FriendSummary[] {
  return objs(obj(v).friends)
    .map((f) => {
      const kind = kindOf(f.kind);
      return {
        kind,
        id: str(f.id),
        display_name: str(f.display_name, "A friend"),
        on_venn: typeof f.on_venn === "boolean" ? f.on_venn : kind === "connection",
        relationship: strOrNull(f.relationship),
        interests: strArr(f.interests),
        last_interaction_at: strOrNull(f.last_interaction_at),
        since: str(f.since),
        is_sample: bool(f.is_sample),
        open_follow_ups: Math.max(0, Math.round(num(f.open_follow_ups))),
      };
    })
    .filter((f) => f.id !== "");
}

export function parseFollowUp(v: unknown): FollowUp {
  const o = obj(v);
  return { follow_up_id: str(o.follow_up_id), text: str(o.text), created_at: str(o.created_at) };
}

function parseFollowUps(v: unknown): FollowUp[] {
  return objs(v)
    .map(parseFollowUp)
    .filter((f) => f.follow_up_id !== "" && f.text !== "");
}

export function parseFollowUpItems(v: unknown): FollowUpItem[] {
  return objs(obj(v).follow_ups)
    .map((f) => ({
      ...parseFollowUp(f),
      kind: kindOf(f.kind),
      id: str(f.id),
      display_name: str(f.display_name, "A friend"),
    }))
    .filter((f) => f.follow_up_id !== "" && f.text !== "");
}

function parseSharedMemory(m: Obj): SharedMemory {
  return {
    category: oneOf(m.category, MEMORY_CATEGORIES, "INTEREST"),
    title: str(m.title, "Untitled"),
    description: str(m.description),
    tags: strArr(m.tags),
  };
}

function parseSuggestion(s: Obj): ActivitySuggestion {
  return {
    title: str(s.title, "An idea"),
    description: str(s.description),
    grounded_in: strArr(s.grounded_in),
    suggested_action: str(s.suggested_action),
  };
}

export function parseFriend(v: unknown): Friend {
  const o = obj(v);
  const kind = kindOf(o.kind);
  return {
    view: "friend",
    kind,
    id: str(o.id),
    display_name: str(o.display_name, "A friend"),
    on_venn: typeof o.on_venn === "boolean" ? o.on_venn : kind === "connection",
    since: str(o.since),
    last_interaction_at: strOrNull(o.last_interaction_at),
    bio: strOrNull(o.bio),
    relationship: strOrNull(o.relationship),
    notes: strOrNull(o.notes),
    interests: strArr(o.interests),
    shared_interests: strArr(o.shared_interests),
    shared_memories: objs(o.shared_memories).map(parseSharedMemory),
    recent_interactions: objs(o.recent_interactions)
      .map((i) => ({ occurred_at: str(i.occurred_at), activity: strOrNull(i.activity) }))
      .filter((i) => i.occurred_at !== ""),
    follow_ups: parseFollowUps(o.follow_ups),
    is_sample: bool(o.is_sample),
  };
}

export function parseVenn(v: unknown): VennCard {
  const o = obj(v);
  const kind = kindOf(o.kind);
  return {
    view: "venn",
    kind,
    id: str(o.id),
    display_name: str(o.display_name, "A friend"),
    on_venn: typeof o.on_venn === "boolean" ? o.on_venn : kind === "connection",
    you_only: strArr(o.you_only),
    shared: strArr(o.shared),
    them_only: strArr(o.them_only),
    summary: str(o.summary),
    suggestions: objs(o.suggestions).map(parseSuggestion),
    note: str(o.note),
  };
}

export function parseIdeas(v: unknown): ActivityIdeas {
  const o = obj(v);
  return {
    view: "activity_ideas",
    kind: kindOf(o.kind),
    id: str(o.id),
    display_name: str(o.display_name, "A friend"),
    shared_interests: strArr(o.shared_interests),
    match_score: Math.min(1, Math.max(0, num(o.match_score))),
    score_explanation: strArr(o.score_explanation),
    suggestions: objs(o.suggestions).map(parseSuggestion),
    note: str(o.note),
  };
}

export function parseBrief(v: unknown): Brief {
  const o = obj(v);
  const kind = kindOf(o.kind);
  return {
    view: "brief",
    kind,
    id: str(o.id),
    display_name: str(o.display_name, "A friend"),
    on_venn: typeof o.on_venn === "boolean" ? o.on_venn : kind === "connection",
    relationship: strOrNull(o.relationship),
    notes: strOrNull(o.notes),
    last_interaction_at: strOrNull(o.last_interaction_at),
    last_activity: strOrNull(o.last_activity),
    days_since_last_interaction: numOrNull(o.days_since_last_interaction),
    interests: strArr(o.interests),
    shared_interests: strArr(o.shared_interests),
    shared_memories: objs(o.shared_memories).map(parseSharedMemory),
    things_to_ask: parseFollowUps(o.things_to_ask),
    conversation_starters: strArr(o.conversation_starters),
    note: str(o.note),
  };
}

export function parseSearch(v: unknown): PeopleSearch {
  const o = obj(v);
  const results = objs(o.results)
    .map((r): SearchResult => {
      const kind = kindOf(r.kind);
      return {
        kind,
        id: str(r.id),
        display_name: str(r.display_name, "A friend"),
        on_venn: typeof r.on_venn === "boolean" ? r.on_venn : kind === "connection",
        relationship: strOrNull(r.relationship),
        matched: strArr(r.matched),
        snippet: strOrNull(r.snippet),
        why: str(r.why),
        last_interaction_at: strOrNull(r.last_interaction_at),
        is_sample: bool(r.is_sample),
      };
    })
    .filter((r) => r.id !== "");
  return {
    view: "people_search",
    query: str(o.query),
    results,
    count: num(o.count, results.length),
    searched: num(o.searched),
    memories: objs(o.memories)
      .map(parseMemory)
      .filter((m) => m.memory_id !== ""),
    note: str(o.note),
  };
}

export function parseThisWeek(v: unknown): ThisWeek {
  const o = obj(v);
  return {
    view: "this_week",
    actions: objs(o.actions)
      .map((a): WeekAction => {
        const followUp = isObj(a.follow_up) ? parseFollowUp(a.follow_up) : null;
        return {
          type: oneOf(a.type, ["reach_out", "follow_up", "plan"] as const, "reach_out"),
          kind: kindOf(a.kind),
          id: str(a.id),
          display_name: str(a.display_name, "A friend"),
          title: str(a.title),
          reason: str(a.reason),
          draft_message: strOrNull(a.draft_message),
          follow_up: followUp && followUp.follow_up_id !== "" ? followUp : null,
          suggestion: isObj(a.suggestion) ? parseSuggestion(a.suggestion) : null,
        };
      })
      .filter((a) => a.title !== "")
      .slice(0, 3),
    empty_reason: strOrNull(o.empty_reason),
    note: str(o.note),
  };
}

export function parseReconnect(v: unknown): Reconnect {
  const o = obj(v);
  return {
    view: "reconnect",
    min_days: num(o.min_days),
    candidates: objs(o.candidates)
      .map((c) => ({
        kind: kindOf(c.kind),
        id: str(c.id),
        display_name: str(c.display_name, "A friend"),
        days_since_last_interaction: num(c.days_since_last_interaction),
        last_activity: strOrNull(c.last_activity),
        reason: str(c.reason),
        suggested_activity: str(c.suggested_activity),
      }))
      .filter((c) => c.id !== ""),
  };
}

export function parseQuiz(v: unknown): Quiz {
  const o = obj(v);
  return {
    view: "quiz",
    mode: str(o.mode),
    title: str(o.title),
    questions: objs(o.questions)
      .map((q) => ({
        prompt: str(q.prompt),
        options: strArr(q.options),
        answer_index: num(q.answer_index, -1),
        explanation: str(q.explanation),
      }))
      .filter((q) => q.prompt !== "" && q.options.length >= 2),
    note: str(o.note),
  };
}

export function parseLinkedInConnections(v: unknown): LinkedInConnections {
  const o = obj(v);
  const connections = objs(o.connections)
    .map((c) => ({
      public_identifier: strOrNull(c.public_identifier),
      name: str(c.name),
      headline: strOrNull(c.headline),
      profile_url: str(c.profile_url),
      connected_on: strOrNull(c.connected_on),
      already_added: bool(c.already_added),
    }))
    .filter((c) => c.name !== "");
  return {
    connections,
    count: connections.length,
    total: numOrNull(o.total),
    truncated: bool(o.truncated),
    stopped: strOrNull(o.stopped),
    details_available: bool(o.details_available),
    max_details: num(o.max_details, 25),
    max_import: num(o.max_import, LIMITS.importPeople),
  };
}

export function parseLinkedInImport(v: unknown): LinkedInImport {
  const o = obj(v);
  return { ...parsePeopleImport(v), details_for: num(o.details_for), details_error: strOrNull(o.details_error) };
}

export function parsePeopleImport(v: unknown): PeopleImport {
  const o = obj(v);
  return {
    view: "people_import",
    import_id: str(o.import_id),
    expires_at: str(o.expires_at),
    source: strOrNull(o.source),
    candidates: objs(o.candidates)
      .map((c, i) => ({
        index: num(c.index, i),
        name: str(c.name),
        relationship: strOrNull(c.relationship),
        notes: strOrNull(c.notes),
        interests: strArr(c.interests),
        last_met_days_ago: numOrNull(c.last_met_days_ago),
        already_added: bool(c.already_added),
      }))
      .filter((c) => c.name !== ""),
    skipped: num(o.skipped),
    note: str(o.note),
  };
}

export function parseInvite(v: unknown): Invite {
  const o = obj(v);
  return {
    view: "invite",
    code: str(o.code),
    expires_at: str(o.expires_at),
    max_uses: num(o.max_uses, 1),
    share_text: str(o.share_text),
    note: str(o.note),
    link: parseLink(o.link),
    qr: parseQr(o.qr),
  };
}

export function parseRedeem(v: unknown): RedeemResult {
  const o = obj(v);
  return {
    status: str(o.status),
    request_id: str(o.request_id),
    inviter_display_name: str(o.inviter_display_name, "your friend"),
    message: str(o.message),
  };
}

export function parseRequestResult(v: unknown): RequestResult {
  const o = obj(v);
  return { request_id: str(o.request_id), status: str(o.status), connection_id: strOrNull(o.connection_id) };
}

export function parseAskLink(v: unknown): AskLink {
  const o = obj(v);
  return {
    view: "ask_link",
    link_id: str(o.link_id),
    link: parseLink(o.link),
    qr: parseQr(o.qr),
    expires_at: str(o.expires_at),
    for_name: strOrNull(o.for_name),
    share_text: str(o.share_text),
    questions: strArr(o.questions),
    max_responses: num(o.max_responses, 1),
    note: str(o.note),
  };
}

export function parseAnswers(v: unknown): Answers {
  const o = obj(v);
  return {
    view: "answers",
    responses: objs(o.responses)
      .map((r) => ({
        response_id: str(r.response_id),
        name: str(r.name),
        received_at: str(r.received_at),
        person_id: strOrNull(r.person_id),
        person_name: strOrNull(r.person_name),
        items: objs(r.items)
          .map((i) => ({
            key: str(i.key),
            question: str(i.question),
            answer: str(i.answer),
            saves_as: str(i.saves_as),
          }))
          .filter((i) => i.key !== "" && i.answer !== ""),
      }))
      .filter((r) => r.response_id !== ""),
    links: objs(o.links)
      .map((l) => ({
        link_id: str(l.link_id),
        for_name: strOrNull(l.for_name),
        link: parseLink(l.link),
        expires_at: str(l.expires_at),
        responses: num(l.responses),
        active: bool(l.active),
      }))
      .filter((l) => l.link_id !== ""),
    note: str(o.note),
  };
}

export function parseSaveAnswers(v: unknown): SaveAnswersResult {
  const o = obj(v);
  const followUp = isObj(o.follow_up) ? parseFollowUp(o.follow_up) : null;
  return {
    saved: bool(o.saved),
    response_id: str(o.response_id),
    person: parsePerson(o.person),
    added_interests: strArr(o.added_interests),
    follow_up: followUp && followUp.follow_up_id !== "" ? followUp : null,
  };
}

export function parseSampleLoaded(v: unknown): SampleLoaded {
  const o = obj(v);
  return {
    loaded: bool(o.loaded),
    connections: num(o.connections),
    people: num(o.people),
    pending_requests: num(o.pending_requests),
    memories_added: num(o.memories_added),
  };
}

export function parseSampleRemoved(v: unknown): SampleRemoved {
  const o = obj(v);
  return { removed: bool(o.removed), friends: num(o.friends), people: num(o.people), memories: num(o.memories) };
}

/* ------------------------------------------------------------- formatting */

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? "a year ago" : `${years} years ago`;
}

/** "Last seen 3 weeks ago" / "No hangout logged yet". */
export function formatLastSeen(iso: string | null): string {
  const days = daysSince(iso);
  return days === null ? "No hangout logged yet" : `Last seen ${formatDaysAgo(days)}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Path of a friend's page inside the app. */
export function friendPath(kind: FriendKind, id: string): string {
  return `/people/${kind}/${encodeURIComponent(id)}`;
}
