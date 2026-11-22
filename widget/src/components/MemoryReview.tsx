import { useEffect, useId, useRef, useState } from "react";
import type { HostBridge } from "../mcp/client";
import {
  CATEGORY_LABELS,
  VISIBILITIES,
  VISIBILITY_LABELS,
  formatDate,
  joinNames,
  parseSaveMemories,
  plural,
  type Memory,
  type MemoryReviewViewData,
  type Person,
  type Visibility,
} from "../types";
import ErrorBanner from "./ErrorBanner";
import { ActionError, PeopleChips, useAction, type Nav } from "./common";
import { Icon, Illustration } from "./icons";
import "./memoryReview.css";

interface Props {
  data: MemoryReviewViewData;
  bridge: HostBridge;
  nav: Nav;
  onPreviewReview?: (review: PreviewReview | null) => void;
}

const BULK_CONTROLS_ABOVE = 3;
const AUDIENCE_LABELS: Record<Visibility, string> = {
  PRIVATE: "Only you",
  SHARED_WITH_CONNECTIONS: "Connections",
  PUBLIC_PROFILE: "Public profile",
};

type Phase = "editing" | "saving" | "discarding" | "saved" | "discarded";
type ReviewRecord = Pick<Memory, "category" | "title" | "description" | "tags" | "visibility">;
type Draft = ReviewRecord & { index: number; checked: boolean; editing?: boolean };
export type PreviewReview = { phase: Exclude<Phase, "discarding">; records: ReviewRecord[] };

function ReviewProgress({ saved }: { saved: boolean }) {
  return (
    <header className="review-progress">
      <strong>Inside ChatGPT, with Venn</strong>
      <span className="muted small">{saved ? 2 : 1} of 2</span>
      <div className="review-progress__track" data-saved={saved} aria-hidden="true"><span /><span /></div>
    </header>
  );
}

function ReviewMap({ count, visibility }: { count: number; visibility: Visibility | null }) {
  const audience = count === 0 ? "No one" : visibility ? AUDIENCE_LABELS[visibility] : "Mixed visibility";
  return (
    <div className="review-map" aria-hidden="true">
      <span className="review-map__count">{plural(count, "selected update", "selected updates")}</span>
      <div className="review-map__nodes">
        <div className="review-map__node">
          <span className="review-map__icon review-map__icon--you"><Icon name="plus" size={24} /></span>
          <strong>You</strong>
        </div>
        <div className="review-map__node">
          <span className="review-map__icon review-map__icon--venn">
            <Icon name="venn" size={28} />
            <span className="review-map__signal" data-selected={count > 0} />
          </span>
          <strong>Venn</strong>
        </div>
        <div className="review-map__node">
          <span className="review-map__icon"><Icon name={visibility === "PRIVATE" || !count ? "lock" : "users"} size={22} /></span>
          <strong>{audience}</strong>
        </div>
      </div>
    </div>
  );
}

