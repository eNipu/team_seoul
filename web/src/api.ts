// Typed client for the Venn web API (docs/WEB_API.md). One function per route.
// Same origin as the page, so the session cookie travels with
// `credentials: "same-origin"`. With `?demo=1` the in-memory mock is used instead.

import * as T from "./types";
import { createMockApi } from "./mockApi";
import { ApiError, errorMessage } from "./errors";

export { ApiError, errorMessage };

export interface Api {
  // Sign-in
  getSession(): Promise<T.Session>;
  signIn(input: T.SignInInput): Promise<T.SignInResult>;
  signOut(): Promise<void>;
  // Account
  getMe(): Promise<T.Me>;
  updateMe(patch: { display_name?: string; bio?: string; social_goals?: string[] }): Promise<T.Profile>;
  deleteAccount(confirmation: string): Promise<void>;
  getHome(): Promise<T.Home>;
  getHelp(): Promise<T.Help>;
  // Memories
  listMemories(params?: { q?: string; category?: T.MemoryCategory }): Promise<T.Memory[]>;
  createMemory(input: T.MemoryInput): Promise<{ memory: T.Memory; people_added: T.Person[] }>;
  updateMemory(
    memoryId: string,
    patch: { title?: string; description?: string; visibility?: T.Visibility },
  ): Promise<T.Memory>;
  deleteMemory(memoryId: string): Promise<void>;
  // People
  listPeople(): Promise<T.Person[]>;
  createPerson(input: T.PersonInput): Promise<T.Person>;
  updatePerson(
    personId: string,
    patch: { name?: string; relationship?: string; notes?: string; interests?: string[] },
  ): Promise<T.Person>;
  deletePerson(personId: string): Promise<void>;
  previewImport(people: T.PersonInput[], source?: string): Promise<T.PeopleImport>;
  importPeople(importId: string, indexes: number[]): Promise<T.Person[]>;
  /** Reads the user's own LinkedIn connections with the cookies they pasted. Saves nothing. */
  linkedinConnections(cookies: string): Promise<T.LinkedInConnections>;
  linkedinPreview(people: T.LinkedInPick[]): Promise<T.LinkedInImport>;
  linkedinDemoPreview(): Promise<T.PeopleImport>;
  /** Reads LinkedIn's own connections export file (no cookies). Saves nothing. */
  linkedinExport(csv: string): Promise<T.LinkedInConnections>;
  // Friends
  listFriends(): Promise<T.FriendSummary[]>;
  getFriend(kind: T.FriendKind, id: string): Promise<T.Friend>;
  getVenn(kind: T.FriendKind, id: string): Promise<T.VennCard>;
  getIdeas(kind: T.FriendKind, id: string): Promise<T.ActivityIdeas>;
  getBrief(kind: T.FriendKind, id: string): Promise<T.Brief>;
  logInteraction(kind: T.FriendKind, id: string, activity?: string): Promise<void>;
  addFollowUp(kind: T.FriendKind, id: string, text: string): Promise<T.FollowUp>;
  // Search, this week, reconnecting
  search(q: string): Promise<T.PeopleSearch>;
  getThisWeek(): Promise<T.ThisWeek>;
  getReconnect(): Promise<T.Reconnect>;
  getQuiz(connectionId?: string): Promise<T.Quiz>;
  // Follow-ups
  listFollowUps(): Promise<T.FollowUpItem[]>;
  completeFollowUp(followUpId: string): Promise<void>;
  // Plans
  listPlans(status?: "planned" | "done" | "all"): Promise<T.Plan[]>;
  createPlan(input: T.PlanInput): Promise<T.Plan>;
  completePlan(planId: string): Promise<{ logged: number }>;
  deletePlan(planId: string): Promise<void>;
  // Connecting
  createInvite(maxUses?: number): Promise<T.Invite>;
  redeemInvite(code: string): Promise<T.RedeemResult>;
  respondRequest(requestId: string, accept: boolean): Promise<T.RequestResult>;
  // Answers from friends without an account
  createQuestionLink(input: { person_id?: string; name?: string }): Promise<T.AskLink>;
  revokeQuestionLink(linkId: string): Promise<void>;
  getAnswers(): Promise<T.Answers>;
  saveAnswers(responseId: string, keys: string[], name?: string): Promise<T.SaveAnswersResult>;
  discardAnswers(responseId: string): Promise<void>;
  // Sample circle
  loadSample(): Promise<T.SampleLoaded>;
  removeSample(): Promise<T.SampleRemoved>;
}

/* ------------------------------------------------------------------ demo */

const params = new URLSearchParams(window.location.search);

/** `?demo=1`: no backend, no sign-in, everything from src/mockApi.ts. */
export const DEMO = params.get("demo") === "1";

/* ------------------------------------------------------- unauthenticated */

let onUnauthenticated: (() => void) | null = null;

