import { useRef, useState } from "react";
import { api } from "../api";
import type { PeopleImport } from "../types";
import { InlineError, Notice, useAction } from "../ui";
import { ImportReview } from "./ImportReview";

export function InstagramDemoFlow({ onDone, onCancel }: { onDone: (count: number) => void; onCancel: () => void }) {
  const [preview, setPreview] = useState<PeopleImport | null>(null);
  const action = useAction();
  const restoreReviewFocus = useRef(false);

  if (preview) {
    return (
      <ImportReview
        preview={preview}
        selectionTools
        onBack={() => {
          restoreReviewFocus.current = true;
          setPreview(null);
        }}
        onDone={onDone}
        intro={<Notice tone="quiet">Only the profiles you confirm are saved, as private notes.</Notice>}
      />
    );
  }

  return (
    <div className="stack">
      <p className="dialog__text">100 built-in Instagram-style profiles, marked as preview. No login needed.</p>
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={action.busy}
          ref={(button) => {
            if (button && restoreReviewFocus.current) {
              restoreReviewFocus.current = false;
              button.focus();
            }
          }}
          onClick={() => void action.run(async () => setPreview(await api.demoPeoplePreview("instagram")))}
        >
          {action.busy ? "Loading…" : "Preview profiles"}
        </button>
      </div>
    </div>
  );
}
