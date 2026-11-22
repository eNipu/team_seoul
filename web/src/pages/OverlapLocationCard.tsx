import { useState } from "react";
import { api, DEMO } from "../api";
import { OVERLAP_AREAS, parseOverlapLocation, type OverlapArea } from "../types";
import { Card, Field, InlineError, Loaded, useAction, useAsync, useToast } from "../ui";

const names: Record<OverlapArea, string> = { seongsu: "Seongsu", hongdae: "Hongdae", yeonnam: "Yeonnam" };
export const overlapAreaName = (area: OverlapArea) => names[area];

function LocationForm({ savedArea, onSaved }: { savedArea: OverlapArea | null; onSaved: (area: OverlapArea | null) => void }) {
  const [area, setArea] = useState(savedArea);
  const action = useAction();
  const toast = useToast();
  const changed = area !== savedArea;
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
      <Field label="Preferred Seoul neighborhood" optional hint="Only you see this preference. Overlap can suggest it later without opting you in.">
        {props => <select {...props} name="overlap-neighborhood" value={area ?? ""} disabled={action.busy} onChange={event => {
          action.clear();
          setArea(parseOverlapLocation({ area: event.target.value }).area);
        }}>
          <option value="">{savedArea ? "No saved neighborhood" : "Choose a neighborhood"}</option>
          {OVERLAP_AREAS.map(code => <option key={code} value={code}>{overlapAreaName(code)}</option>)}
        </select>}
      </Field>
      <InlineError message={action.error} />
      <div className="row"><button type="submit" className="btn" disabled={action.busy || !changed}>
        {action.busy ? "Saving…" : !area && savedArea ? "Remove saved neighborhood" : "Save neighborhood"}
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