/** The app registers what to do when any call answers 401 (show sign-in). */
export function setUnauthenticatedHandler(fn: (() => void) | null): void {
  onUnauthenticated = fn;
}

/* -------------------------------------------------------------- transport */

const BASE = "/api/v1";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  body?: unknown;
  /** Sign-in itself answers 401/404 as part of the flow; do not bounce. */
  quiet401?: boolean;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "That isn't allowed.";
  if (status === 404) return "That wasn't found. It may have been removed.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (status >= 500) return "Venn had a problem on its side. Please try again.";
  return "Venn couldn't do that. Please check and try again.";
}

async function request(method: Method, path: string, options: RequestOptions = {}): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  // Every request that changes something carries this header (cross-site request protection).
  if (method !== "GET") headers["X-Venn-Request"] = "1";
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("NETWORK", "Can't reach Venn. Check your connection and try again.", 0);
  }

  let data: unknown = null;
  let isJson = false;
  try {
    const text = await res.text();
    if (text) {
      data = JSON.parse(text);
      isJson = true;
    }
  } catch {
    isJson = false;
  }

  if (!res.ok) {
    const err = T.isObj(data) && T.isObj(data.error) ? data.error : {};
    const code = typeof err.code === "string" ? err.code : `HTTP_${res.status}`;
    const message = typeof err.message === "string" && err.message ? err.message : fallbackMessage(res.status);
    if (res.status === 401 && !options.quiet401) onUnauthenticated?.();
    throw new ApiError(code, message, res.status);
  }
  if (!isJson) throw new ApiError("BAD_RESPONSE", "Venn sent an answer this page couldn't read.", res.status);
  return data;
}

