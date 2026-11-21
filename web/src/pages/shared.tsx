// Pieces used by more than one page.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { LIMITS, plural, type AskLink, type Person, type PersonInput } from "../types";
import { ChipsInput, CopyButton, CopyField, Field, InlineError, Notice, QrBlock, useAction } from "../ui";

/** A created question link: the link, its QR code, a message to send, and the four questions. */
export function AskLinkPanel({ link }: { link: AskLink }) {
  return (
    <div className="ask-link">
      <div className="ask-link__main">
        <CopyField label={link.for_name ? `Link for ${link.for_name}` : "Link to share"} value={link.link} copyLabel="Copy link" />
        <div className="row">
          <CopyButton text={link.share_text} label="Copy message" />
          <span className="muted small">Up to {plural(link.max_responses, "reply", "replies")} · expires {formatShort(link.expires_at)}</span>
        </div>
        {link.questions.length > 0 && (
          <>
            <h3 className="subhead">The questions they'll see</h3>
            <ol className="numbered">
              {link.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </>
        )}
      </div>
      <QrBlock rows={link.qr} label="QR code for the question link" caption="Or let them scan this" />
      <Notice icon="shield" tone="quiet">
        Nothing is saved until you approve it. Answers wait for your review.
      </Notice>
    </div>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "soon";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Add or edit a private note about a person. */
export function PersonForm({
  person,
  onSaved,
  onCancel,
}: {
  person?: { person_id: string; name: string; relationship: string | null; notes: string | null; interests: string[] };
  onSaved: (person: Person) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(person?.name ?? "");
  const [relationship, setRelationship] = useState(person?.relationship ?? "");
  const [interests, setInterests] = useState<string[]>(person?.interests ?? []);
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [lastMet, setLastMet] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const action = useAction();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a name.");
      return;
    }
    setNameError(null);
    void action.run(async () => {
      if (person) {
        onSaved(
          await api.updatePerson(person.person_id, {
            name: trimmed,
            relationship: relationship.trim(),
            notes: notes.trim(),
            interests,
          }),
        );
        return;
      }
      const input: PersonInput = { name: trimmed };
      if (relationship.trim()) input.relationship = relationship.trim();
      if (notes.trim()) input.notes = notes.trim();
      if (interests.length) input.interests = interests;
      const days = Number.parseInt(lastMet, 10);
      if (lastMet !== "" && Number.isFinite(days) && days >= 0) input.last_met_days_ago = days;
      onSaved(await api.createPerson(input));
    });
  };

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Name" error={nameError}>
        {(p) => (
          <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.personName} required autoFocus />
        )}
      </Field>
      <Field label="Relationship" optional hint="For example: college roommate, cousin, climbing partner.">
        {(p) => (
          <input {...p} value={relationship} onChange={(e) => setRelationship(e.target.value)} maxLength={LIMITS.relationship} />
        )}
      </Field>
      <ChipsInput label="Interests" values={interests} onChange={setInterests} placeholder="photography, pottery…" />
      <Field label="Notes" optional hint="Only you can see these.">
        {(p) => <textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={LIMITS.notes} rows={3} />}
      </Field>
      {!person && (
        <Field label="Last met" optional hint="Roughly how many days ago you last saw them.">
          {(p) => (
            <div className="inline-input">
              <input
                {...p}
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                value={lastMet}
                onChange={(e) => setLastMet(e.target.value)}
              />
              <span>days ago</span>
            </div>
          )}
        </Field>
      )}
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={action.busy}>
          {action.busy ? "Saving…" : person ? "Save changes" : "Add person"}
        </button>
      </div>
    </form>
  );
}

/** A tick button for an open follow-up. */
export function TickButton({ label, busy, onClick }: { label: string; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="tick" aria-label={label} title={label} disabled={busy} onClick={onClick}>
      <Icon name="check" size={16} />
    </button>
  );
}
