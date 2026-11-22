import { useState } from "react";
import { api, DEMO } from "../api";
import { DEFAULT_OVERLAP_CITY, OVERLAP_CITIES, overlapAreaInfo, overlapAreasIn, overlapCityInfo, type OverlapArea } from "../overlapCities";
import { parseOverlapLocation } from "../types";
import { Card, Field, InlineError, Loaded, useAction, useAsync, useToast } from "../ui";

function LocationForm({ savedArea, onSaved }: { savedArea: OverlapArea | null; onSaved: (area: OverlapArea | null) => void }) {
  const savedCity = savedArea ? overlapAreaInfo(savedArea).city : null;
  const [city, setCity] = useState(savedCity ?? DEFAULT_OVERLAP_CITY);
  const [area, setArea] = useState(savedArea);
  const action = useAction();
  const toast = useToast();
  // Browsing another city is not a request to remove the existing preference.
  const changed = area !== savedArea && (area !== null || city === savedCity);
  return (
    <form className="stack" onSubmit={event => {
      event.preventDefault();
      if (!changed) return;
      void action.run(async () => {
        const saved = await api.updateOverlapLocation(area);
        onSaved(saved.area);
        toast(saved.area ? "Neighborhood saved." : "Saved neighborhood removed.");
      });
    }}>
      <Field label="City for Overlap">
        {props => <select {...props} value={city} disabled={action.busy} onChange={event => {
          const next = OVERLAP_CITIES.find(code => code === event.target.value);
          if (!next) return;
          action.clear();
          setCity(next);
          setArea(next === savedCity ? savedArea : null);
        }}>
          {OVERLAP_CITIES.map(code => <option key={code} value={code}>{overlapCityInfo(code).name}</option>)}
        </select>}
      </Field>
      <Field label="Preferred neighborhood" optional hint="Only you see this preference. Overlap can suggest it later without opting you in.">
        {props => <select {...props} name="overlap-neighborhood" value={area ?? ""} disabled={action.busy} onChange={event => {
          action.clear();
          setArea(parseOverlapLocation({ area: event.target.value }).area);
        }}>
          <option value="">{city === savedCity ? "No saved neighborhood" : "Choose a neighborhood"}</option>
          {overlapAreasIn(city).map(code => <option key={code} value={code}>{overlapAreaInfo(code).name}</option>)}
        </select>}
      </Field>
      <InlineError message={action.error} />
      <div className="row"><button type="submit" className="btn" disabled={action.busy || !changed}>
        {action.busy ? "Saving…" : !area && city === savedCity ? "Remove saved neighborhood" : "Save neighborhood"}
      </button></div>
    </form>
  );
}

export function OverlapLocationCard() {
  // The seatless demo has no opt-in form to use this preference.
  const seat = DEMO ? new URLSearchParams(window.location.search).get("seat") : null;
  return !DEMO || seat === "a" || seat === "b" ? <SavedLocation /> : null;
}

function SavedLocation() {
  const location = useAsync(() => api.getOverlapLocation(), []);
  return (
    <Card title="Where would you meet?" id="overlap-neighborhood">
      <Loaded state={location}>
        {({ area }) => <LocationForm savedArea={area} onSaved={next => location.setData({ area: next })} />}
      </Loaded>
    </Card>
  );
}