function qs(values: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== undefined && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const friend = (kind: T.FriendKind, id: string) => `/friends/${kind}/${encodeURIComponent(id)}`;
const enc = encodeURIComponent;

/* ------------------------------------------------------------- real client */

const realApi: Api = {
  // GET /session — never an error on a real server; a network failure or a
  // non-JSON answer (static host without the backend) is thrown to the caller.
  getSession: async () => T.parseSession(await request("GET", "/session", { quiet401: true })),
  // POST /session
  signIn: async (input) => T.parseSignIn(await request("POST", "/session", { body: input, quiet401: true })),
  // DELETE /session
  signOut: async () => {
    await request("DELETE", "/session", { quiet401: true });
  },

  // GET /me
  getMe: async () => T.parseMe(await request("GET", "/me")),
  // PATCH /me
  updateMe: async (patch) => T.parseProfile(await request("PATCH", "/me", { body: patch })),
  // DELETE /me
  deleteAccount: async (confirmation) => {
    await request("DELETE", "/me", { body: { confirmation } });
  },
  // GET /home
  getHome: async () => T.parseHome(await request("GET", "/home")),
  // GET /help
  getHelp: async () => T.parseHelp(await request("GET", "/help")),

  // GET /memories?q=&category=
  listMemories: async (p = {}) =>
    T.parseMemories(await request("GET", `/memories${qs({ q: p.q, category: p.category })}`)),
  // POST /memories
  createMemory: async (input) => {
    const data = await request("POST", "/memories", { body: input });
    const o = T.isObj(data) ? data : {};
    return { memory: T.parseMemory(o.memory), people_added: T.parsePeople(o, "people_added") };
  },
  // PATCH /memories/{memory_id}
  updateMemory: async (id, patch) => T.parseMemory(await request("PATCH", `/memories/${enc(id)}`, { body: patch })),
  // DELETE /memories/{memory_id}
  deleteMemory: async (id) => {
    await request("DELETE", `/memories/${enc(id)}`);
  },

  // GET /people
  listPeople: async () => T.parsePeople(await request("GET", "/people")),
  // POST /people
  createPerson: async (input) => T.parsePerson(await request("POST", "/people", { body: input })),
  // PATCH /people/{person_id}
  updatePerson: async (id, patch) => T.parsePerson(await request("PATCH", `/people/${enc(id)}`, { body: patch })),
  // DELETE /people/{person_id}
  deletePerson: async (id) => {
    await request("DELETE", `/people/${enc(id)}`);
  },
  // POST /people/import-preview
  previewImport: async (people, source) =>
    T.parsePeopleImport(
      await request("POST", "/people/import-preview", { body: source ? { people, source } : { people } }),
    ),
  // POST /people/import
  importPeople: async (importId, indexes) =>
    T.parsePeople(await request("POST", "/people/import", { body: { import_id: importId, indexes } }), "imported"),
  // POST /linkedin/connections
  linkedinConnections: async (cookies) =>
    T.parseLinkedInConnections(await request("POST", "/linkedin/connections", { body: { cookies } })),
  // POST /linkedin/export
  linkedinExport: async (csv) =>
    T.parseLinkedInConnections(await request("POST", "/linkedin/export", { body: { csv } })),
  // POST /linkedin/import-preview
  linkedinPreview: async (people) =>
    T.parseLinkedInImport(await request("POST", "/linkedin/import-preview", { body: { people } })),
  // POST /linkedin/demo-preview
  linkedinDemoPreview: async () => T.parsePeopleImport(await request("POST", "/linkedin/demo-preview")),

  // GET /friends
  listFriends: async () => T.parseFriendSummaries(await request("GET", "/friends")),
  // GET /friends/{kind}/{id}
  getFriend: async (kind, id) => T.parseFriend(await request("GET", friend(kind, id))),
  // GET /friends/{kind}/{id}/venn
  getVenn: async (kind, id) => T.parseVenn(await request("GET", `${friend(kind, id)}/venn`)),
  // GET /friends/{kind}/{id}/ideas
  getIdeas: async (kind, id) => T.parseIdeas(await request("GET", `${friend(kind, id)}/ideas`)),
  // GET /friends/{kind}/{id}/brief
  getBrief: async (kind, id) => T.parseBrief(await request("GET", `${friend(kind, id)}/brief`)),
  // POST /friends/{kind}/{id}/interactions
  logInteraction: async (kind, id, activity) => {
    await request("POST", `${friend(kind, id)}/interactions`, { body: activity ? { activity } : {} });
  },
  // POST /friends/{kind}/{id}/follow-ups
  addFollowUp: async (kind, id, text) =>
    T.parseFollowUp(await request("POST", `${friend(kind, id)}/follow-ups`, { body: { text } })),

  // GET /search?q=
  search: async (q) => T.parseSearch(await request("GET", `/search${qs({ q })}`)),
  // GET /this-week
  getThisWeek: async () => T.parseThisWeek(await request("GET", "/this-week")),
  // GET /reconnect
  getReconnect: async () => T.parseReconnect(await request("GET", "/reconnect")),
  // GET /quiz?connection_id=
  getQuiz: async (connectionId) => T.parseQuiz(await request("GET", `/quiz${qs({ connection_id: connectionId })}`)),

  // GET /follow-ups
  listFollowUps: async () => T.parseFollowUpItems(await request("GET", "/follow-ups")),
  // POST /follow-ups/{follow_up_id}/done
  completeFollowUp: async (id) => {
    await request("POST", `/follow-ups/${enc(id)}/done`);
  },

  // GET /plans?status=
  listPlans: async (status) => T.parsePlans(await request("GET", `/plans${qs({ status })}`)),
  // POST /plans
  createPlan: async (input) => T.parsePlan(await request("POST", "/plans", { body: input })),
  // POST /plans/{plan_id}/done
  completePlan: async (id) => {
    const data = await request("POST", `/plans/${enc(id)}/done`);
    const logged = T.isObj(data) && typeof data.logged === "number" ? data.logged : 0;
    return { logged };
  },
  // DELETE /plans/{plan_id}
  deletePlan: async (id) => {
    await request("DELETE", `/plans/${enc(id)}`);
  },

  // POST /invites
  createInvite: async (maxUses) =>
    T.parseInvite(await request("POST", "/invites", { body: maxUses ? { max_uses: maxUses } : {} })),
  // POST /invites/redeem
  redeemInvite: async (code) => T.parseRedeem(await request("POST", "/invites/redeem", { body: { code } })),
  // POST /requests/{request_id}
  respondRequest: async (id, accept) =>
    T.parseRequestResult(await request("POST", `/requests/${enc(id)}`, { body: { accept } })),

  // POST /question-links
  createQuestionLink: async (input) => T.parseAskLink(await request("POST", "/question-links", { body: input })),
  // DELETE /question-links/{link_id}
  revokeQuestionLink: async (id) => {
    await request("DELETE", `/question-links/${enc(id)}`);
  },
  // GET /answers
  getAnswers: async () => T.parseAnswers(await request("GET", "/answers")),
  // POST /answers/{response_id}/save
  saveAnswers: async (id, keys, name) =>
    T.parseSaveAnswers(await request("POST", `/answers/${enc(id)}/save`, { body: name ? { keys, name } : { keys } })),
  // DELETE /answers/{response_id}
  discardAnswers: async (id) => {
    await request("DELETE", `/answers/${enc(id)}`);
  },

  // POST /sample
  loadSample: async () => T.parseSampleLoaded(await request("POST", "/sample")),
  // DELETE /sample
  removeSample: async () => T.parseSampleRemoved(await request("DELETE", "/sample")),
};

export const api: Api = DEMO
  ? createMockApi({
      signedOut: params.get("signedout") === "1",
      passcode: params.get("passcode") === "1",
      fresh: params.get("fresh") === "1",
      external: params.get("external") === "1",
    })
  : realApi;
