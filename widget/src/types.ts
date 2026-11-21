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

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  INTEREST: "Interest",
  DISLIKE: "Dislike",
  PREFERENCE: "Preference",
  EXPERIENCE: "Experience",
  PERSONAL_MEMORY: "Personal memory",
  SOCIAL_GOAL: "Social goal",
  RELATIONSHIP_CONTEXT: "Relationship",
};

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
}

export interface Connection {
  connection_id: string;
  user_id: string;
  display_name: string;
  since: string;
  last_interaction_at: string | null;
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
  pending_requests: PendingRequest[];
}

export type ViewData = MemoryReviewViewData | DashboardViewData;

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
  return typeof v === "string" ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function strArr(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string");
}
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
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

function parseProfile(v: unknown): Profile {
  const o = isObj(v) ? v : {};
  return {
    user_id: str(o.user_id),
    display_name: str(o.display_name, "You"),
    bio: strOrNull(o.bio),
    social_goals: strArr(o.social_goals),
    interests: strArr(o.interests),
    memory_count: num(o.memory_count),
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
        proposals: arr(sc.proposals)
          .filter(isObj)
          .map((p, i) => ({
            index: num(p.index, i),
            category: oneOf(p.category, MEMORY_CATEGORIES, "PERSONAL_MEMORY"),
            title: str(p.title),
            description: str(p.description),
            tags: strArr(p.tags),
            suggested_visibility: oneOf(p.suggested_visibility, VISIBILITIES, "PRIVATE"),
          })),
      };
    case "dashboard":
      return {
        view: "dashboard",
        profile: parseProfile(sc.profile),
        memories: arr(sc.memories).filter(isObj).map(parseMemory),
        connections: arr(sc.connections).filter(isObj).map(parseConnection),
        pending_requests: arr(sc.pending_requests)
          .filter(isObj)
          .map((r) => ({
            request_id: str(r.request_id),
            sender_display_name: str(r.sender_display_name, "Someone"),
            created_at: str(r.created_at),
          })),
      };
    default:
      return null;
  }
}

function parseConnection(c: Obj): Connection {
  return {
    connection_id: str(c.connection_id),
    user_id: str(c.user_id),
    display_name: str(c.display_name, "Friend"),
    since: str(c.since),
    last_interaction_at: strOrNull(c.last_interaction_at),
  };
}

export function parseSaveMemories(v: unknown): SaveMemoriesResult {
  const o = isObj(v) ? v : {};
  const saved = arr(o.saved).filter(isObj).map(parseMemory);
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

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