export default function MemoryReview({ data, bridge, nav, onPreviewReview }: Props) {
  const action = useAction();
  const formId = useId();
  const outcome = useRef<HTMLHeadingElement>(null);
  const fromChatGpt = data.source === "chatgpt_memory";
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    data.proposals.map((p) => ({
      index: p.index,
      checked: !p.already_saved,
      category: p.category,
      title: p.title,
      description: p.description,
      tags: p.tags,
      visibility: p.suggested_visibility,
    })),
  );
  const [phase, setPhase] = useState<Phase>("editing");
  const [error, setError] = useState<{ message: string; action: "save" | "discard" } | null>(null);
  const [saved, setSaved] = useState<Memory[]>([]);
  const [peopleAdded, setPeopleAdded] = useState<Person[]>([]);

  useEffect(() => {
    if (!onPreviewReview) return;
    const records = phase === "saved" ? saved : phase === "discarded" ? [] : drafts.filter((draft) => draft.checked);
    onPreviewReview({
      phase: phase === "discarding" ? "editing" : phase,
      records: records.map(({ category, title, description, tags, visibility }) => ({
        category, title: title.trim(), description: description.trim(), tags, visibility,
      })),
    });
  }, [drafts, phase, saved, onPreviewReview]);

  useEffect(() => () => onPreviewReview?.(null), [onPreviewReview]);
  useEffect(() => {
    if (phase === "saved" || phase === "discarded") outcome.current?.focus();
  }, [phase]);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.index === index ? { ...d, ...patch } : d)));

  const setAll = (checked: boolean) =>
    setDrafts((ds) =>
      ds.map((d, i) => ({ ...d, checked: checked && !data.proposals[i].already_saved })),
    );

  const selected = drafts.filter((d) => d.checked);
  const invalid = selected.some((d) => !d.title.trim() || !d.description.trim());
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const hasExpiry = expiresAt !== null && !Number.isNaN(expiresAt.getTime());
  const expired = hasExpiry && expiresAt.getTime() <= Date.now();
  const busy = phase === "saving" || phase === "discarding";
  const firstVisibility = selected[0]?.visibility;
  const visibility = firstVisibility && selected.every((draft) => draft.visibility === firstVisibility)
    ? firstVisibility
    : null;

  function setAudience(visibility: Visibility) {
    setDrafts((items) => items.map((item) => item.checked ? { ...item, visibility } : item));
  }

  async function save() {
    if (busy || selected.length === 0 || invalid || expired) return;
    setPhase("saving");
    setError(null);
    const res = await bridge.callTool("venn_save_memories", {
      proposal_id: data.proposal_id,
      approvals: selected.map((d) => ({
        index: d.index,
        visibility: d.visibility,
        title: d.title.trim(),
        description: d.description.trim(),
      })),
    });
    if (!res.ok) {
      setError({ message: res.errorText, action: "save" });
      setPhase("editing");
      return;
    }
    const result = parseSaveMemories(res.data);
    setSaved(result.saved);
    setPeopleAdded(result.people_added);
    setPhase("saved");
    const added = result.people_added.map((p) => p.name);
    const records = result.saved.map(({ memory_id, title, visibility }) => ({ memory_id, title, visibility }));
    void bridge.updateModelContext(
      `Venn saved ${plural(result.count, "memory", "memories")} from the user's approval on the card: ${records.map((record) => record.title).join(", ")}.`,
      { saved: records, count: result.count, people_added: added },
    );
  }

  async function discard() {
    if (busy) return;
    setPhase("discarding");
    setError(null);
    const res = await bridge.callTool("venn_discard_memory_proposal", { proposal_id: data.proposal_id });
    if (!res.ok) {
      setError({ message: res.errorText, action: "discard" });
      setPhase("editing");
      return;
    }
    setPhase("discarded");
    void bridge.updateModelContext("User discarded the proposed memories.");
  }

  if (phase === "saved") {
    return (
      <section className="memory-review" aria-labelledby={`${formId}-outcome`}>
        <ReviewProgress saved />
        <ActionError action={action} />
        <div className="success">
          <span className="success__icon" aria-hidden="true"><Icon name="check" size={22} /></span>
          <h2 id={`${formId}-outcome`} ref={outcome} tabIndex={-1}>
            {fromChatGpt ? `${plural(saved.length, "memory", "memories")} imported from ChatGPT`
              : `Saved ${plural(saved.length, "update", "updates")} to Venn`}
          </h2>
        </div>
        <ul className="list">
          {saved.map((m) => (
            <li key={m.memory_id} className="card">
              <div className="row row--between">
                <strong>{m.title}</strong>
                <span className={`badge badge--vis-${m.visibility.toLowerCase()}`}>{VISIBILITY_LABELS[m.visibility]}</span>
              </div>
              {m.description && <p className="muted small">{m.description}</p>}
              <PeopleChips people={m.people} />
            </li>
          ))}
        </ul>
        {peopleAdded.length > 0 && (
          <p className="logged-row" role="status">
            <Icon name="user-plus" size={16} />
            <span>
              {joinNames(peopleAdded.map((p) => p.name))} {peopleAdded.length === 1 ? "was" : "were"} added to your people
            </span>
          </p>
        )}
        <p className="muted small">You can edit visibility or delete an update any time from your Venn dashboard.</p>
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={action.busy !== null}
          onClick={() => void action.run("dashboard", () => nav.openView("venn_show_dashboard", {}))}
        >
          {action.busy === "dashboard" ? "Loading…" : "Open my Venn"}
        </button>
      </section>
    );
  }

  if (phase === "discarded") {
    return (
      <section className="memory-review empty" aria-labelledby={`${formId}-outcome`}>
        <Illustration name="done" />
        <h2 id={`${formId}-outcome`} ref={outcome} tabIndex={-1}>Draft discarded</h2>
        <p className="muted">Nothing was saved to your profile.</p>
      </section>
    );
  }

  const title = fromChatGpt ? "From your ChatGPT memory"
    : data.weekly_update ? "Your week, drafted by your AI."
    : "Review your Venn updates";
  const saveLabel = visibility === "SHARED_WITH_CONNECTIONS" ? `Share ${selected.length} with connections`
    : visibility === "PUBLIC_PROFILE" ? `Save ${selected.length} to your public profile`
    : visibility === "PRIVATE" ? `Save ${selected.length} privately`
    : `Save selected (${selected.length})`;

  return (
    <section className="memory-review" aria-labelledby={`${formId}-title`} aria-busy={busy}>
      <ReviewProgress saved={false} />
      <div className="memory-review__layout">
        <div className="memory-review__intro">
          <h2 id={`${formId}-title`}>{title}</h2>
          <p className="muted">Keep what you want, edit the wording, and choose who can see each update.</p>
        </div>
        <ReviewMap count={selected.length} visibility={visibility} />
        <div className="memory-review__form">
          {expired && <p className="text-danger">This proposal has expired. Ask Venn for a new draft.</p>}
          {error && (
            <ErrorBanner message={error.message} onRetry={error.action === "discard" ? discard : save}
              onDismiss={() => setError(null)} busy={busy} />
          )}
          {drafts.length === 0 ? <p className="muted">There are no memories to review.</p> : (
            <>
              {drafts.length > BULK_CONTROLS_ABOVE && (
                <div className="pick-bar">
                  <span className="pick-bar__count" role="status">{selected.length} of {drafts.length} selected</span>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setAll(true)}>Select all</button>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setAll(false)}>None</button>
                </div>
              )}
              <ul className="list">
                {drafts.map((draft, i) => {
                  const proposal = data.proposals[i];
                  const id = `${formId}-mem-${draft.index}`;
                  return (
                    <li key={draft.index} className="review-choice" data-checked={draft.checked}>
                      <label className="review-choice__label">
                        <input type="checkbox" checked={draft.checked} disabled={busy}
                          aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`}
                          onChange={(e) => update(draft.index, { checked: e.target.checked })} />
                        <span>
                          <span className="review-choice__category">{CATEGORY_LABELS[draft.category]}</span>
                          <strong id={`${id}-label`}>{draft.title || "Untitled update"}</strong>
                          <span className="review-choice__description" id={`${id}-description`}>{draft.description}</span>
                          {proposal.already_saved && <span className="badge badge--on">Already in Venn</span>}
                          {draft.checked && !visibility && <span className="badge">{AUDIENCE_LABELS[draft.visibility]}</span>}
                        </span>
                      </label>
                      <button type="button" className="review-choice__edit" disabled={busy}
                        aria-label={`Edit ${draft.title || "untitled update"}`} aria-expanded={!!draft.editing}
                        aria-controls={`${id}-fields`} onClick={() => update(draft.index, { editing: !draft.editing })}>
                        Edit
                      </button>
                      <div className="review-choice__fields" id={`${id}-fields`} hidden={!draft.editing}>
                        <label className="field">
                          <span className="field__label">Title</span>
                          <input id={`${id}-title`} type="text" value={draft.title} maxLength={120}
                            disabled={busy || !draft.checked} onChange={(e) => update(draft.index, { title: e.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field__label">Description</span>
                          <textarea rows={2} value={draft.description} maxLength={500}
                            disabled={busy || !draft.checked} onChange={(e) => update(draft.index, { description: e.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field__label">Who can see this</span>
                          <select value={draft.visibility} disabled={busy || !draft.checked}
                            onChange={(e) => update(draft.index, { visibility: e.target.value as Visibility })}>
                            {VISIBILITIES.map((v) => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
                          </select>
                        </label>
                        {draft.tags.length > 0 && (
                          <div className="chips">
                            {draft.tags.map((tag, j) => <span key={`${tag}-${j}`} className="chip chip--small">#{tag}</span>)}
                          </div>
                        )}
                      </div>
                      {(proposal.people.length > 0 || proposal.new_people.length > 0) && (
                        <div className="review-choice__people">
                          <PeopleChips people={proposal.people} />
                          {proposal.new_people.length > 0 && (
                            <p className="also-adds">
                              <Icon name="user-plus" size={16} />
                              <span>Also adds <strong>{joinNames(proposal.new_people)}</strong> to your people as {proposal.new_people.length === 1 ? "a private note" : "private notes"}.</span>
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <fieldset className="review-audience" disabled={busy || selected.length === 0}>
                <legend>Who can see selected updates</legend>
                <div className="review-audience__options">
                  {VISIBILITIES.map((v) => (
                    <label key={v}>
                      <input name={`${formId}-audience`} type="radio" value={v}
                        checked={visibility === v} onChange={() => setAudience(v)} />
                      <span>{AUDIENCE_LABELS[v]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {invalid && <p className="small text-danger">Each selected update needs a title and description.</p>}
          <div className={`memory-review__actions${drafts.length > BULK_CONTROLS_ABOVE ? " sticky-bar sticky-bar--actions" : ""}`}>
            <button type="button" className="btn btn--primary btn--block" onClick={save}
              disabled={busy || expired || selected.length === 0 || invalid}>
              {phase === "saving" ? "Saving…" : saveLabel}
            </button>
            <button type="button" className="btn btn--ghost" onClick={discard} disabled={busy}>
              {phase === "discarding" ? "Discarding…" : "Discard"}
            </button>
          </div>
        </div>
      </div>
      <p className="memory-review__foot muted small">
        Venn saves only the updates you approve.{hasExpiry && !expired && ` Review before ${formatDate(data.expires_at)}.`}
      </p>
    </section>
  );
}
