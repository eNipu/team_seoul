import { useEffect, useState } from "react";
import { api, DEMO } from "../api";
import { href } from "../router";
import { openSlots, seoulWeek as week } from "../overlapWindow";
import { OVERLAP_AREAS, OVERLAP_INTERESTS, type OverlapPreference, type OverlapReportReason, type OverlapState } from "../types";
import { Dialog, InlineError, Loaded, useAction, useAsync, useToast } from "../ui";
import "../overlap.css";
import "./tools.css";

const label = (code: string) => code.charAt(0).toUpperCase() + code.slice(1);

const dayLabel = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const showDay = (iso: string) => dayLabel.format(new Date(`${iso}T00:00:00Z`));


function WindowSummary({ area, date, slot, interests }: OverlapPreference) {
  return <div className="ov-summary"><strong>{label(area)} · {showDay(date)} · {label(slot)}</strong>
    <span>{interests.length ? interests.map(label).join(" · ") : "Choose at least one interest"}</span></div>;
}

function OptIn({ busy, save }: { busy: boolean; save: (p: OverlapPreference) => void }) {
  const days = week();
  const [area, setArea] = useState<string>(OVERLAP_AREAS[0]);
  // Tomorrow always has a full set of windows, regardless of the current time in Seoul.
  const [chosenDay, setDay] = useState(days[1]);
  const date = days.includes(chosenDay) ? chosenDay : days[0];
  const slots = openSlots(date);
  const [chosenSlot, setSlot] = useState("afternoon");
  const slot = slots.includes(chosenSlot) ? chosenSlot : slots[0];
  const [interests, setInterests] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const preference = { area, date, slot, interests };
  return <form className="tl__card tl__form" onSubmit={e => {
    e.preventDefault();
    if (!busy && adult && interests.length && interests.length <= 3 && week().includes(date)) save(preference);
  }}>
    <div className="ov-fields">
      <label>District<select value={area} onChange={e => setArea(e.target.value)}>{OVERLAP_AREAS.map(a => <option key={a} value={a}>{label(a)}</option>)}</select></label>
      <label>Day in Seoul<select value={date} onChange={e => setDay(e.target.value)}>{days.map(d => <option key={d} value={d}>{showDay(d)}</option>)}</select></label>
      <label>Time of day<select value={slot} onChange={e => setSlot(e.target.value)}>{slots.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
    </div>
    <fieldset className="ov-interests"><legend>Pick 1–3</legend><div className="tl__chips">
      {OVERLAP_INTERESTS.map(i => { const on = interests.includes(i); return <button key={i} type="button" className="tl__chip" aria-pressed={on} disabled={!on && interests.length >= 3}
        onClick={() => setInterests(old => on ? old.filter(x => x !== i) : [...old, i])}>{label(i)}</button>; })}
    </div></fieldset>
    <label className="ov-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} required /> I’m an adult.</label>
    <div><button className="btn btn--primary" disabled={busy || !adult || !interests.length}>Opt in</button></div>
    <details className="tl__more"><summary>What a match sees</summary><div className="tl__form"><WindowSummary {...preference} />
      <p>Only this window and your interests. Never your location, contacts or memories. Your first name only if you both say yes.</p></div></details>
  </form>;
}

type Run = (action: () => Promise<OverlapState>, message: string) => Promise<boolean>;
function Match({ match, busy, run, error }: { match: NonNullable<OverlapState["match"]>; busy: boolean; run: Run; error: string | null }) {
  const [panel, setPanel] = useState<"report" | "block" | null>(null);
  const [reason, setReason] = useState<OverlapReportReason>("safety");
  const introduced = match.status === "introduced";
  const point = introduced ? match.meeting_point : null;
  return <section className="tl__card tl__moment">
    <h2>{match.title}</h2><p>{match.reason}</p>
    {introduced && <p><strong>Your challenge:</strong> {match.challenge}</p>}
    {point && <div className="tl__form"><p><strong>Meet at:</strong> {point.label}</p>
      <p aria-live="polite">{point.status === "agreed" ? "You both chose this spot." : point.status === "suggested_by_you" ? "You suggested this spot. They haven’t agreed yet." : point.status === "suggested_to_you" ? `${match.other_name || "Your match"} suggested this spot.` : "Neither of you has suggested this spot yet."}</p>
      {(point.status === "available" || point.status === "suggested_to_you") && <button className="btn" disabled={busy}
        onClick={() => void run(() => api.respondOverlap(match.id, "suggest_spot"), "Your choice was saved.")}>
        {point.status === "available" ? "Suggest this spot" : "Agree to this spot"}</button>}
    </div>}
    {match.status === "offered" && <p>Names stay hidden unless you both say yes.</p>}
    <div className="tl__row">
      {match.status === "offered" && <button className="btn btn--primary" disabled={busy} onClick={() => void run(() => api.respondOverlap(match.id, "yes"), "You said yes.")}>Say yes</button>}
      {!introduced && <button className="tl__link" disabled={busy} onClick={() => void run(() => api.respondOverlap(match.id, "pass"), "Passed on this overlap.")}>Pass</button>}
      <button className="tl__link" disabled={busy} onClick={() => setPanel("block")}>Block</button>
      <button className="tl__link" disabled={busy} onClick={() => setPanel("report")}>Report</button>
    </div>
    {panel && <Dialog title={panel === "block" ? "Block this person?" : "Report this overlap"} onClose={() => setPanel(null)}>
      {panel === "report" ? <label className="ov-select">Reason<select value={reason} onChange={e => setReason(e.target.value as OverlapReportReason)}>
        <option value="safety">Safety concern</option><option value="spam">Spam</option><option value="other">Other</option></select></label> : <p>You won’t be matched with this person again.</p>}
      <InlineError message={error} /><div className="ov-row"><button className="btn" disabled={busy} onClick={() => setPanel(null)}>Cancel</button>
      <button className="btn btn--danger" disabled={busy} onClick={async () => {
        const ok = panel === "block" ? await run(() => api.respondOverlap(match.id, "block"), "Person blocked.") : await run(() => api.reportOverlap(match.id, reason), "Report sent.");
        if (ok) setPanel(null);
      }}>{panel === "block" ? "Block person" : "Send report"}</button></div></Dialog>}
  </section>;
}

export default function Overlap() {
  const state = useAsync<OverlapState>(() => api.getOverlap(), []);
  const action = useAction();
  const toast = useToast();
  const { reload } = state;
  useEffect(() => {
    if (state.loading || action.busy) return;
    const refresh = () => { if (!document.hidden) reload(); };
    const timer = state.data?.preference ? window.setInterval(refresh, 4000) : undefined;
    if (DEMO) window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("storage", refresh); };
  }, [reload, state.loading, state.data, action.busy]);
  const run: Run = (fn, message) => action.run(async () => {
    try {
      state.setData(await fn());
      toast(message);
    } finally {
      // Invalidate any poll that began before this write.
      reload();
    }
  });
  // The shared demo seats deliberately require a full navigation: the mock client
  // binds its seat once at startup, just like signing into a separate account.
  const seat = DEMO ? new URLSearchParams(window.location.search).get("seat") : null;
  const demoSeat = seat === "a" || seat === "b" ? seat : null;
  const match = !state.error ? state.data?.match : null;
  const status = match?.status;
  const headline = status === "introduced" ? `You and ${match?.other_name || "your match"} both said yes.` : status === "waiting" ? "You said yes. Now it’s their turn." : status === "offered" ? "Your windows overlap." : state.data?.preference ? "Your window is open." : "Find an overlap in Seoul.";
  return <div className="overlap tl">
    <header className="page-head"><h1 aria-live="polite" tabIndex={-1} id="page-title">{headline}</h1>
      {status === "waiting" ? <p>Names stay hidden unless you both agree.</p> : !state.data?.preference && <p>One neighborhood, a little free time, something you both enjoy.</p>}
    </header>
    {DEMO && <p className="tl__meta">
      {(["a", "b"] as const).filter(s => s !== demoSeat).map(s => <a key={s} className="tl__link" href={href("/overlap", { seat: s })} target={demoSeat || s === "b" ? "_blank" : "_self"} rel="noopener noreferrer">Open {s === "a" ? "Robin" : "Wren"}’s view</a>)}</p>}
    <InlineError message={action.error} />
    {(!DEMO || demoSeat) && <Loaded state={state.error ? { ...state, data: null } : state}>{({ preference, match }) => preference ? <>
      {match && <Match key={match.id} match={match} busy={action.busy} run={run} error={action.error} />}
      <section className="tl__card"><WindowSummary {...preference} />
        <div><button className="tl__link" disabled={action.busy} onClick={() => void run(() => api.withdrawOverlap(), "You withdrew from Overlap.")}>Withdraw</button></div></section>
    </> : <OptIn busy={action.busy} save={p => void run(() => api.optInOverlap({ ...p, adults_confirmed: true }), "Your window is open.")} />}</Loaded>}
  </div>;
}
