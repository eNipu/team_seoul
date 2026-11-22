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

const PAGE_SIZE = 3;
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
      <strong><Icon name="venn" size={22} /> Memory {saved ? "receipt" : "review"}</strong>
      <span className="small">{saved ? "Saved" : "Draft"}</span>
      <div className="review-progress__track" data-saved={saved} aria-hidden="true"><span /><span /></div>
    </header>
  );
}

function Pager({ page, total, busy, change }: {
  page: number; total: number; busy: boolean; change: (page: number) => void;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const position = useRef<HTMLSpanElement>(null);
  if (pages <= 1) return null;
  function turn(next: number) {
    position.current?.focus();
    change(next);
  }
  return (
    <nav className="review-pager" aria-label="Memory pages">
      <span ref={position} tabIndex={-1} aria-live="polite">Page <b>{page + 1}</b> of {pages}</span>
      <button className="btn btn--ghost" type="button" disabled={busy || page === 0} onClick={() => turn(page - 1)}>Previous</button>
      <button className="btn btn--ghost" type="button" disabled={busy || page + 1 >= pages} onClick={() => turn(page + 1)}>Next</button>
    </nav>
  );
}

export default function MemoryReview({ data, bridge, nav, onPreviewReview }: Props) {
  const action = useAction();
  const formId = useId();
  const outcome = useRef<HTMLHeadingElement>(null);
  const fromChatGpt = data.source === "chatgpt_memory";
  const [page, setPage] = useState(0);
  const start = page * PAGE_SIZE;
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    data.proposals.map((p) => ({
      index: p.index,
      checked: !fromChatGpt && data.proposals.length <= PAGE_SIZE && !p.already_saved,
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
    setPage(0);
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
        <Pager page={page} total={saved.length} change={setPage} busy={false} />
        <ul className="list">
          {saved.slice(start, start + PAGE_SIZE).map((m) => (
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
          onClick={() => void action.run("dashboard", () => fromChatGpt ? nav.openDashboard("profile") : nav.openView("venn_show_dashboard", {}))}
        >
          {action.busy === "dashboard" ? "Loading…" : fromChatGpt ? "Continue to contacts" : "Open my Venn"}
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
          <p className="muted">Choose what to keep and who can see it. Leave sensitive details out.</p>
        </div>
        <div className="memory-review__form">
          {expired && <p className="text-danger">This proposal has expired. Ask Venn for a new draft.</p>}
          {error && (
            <ErrorBanner message={error.message} onRetry={error.action === "discard" ? discard : save}
              onDismiss={() => setError(null)} busy={busy} />
          )}
          {drafts.length === 0 ? <p className="muted">There are no memories to review.</p> : (
            <>
              <Pager page={page} total={drafts.length} busy={busy} change={setPage} />
              <ul className="list">
                {drafts.slice(start, start + PAGE_SIZE).map((draft, i) => {
                  const proposal = data.proposals[start + i];
                  const id = `${formId}-mem-${draft.index}`;
                  return (
                    <li key={draft.index} className="review-choice" data-checked={draft.checked}>
                      <label className="review-choice__label">
                        <input type="checkbox" checked={draft.checked} disabled={busy}
                          aria-labelledby={`${id}-label`} aria-describedby={[`${id}-meta`, `${id}-description`, proposal.already_saved && `${id}-duplicate`, proposal.new_people.length > 0 && `${id}-adds`].filter(Boolean).join(" ")}
                          onChange={(e) => update(draft.index, { checked: e.target.checked })} />
                        <span>
                          <span className="review-choice__category" id={`${id}-meta`}> {CATEGORY_LABELS[draft.category]} · {AUDIENCE_LABELS[draft.visibility]}</span>
                          <strong id={`${id}-label`}>{draft.title || "Untitled update"}</strong>
                          <span className="review-choice__description" id={`${id}-description`}>{draft.description}</span>
                          {proposal.already_saved && <span id={`${id}-duplicate`} className="badge badge--on">Already in Venn</span>}
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
                            disabled={busy} onChange={(e) => update(draft.index, { title: e.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field__label">Description</span>
                          <textarea rows={2} value={draft.description} maxLength={500}
                            disabled={busy} onChange={(e) => update(draft.index, { description: e.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field__label">Who can see this</span>
                          <select value={draft.visibility} disabled={busy}
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
                            <p className="also-adds" id={`${id}-adds`}>
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
                <legend>Audience for all selected updates <b aria-live="polite">({selected.length})</b></legend>
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
          <div className="memory-review__actions">
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
