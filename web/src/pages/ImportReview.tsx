// The last step of every people import: tick who to add. Nothing is added before this.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import { plural, type PeopleImport } from "../types";
import { Avatar, InlineError, Tag, useAction } from "../ui";

export function ImportReview({
  preview,
  intro,
  selectionTools = false,
  onBack,
  onDone,
}: {
  preview: PeopleImport;
  intro?: ReactNode;
  selectionTools?: boolean;
  onBack: () => void;
  onDone: (count: number) => void;
}) {
  const [checked, setChecked] = useState<number[]>(() =>
    selectionTools ? [] : preview.candidates.filter((c) => !c.already_added).map((c) => c.index),
  );
  const action = useAction();
  const selectable = preview.candidates.filter((c) => !c.already_added);
  const allSelected = checked.length === selectable.length;
  const instructions = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (selectionTools) instructions.current?.focus();
  }, [selectionTools]);

  return (
    <div className="stack">
      <p className="dialog__text" ref={instructions} tabIndex={selectionTools ? -1 : undefined}>
        Check who to add. Nothing is added until you confirm.
        {preview.skipped > 0 && ` ${plural(preview.skipped, "entry was", "entries were")} skipped.`}
      </p>
      {intro}
      {selectionTools && (
        <div className="row row--between">
          <p className="count" aria-live="polite">{checked.length} of {preview.candidates.length} selected</p>
          <button
            type="button"
            className="btn btn--small"
            disabled={action.busy || selectable.length === 0}
            onClick={() => setChecked(allSelected ? [] : selectable.map((c) => c.index))}
          >
            {allSelected && selectable.length > 0 ? "Clear selection" : "Select all"}
          </button>
        </div>
      )}
      <ul className="review">
        {preview.candidates.map((c) => {
          const on = checked.includes(c.index);
          return (
            <li key={c.index}>
              <label className={`review__row ${c.already_added ? "review__row--off" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={action.busy || c.already_added}
                  onChange={() => setChecked(on ? checked.filter((i) => i !== c.index) : [...checked, c.index])}
                />
                <Avatar name={c.name} size="small" />
                <span className="review__text">
                  <strong>{c.name}</strong>
                  <span className="muted small">
                    {[c.relationship, c.interests.join(", ")].filter(Boolean).join(" · ") || "No details"}
                  </span>
                  {c.notes && <span className="small review__notes">{c.notes}</span>}
                </span>
                {c.already_added && <Tag icon="check">Already in your people</Tag>}
              </label>
            </li>
          );
        })}
      </ul>
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" disabled={action.busy} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={action.busy || checked.length === 0}
          onClick={() =>
            void action.run(async () => {
              const people = await api.importPeople(preview.import_id, [...checked].sort((a, b) => a - b));
              onDone(people.length);
            })
          }
        >
          {action.busy
            ? "Adding…"
            : checked.length === 0
              ? selectable.length === 0
                ? "Everyone is already added"
                : "Choose at least one"
              : `Add ${plural(checked.length, "person", "people")}`}
        </button>
      </div>
    </div>
  );
}
