import { useId, useState, type FormEvent } from "react";
import { LIMITS } from "../types";
import { interestsError, splitInterests } from "./common";

export interface PersonValues {
  name: string;
  relationship: string;
  notes: string;
  interests: string[];
}

interface Props {
  initial?: Partial<PersonValues>;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  onSubmit: (values: PersonValues) => void;
  onCancel: () => void;
}

/** Inline form for a private "person" note (add on the dashboard, edit on the friend view). */
export default function PersonForm({ initial, submitLabel, busyLabel, busy, onSubmit, onCancel }: Props) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [relationship, setRelationship] = useState(initial?.relationship ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [interests, setInterests] = useState((initial?.interests ?? []).join(", "));

  const items = splitInterests(interests);
  const interestProblem = interestsError(items);
  const valid = name.trim() !== "" && !interestProblem;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    onSubmit({ name: name.trim(), relationship: relationship.trim(), notes: notes.trim(), interests: items });
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field" htmlFor={`${id}-name`}>
        <span className="field__label">Name</span>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          maxLength={LIMITS.personName}
          required
          autoComplete="off"
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field" htmlFor={`${id}-rel`}>
        <span className="field__label">Relationship (optional)</span>
        <input
          id={`${id}-rel`}
          type="text"
          value={relationship}
          maxLength={LIMITS.relationship}
          placeholder="College roommate, cousin, coworker…"
          autoComplete="off"
          disabled={busy}
          onChange={(e) => setRelationship(e.target.value)}
        />
      </label>
      <label className="field" htmlFor={`${id}-interests`}>
        <span className="field__label">Interests (optional, comma separated)</span>
        <input
          id={`${id}-interests`}
          type="text"
          value={interests}
          placeholder="Hiking, board games"
          autoComplete="off"
          disabled={busy}
          aria-invalid={interestProblem ? true : undefined}
          aria-describedby={interestProblem ? `${id}-interests-err` : undefined}
          onChange={(e) => setInterests(e.target.value)}
        />
        {interestProblem && (
          <span id={`${id}-interests-err`} className="small text-danger">
            {interestProblem}
          </span>
        )}
      </label>
      <label className="field" htmlFor={`${id}-notes`}>
        <span className="field__label">Private notes (optional)</span>
        <textarea
          id={`${id}-notes`}
          rows={3}
          value={notes}
          maxLength={LIMITS.notes}
          placeholder="Anything you want to remember. Only you can see this."
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="actions actions--compact">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy || !valid}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
