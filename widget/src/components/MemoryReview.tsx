import { useState } from "react";
import type { HostBridge } from "../mcp/client";
import {
  CATEGORY_LABELS,
  VISIBILITIES,
  VISIBILITY_LABELS,
  formatDate,
  parseSaveMemories,
  plural,
  type Memory,
  type MemoryReviewViewData,
  type Visibility,
} from "../types";
import ErrorBanner from "./ErrorBanner";
import { ActionError, useAction, type Nav } from "./common";

interface Props {
  data: MemoryReviewViewData;
  bridge: HostBridge;
  nav: Nav;
}

/** Above this many items the card shows the selection count and Select all / None. */
const BULK_CONTROLS_ABOVE = 3;

interface Draft {
  index: number;
  checked: boolean;
  title: string;
  description: string;
  visibility: Visibility;
}

type Phase = "editing" | "saving" | "saved" | "discarded";

export default function MemoryReview({ data, bridge, nav }: Props) {
  const action = useAction();
  const fromChatGpt = data.source === "chatgpt_memory";
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    data.proposals.map((p) => ({
      index: p.index,
      checked: !p.already_saved,
      title: p.title,
      description: p.description,
      visibility: p.suggested_visibility,
    })),
  );
  const [phase, setPhase] = useState<Phase>("editing");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Memory[]>([]);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.index === index ? { ...d, ...patch } : d)));

  const setAll = (checked: boolean) =>
    setDrafts((ds) =>
      ds.map((d) => ({
        ...d,
        // Select all skips what Venn already holds, like the people import card.
        checked: checked && !data.proposals.some((p) => p.index === d.index && p.already_saved),
      })),
    );

  const selected = drafts.filter((d) => d.checked);
  const invalid = selected.some((d) => d.title.trim() === "");
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const expired = !!expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now();

  async function save() {
    if (selected.length === 0 || invalid) return;
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
      setError(res.errorText);
      setPhase("editing"); // keep all edits so the user can retry
      return;
    }
    const result = parseSaveMemories(res.data);
    setSaved(result.saved);
    setPhase("saved");
    const titles = result.saved.map((m) => m.title).join(", ");
    void bridge.updateModelContext(`Saved ${result.count} memories to Venn profile: ${titles}`);
  }

  function discard() {
    setPhase("discarded");
    void bridge.updateModelContext("User discarded the proposed memories.");
  }

  if (phase === "saved") {
    return (
      <section className="panel">
        <ActionError action={action} />
        <div className="success">
          <span className="success__icon" aria-hidden="true">✓</span>
          <h2 role={fromChatGpt ? "status" : undefined}>
            {fromChatGpt
              ? `${plural(saved.length, "memory", "memories")} imported from ChatGPT`
              : `Saved ${saved.length} ${saved.length === 1 ? "memory" : "memories"}`}
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
              </li>
            ))}
          </ul>
        <p className="muted small">You can review or delete these any time from your Venn dashboard.</p>
        {fromChatGpt && (
          <div className="sticky-bar">
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={action.busy !== null}
              onClick={() => void action.run("dashboard", () => nav.openView("venn_show_dashboard", {}))}
            >
              {action.busy === "dashboard" ? "Loading…" : "Open my Venn"}
            </button>
          </div>
        )}
      </section>
    );
  }

  if (phase === "discarded") {
    return (
      <section className="panel empty">
        <div className="empty__art" aria-hidden="true">🗑️</div>
        <p className="empty__title">Discarded</p>
        <p className="muted">Nothing was saved to your profile.</p>
      </section>
    );
  }

  const busy = phase === "saving";

  return (
    <section className="panel">
      <h2>{fromChatGpt ? "From your ChatGPT memory" : "Review what Venn learned"}</h2>
      {fromChatGpt ? (
        <p className="notice">
          ChatGPT picked these from what it remembers about you. <strong>Nothing is saved until you confirm.</strong>
        </p>
      ) : (
        <p className="notice">
          <strong>Nothing is saved until you approve it.</strong> Uncheck anything you don't want remembered, edit the
          wording, and choose who can see each memory.
        </p>
      )}
      {expiresAt && !Number.isNaN(expiresAt.getTime()) && (
        <p className={`small ${expired ? "text-danger" : "muted"}`}>
          {expired ? "This proposal has expired — ask Venn again to save these." : `Review before ${formatDate(data.expires_at)}`}
        </p>
      )}

      {error && <ErrorBanner message={error} onRetry={save} onDismiss={() => setError(null)} busy={busy} />}

      {drafts.length === 0 ? (
        <p className="muted">There are no memories to review.</p>
      ) : (
        <>
          {drafts.length > BULK_CONTROLS_ABOVE && (
            <div className="pick-bar">
              <span className="pick-bar__count" role="status">
                {selected.length} of {drafts.length} selected
              </span>
              <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setAll(true)}>
                Select all
              </button>
              <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setAll(false)}>
                None
              </button>
            </div>
          )}
        <ul className="list">
          {data.proposals.map((p) => {
            const d = drafts.find((x) => x.index === p.index)!;
            const id = `mem-${p.index}`;
            return (
              <li key={p.index} className={`card memory-item ${d.checked ? "" : "memory-item--off"}`}>
                <div className="memory-item__head">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={d.checked}
                      disabled={busy}
                      onChange={(e) => update(p.index, { checked: e.target.checked })}
                    />
                    <span>{d.checked ? "Keep" : "Skip"}</span>
                  </label>
                  <span className="memory-item__badges">
                    {p.already_saved && <span className="badge badge--on">Already in Venn</span>}
                    <span className={`badge badge--cat-${p.category.toLowerCase()}`}>{CATEGORY_LABELS[p.category]}</span>
                  </span>
                </div>

                <label className="field" htmlFor={`${id}-title`}>
                  <span className="field__label">Title</span>
                  <input
                    id={`${id}-title`}
                    type="text"
                    value={d.title}
                    maxLength={200}
                    disabled={busy || !d.checked}
                    onChange={(e) => update(p.index, { title: e.target.value })}
                  />
                </label>
                <label className="field" htmlFor={`${id}-desc`}>
                  <span className="field__label">Description</span>
                  <textarea
                    id={`${id}-desc`}
                    rows={2}
                    value={d.description}
                    maxLength={2000}
                    disabled={busy || !d.checked}
                    onChange={(e) => update(p.index, { description: e.target.value })}
                  />
                </label>
                <label className="field" htmlFor={`${id}-vis`}>
                  <span className="field__label">Who can see this</span>
                  <select
                    id={`${id}-vis`}
                    value={d.visibility}
                    disabled={busy || !d.checked}
                    onChange={(e) => update(p.index, { visibility: e.target.value as Visibility })}
                  >
                    {VISIBILITIES.map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </label>
                {p.tags.length > 0 && (
                  <div className="chips">
                    {p.tags.map((t, i) => (
                      <span key={`${t}-${i}`} className="chip chip--small">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}

      {invalid && <p className="small text-danger">Each selected memory needs a title.</p>}

      <div className={`actions ${drafts.length > BULK_CONTROLS_ABOVE ? "sticky-bar sticky-bar--actions" : ""}`}>
        <button type="button" className="btn btn--ghost" onClick={discard} disabled={busy}>
          Discard
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={busy || selected.length === 0 || invalid}
        >
          {busy ? "Saving…" : `Save selected (${selected.length})`}
        </button>
      </div>
    </section>
  );
}
