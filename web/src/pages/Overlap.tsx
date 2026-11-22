import { useEffect, useState } from "react";
import { api, DEMO } from "../api";
import { href } from "../router";
import { DEFAULT_OVERLAP_CITY, OVERLAP_CITIES, findOverlapArea, overlapAreaInfo, overlapAreasIn, overlapCityInfo, type OverlapArea, type OverlapCity } from "../overlapCities";
import { cityWeek, openSlots } from "../overlapWindow";
import { OVERLAP_INTERESTS, type OverlapPreference, type OverlapReportReason, type OverlapState } from "../types";
import { Dialog, InlineError, Loaded, useAction, useAsync, useToast } from "../ui";
import "../overlap.css";
import "./tools.css";

const label = (code: string) => code.charAt(0).toUpperCase() + code.slice(1);

const dayLabel = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const showDay = (iso: string) => dayLabel.format(new Date(`${iso}T00:00:00Z`));


function WindowSummary({ area, date, slot, interests }: OverlapPreference) {
  const place = overlapAreaInfo(area);
  return <div className="ov-summary"><strong>{place.name} · {overlapCityInfo(place.city).name} · {showDay(date)} · {label(slot)}</strong>
    <span>{interests.length ? interests.map(label).join(" · ") : "Choose at least one interest"}</span></div>;
}

function OptIn({ city, setCity, busy, save }: { city: OverlapCity; setCity: (city: OverlapCity) => void; busy: boolean; save: (p: OverlapPreference) => void }) {
  const now = Date.now();
  const days = cityWeek(city, now);
  const cityName = overlapCityInfo(city).name;
  const [area, setArea] = useState<OverlapArea>();
  const location = useAsync(() => api.getOverlapLocation(), []);
  const { reload: reloadLocation } = location;
  useEffect(() => {
    const refreshLocation = () => { if (!document.hidden) reloadLocation(); };
    document.addEventListener("visibilitychange", refreshLocation);
    return () => document.removeEventListener("visibilitychange", refreshLocation);
  }, [reloadLocation]);
  const savedArea = location.error ? null : location.data?.area;
  const savedPlace = savedArea ? overlapAreaInfo(savedArea) : null;
  const [chosenDay, setDay] = useState<string>();
  const date = chosenDay && days.includes(chosenDay) ? chosenDay : days[1];
  const slots = openSlots(city, date, now);
  const [chosenSlot, setSlot] = useState("afternoon");
  const slot = slots.find(s => s === chosenSlot) ?? slots[0];
  const [interests, setInterests] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const preference = area && overlapAreaInfo(area).city === city && slot ? { area, date, slot, interests } : null;
  const canOptIn = !busy && !!preference && adult && interests.length > 0 && interests.length <= 3;
  const changeCity = (next: OverlapCity, nextArea?: OverlapArea) => {
    if (next !== city) {
      setCity(next);
      setDay(undefined);
      setSlot("afternoon");
    }
    setArea(nextArea);
  };
  return <form className="tl__card tl__form" onSubmit={e => {
    e.preventDefault();
    const submittedAt = Date.now();
    if (canOptIn && preference && cityWeek(city, submittedAt).includes(date) && openSlots(city, date, submittedAt).includes(preference.slot)) save(preference);
  }}>
    <p id="overlap-neighborhood-hint" className="sr-only">Choose a neighborhood you’d visit. No address or GPS needed.</p>
    <div className="ov-fields">
      <label>City<select value={city} onChange={e => {
        const next = OVERLAP_CITIES.find(code => code === e.target.value);
        if (next) changeCity(next);
      }}>{OVERLAP_CITIES.map(c => <option key={c} value={c}>{overlapCityInfo(c).name}</option>)}</select></label>
      <label>Neighborhood
        <select name="area" required aria-describedby="overlap-neighborhood-hint" value={area ?? ""} onChange={e => setArea(findOverlapArea(e.target.value))}>
          <option value="" disabled>Choose a neighborhood</option>
          {overlapAreasIn(city).map(a => <option key={a} value={a}>{overlapAreaInfo(a).name}</option>)}
        </select>
      </label>
      <label>Day in {cityName}<select value={date} onChange={e => setDay(e.target.value)}>{days.map(d => <option key={d} value={d}>{showDay(d)}</option>)}</select></label>
      <label>Time of day<select value={slot} onChange={e => setSlot(e.target.value)}>{slots.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
    </div>
    {savedPlace && <p className="tl__meta"><button type="button" className="tl__link" disabled={busy} onClick={() => changeCity(savedPlace.city, savedPlace.code)}>
      Use {savedPlace.name}, {overlapCityInfo(savedPlace.city).name}
    </button></p>}
    <fieldset className="ov-interests"><legend>Pick 1–3</legend><div className="tl__chips">
      {OVERLAP_INTERESTS.map(i => { const on = interests.includes(i); return <button key={i} type="button" className="tl__chip" aria-pressed={on} disabled={!on && interests.length >= 3}
        onClick={() => setInterests(old => on ? old.filter(x => x !== i) : [...old, i])}>{label(i)}</button>; })}
    </div></fieldset>
    <label className="ov-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} required /> I’m an adult.</label>
    <div><button className="btn btn--primary" disabled={!canOptIn}>Opt in</button></div>
    {preference && <details className="tl__more"><summary>What a match sees</summary><div className="tl__form"><WindowSummary {...preference} />
      <p>Only this window and your interests. Never your location, contacts or memories. Your first name only if you both say yes.</p></div></details>}
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
  const [city, setCity] = useState(DEFAULT_OVERLAP_CITY);
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
  const activeArea = state.error ? null : state.data?.preference?.area;
  const cityName = overlapCityInfo(activeArea ? overlapAreaInfo(activeArea).city : city).name;
  const headline = status === "introduced" ? `You and ${match?.other_name || "your match"} both said yes.` : status === "waiting" ? "You said yes. Now it’s their turn." : status === "offered" ? "Your windows overlap." : activeArea ? "Your window is open." : `Find an overlap in ${cityName}.`;
  return <div className="page overlap tl">
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
    </> : <OptIn city={city} setCity={setCity} busy={action.busy} save={p => void run(() => api.optInOverlap({ ...p, adults_confirmed: true }), "Your window is open.")} />}</Loaded>}
  </div>;
}
