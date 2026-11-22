// The two explicitly selected fictional seats share match state. Each has its own
// key, so simultaneous responses in different tabs cannot overwrite each other.
import type { Api } from "./api";
import { ApiError } from "./errors";
import { demoOverlapPlan } from "./demoOverlapPlan";
import { parseOverlapLocation, parseOverlapState, type OverlapPreference, type OverlapState, type OverlapAction, type OverlapReportReason } from "./types";

type Seat = "a" | "b";
const prefix = "venn.overlap.fictional.v1.";
const names = { a: "Demo Robin", b: "Demo Wren" };
interface Entry {
  revision: string;
  preference: OverlapPreference | null;
  blocked: boolean;
  suggestedMatch?: string;
  reported?: OverlapReportReason;
  response: { id: string; action: OverlapAction } | null;
}
const empty = (): Entry => ({ revision: "", preference: null, blocked: false, response: null });
function read(seat: Seat): Entry {
  const json = window.localStorage.getItem(prefix + seat);
  if (!json) return empty();
  const entry: Entry = JSON.parse(json);
  return { ...entry, preference: parseOverlapState(entry).preference };
}

type Demo = Pick<Api, "getOverlap" | "getOverlapLocation" | "updateOverlapLocation" | "optInOverlap" | "withdrawOverlap" | "respondOverlap" | "reportOverlap">;
export function createOverlapDemo(selected?: string | null, run: <R>(fn: () => R) => Promise<R> = async fn => fn()): Demo {
  const seat = selected === "a" || selected === "b" ? selected : null;
  const other = seat === "a" ? "b" : "a";
  const locationKey = seat ? `${prefix}location.${seat}` : null;
  function state(): OverlapState {
    if (!seat) return { preference: null, match: null };
    const own = read(seat), peer = read(other);
    const preference = own.preference, p = peer.preference;
    const none = { preference, match: null };
    if (!preference || !p || own.blocked || peer.blocked || preference.date !== p.date ||
        preference.area !== p.area || preference.slot !== p.slot) return none;
    const plan = demoOverlapPlan(preference.interests, p.interests, preference.area);
    if (!plan) return none;
    const id = seat === "a" ? `${own.revision}:${peer.revision}` : `${peer.revision}:${own.revision}`;
    const mine = own.response?.id === id ? own.response.action : null;
    const theirs = peer.response?.id === id ? peer.response.action : null;
    if (mine === "pass" || theirs === "pass") return none;
    const status = mine !== "yes" ? "offered" : theirs !== "yes" ? "waiting" : "introduced";
    const entrance = { seongsu: "Seongsu Station Exit 3", hongdae: "Hongik University Station Exit 9", yeonnam: "Hongik University Station Exit 3" }[preference.area];
    const hour = preference.slot === "morning" ? "10:00" : preference.slot === "afternoon" ? "15:00" : "19:00";
    const future = Date.parse(`${preference.date}T${hour}:00+09:00`) > Date.now();
    return { preference, match: { id, status, ...plan,
      meeting_point: status === "introduced" && future ? { label: `${entrance} · ${preference.date} ${hour} KST`,
        status: own.suggestedMatch === id ? (peer.suggestedMatch === id ? "agreed" : "suggested_by_you")
          : peer.suggestedMatch === id ? "suggested_to_you" : "available" } : null,
      other_name: status === "introduced" ? names[other] : null } };
  }
  function update(change: (entry: Entry) => void): OverlapState {
    if (!seat) throw new ApiError("INVALID_REQUEST", "Choose fictional demo seat a or b in the URL.", 400);
    const entry = read(seat);
    change(entry);
    window.localStorage.setItem(prefix + seat, JSON.stringify(entry));
    return state();
  }
  function respond(id: string, action: OverlapAction, reason?: OverlapReportReason) {
    return update(entry => {
      const match = state().match;
      if (!match || match.id !== id) throw new ApiError("NOT_FOUND", "This overlap is no longer available.", 404);
      if (action === "suggest_spot") {
        if (!match.meeting_point) throw new ApiError("INVALID_REQUEST", "A mutual introduction is required first.", 400);
        entry.suggestedMatch = id;
        return;
      }
      entry.response = { id, action };
      if (reason) entry.reported = reason;
      // Both a pass and a block exclude this exact pair from future offers.
      if (action === "block" || action === "pass") entry.blocked = true;
    });
  }
  return {
    getOverlap: () => run(state),
    getOverlapLocation: () => run(() => parseOverlapLocation({ area: locationKey && window.localStorage.getItem(locationKey) })),
    updateOverlapLocation: area => run(() => {
      if (!locationKey) throw new ApiError("INVALID_REQUEST", "Choose fictional demo seat a or b in the URL.", 400);
      if (area === null) window.localStorage.removeItem(locationKey);
      else window.localStorage.setItem(locationKey, area);
      return { area };
    }),
    optInOverlap: input => run(() => update(entry => {
      const { preference } = parseOverlapState({ preference: input });
      if (input.adults_confirmed !== true || !preference || !["morning", "afternoon", "evening"].includes(preference.slot)) throw new ApiError("INVALID_REQUEST", "Check your overlap preferences.", 400);
      const prev = entry.preference;
      if (prev && prev.area === preference.area && prev.date === preference.date && prev.slot === preference.slot &&
          prev.interests.length === preference.interests.length && prev.interests.every(i => preference.interests.includes(i))) return;
      entry.preference = preference;
      entry.revision = crypto.randomUUID(); // A new opt-in never inherits a previous yes.
      entry.response = null;
    })),
    withdrawOverlap: () => run(() => update(entry => { entry.preference = null; entry.response = null; })),
    respondOverlap: (id, action) => run(() => respond(id, action)),
    reportOverlap: (id, reason) => run(() => respond(id, "block", reason)),
  };
}
