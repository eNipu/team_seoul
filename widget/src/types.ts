// Data contract for Heldly tool results (structuredContent).
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
};

export const CATEGORY_ICONS: Record<MemoryCategory, string> = {
  INTEREST: "✨",
  DISLIKE: "🚫",
  PREFERENCE: "👍",
  EXPERIENCE: "🧭",
  PERSONAL_MEMORY: "📷",
  SOCIAL_GOAL: "🎯",
  RELATIONSHIP_CONTEXT: "🤝",
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
} as const;

/** A friend is a mutual Heldly connection or a private "person" note. */
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
}

export interface MemoryProposal {
  index: number;
  category: MemoryCategory;
  title: string;
  description: string;
  tags: string[];
  suggested_visibility: Visibility;
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
}

export interface Person {
  person_id: string;
  name: string;
  relationship: string | null;
  notes: string | null;
  interests: string[];
  last_interaction_at: string | null;
  created_at: string;
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
  proposals: MemoryProposal[];
}

export interface DashboardViewData {
  view: "dashboard";
  profile: Profile;
  memories: Memory[];
  connections: Connection[];
  people: Person[];
  pending_requests: PendingRequest[];
}

export interface InviteViewData {
  view: "invite";
  code: string;
  expires_at: string;
  max_uses: number;
  share_text: string;
  note: string;
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
  on_heldly: boolean;
  since: string;
  last_interaction_at: string | null;
  bio: string | null;
  relationship: string | null;
  notes: string | null;
  interests: string[];
  shared_interests: string[];
  shared_memories: SharedMemory[];
  recent_interactions: Interaction[];
}

export interface GoalOption {
  value: string;
  label: string;
}

export interface WelcomeViewData {
  view: "welcome";
  display_name: string;
  goal_options: GoalOption[];
}

export type ViewData =
  | MemoryReviewViewData
  | DashboardViewData
  | InviteViewData
  | ActivityIdeasViewData
  | ReconnectViewData
  | FriendViewData
  | WelcomeViewData;

export type ViewName = ViewData["view"];

// Tool result payloads for non-view tools.
export interface SaveMemoriesResult {
  saved: Memory[];
  count: number;
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
  };
}

/** Parse a tool result's structuredContent into a renderable view, or null. */
export function parseView(sc: unknown): ViewData | null {
  if (!isObj(sc)) return null;
  switch (sc.view) {
    case "memory_review":
      return {
        view: "memory_review",
        proposal_id: str(sc.proposal_id),
        expires_at: str(sc.expires_at),
        proposals: objs(sc.proposals).map((p, i) => ({
          index: num(p.index, i),
          category: oneOf(p.category, MEMORY_CATEGORIES, "PERSONAL_MEMORY"),
          title: str(p.title),
          description: str(p.description),
          tags: strArr(p.tags),
          suggested_visibility: oneOf(p.suggested_visibility, VISIBILITIES, "PRIVATE"),
        })),
      };
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
        suggestions: objs(sc.suggestions).map((s) => ({
          title: str(s.title),
          description: str(s.description),
          grounded_in: strArr(s.grounded_in),
          suggested_action: str(s.suggested_action),
        })),
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
        on_heldly: typeof sc.on_heldly === "boolean" ? sc.on_heldly : kind === "connection",
        since: str(sc.since),
        last_interaction_at: strOrNull(sc.last_interaction_at),
        bio: strOrNull(sc.bio),
        relationship: strOrNull(sc.relationship),
        notes: strOrNull(sc.notes),
        interests: strArr(sc.interests),
        shared_interests: strArr(sc.shared_interests),
        shared_memories: objs(sc.shared_memories).map((m) => ({
          category: oneOf(m.category, MEMORY_CATEGORIES, "PERSONAL_MEMORY"),
          title: str(m.title),
          description: str(m.description),
          tags: strArr(m.tags),
        })),
        recent_interactions: objs(sc.recent_interactions).map(parseInteraction),
      };
    }
    case "welcome":
      return {
        view: "welcome",
        display_name: str(sc.display_name),
        goal_options: objs(sc.goal_options)
          .map((g) => ({ value: str(g.value), label: str(g.label) || humanize(str(g.value)) }))
          .filter((g) => g.value !== ""),
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
  return { saved, count: num(o.count, saved.length) };
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

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
