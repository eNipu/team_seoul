import { useId, useState } from "react";
import type { HostBridge } from "../mcp/client";
import { parseSaveMemories, plural, type Memory, type MemoryReviewViewData } from "../types";
import { ActionError, useAction, type Nav } from "./common";
import { Icon } from "./icons";
import { CIRCLES, loadCircle } from "../onboardingCircle";
import ContactImportSources from "./ContactImportSources";
import "./onboarding.css";

// This card is the consent step. Receiving or reopening the proposal never saves it.
export default function QuickImport({ data, bridge, nav }: { data: MemoryReviewViewData; bridge: HostBridge; nav: Nav }) {
  const action = useAction();
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set());
  const [saved, setSaved] = useState<Memory[] | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [showSources, setShowSources] = useState(false);
  const sourcesId = useId();

  const fresh = data.proposals.filter((p) => !p.already_saved);
  const selected = fresh.filter((p) => !excluded.has(p.index));
  const interestCount = selected.filter((p) => p.category === "INTEREST").length;
  const viewProfile = () => void action.run("profile", () => nav.openDashboard("profile", true));

  function toggle(index: number) {
    action.clear();
    setExcluded((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  function save() {
    if (!selected.length) return;
    void action.run("save", async () => {
      const res = await bridge.callTool("venn_save_memories", {
        proposal_id: data.proposal_id,
        approvals: selected.map((p) => ({ index: p.index, visibility: "PRIVATE" })),
      });
      if (!res.ok) return res.errorText;
      const result = parseSaveMemories(res.data);
      setSaved(result.saved);
      void bridge.updateModelContext(
        `Venn saved ${plural(result.count, "memory", "memories")} privately after the user pressed Import.`,
        { count: result.count, visibility: "PRIVATE" },
      );
      return null;
    });
  }

  function discard() {
    void action.run("discard", async () => {
      const res = await bridge.callTool("venn_discard_memory_proposal", { proposal_id: data.proposal_id });
      if (!res.ok) return res.errorText;
      setDiscarded(true);
      return null;
    });
  }

  function remove(id: string) {
    void action.run(`rm-${id}`, async () => {
      const res = await bridge.callTool("venn_delete_memory", { memory_id: id });
      if (!res.ok) return res.errorText;
      setRemoved((r) => [...r, id]);
      return null;
    });
  }

  if (saved === null) {
    const busy = action.busy !== null;
    return (
      <section className="panel" aria-busy={busy}>
        <div className="hero">
          <h2>{discarded ? "Nothing imported" : "Import from ChatGPT"}</h2>
          <p className="muted small">
            {discarded ? "These drafts were discarded." : fresh.length === 0 ? "There are no new memories to import." :
              "Uncheck anything you want to leave out. The rest will be saved privately."}
          </p>
        </div>
        {!discarded && fresh.length > 0 && (
          <ul className="list pick-list memory-import-topics" aria-label="Memories to import">
            {fresh.map((p) => (
              <li key={p.index}>
                <label className={`pick${excluded.has(p.index) ? "" : " pick--on"}`}>
                  <input type="checkbox" checked={!excluded.has(p.index)} disabled={busy} onChange={() => toggle(p.index)} />
                  <span className="pick__body">
                    <strong>{p.title}</strong>
                    {p.description && <span className="muted small">{p.description}</span>}
                    {p.category === "INTEREST" && <span className="muted small">Profile interest</span>}
                    {p.new_people.length > 0 && (
                      <span className="muted small">Adds private people notes for {p.new_people.join(", ")}.</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <ActionError action={action} />
        <div className="sticky-bar sticky-bar--actions">
          {!discarded && interestCount > 0 && <p className="muted small" role="status">
            {plural(interestCount, "interest", "interests")} will appear on your profile automatically.
          </p>}
          <div className="button-row">
            {!discarded && fresh.length > 0 && <button type="button" className="btn btn--primary" disabled={busy || selected.length === 0} onClick={save}>
              {action.busy === "save" ? "Importing…" : `Import ${plural(selected.length, "memory", "memories")}`}
            </button>}
            {discarded ? <button type="button" className="btn" disabled={busy} onClick={viewProfile}>Go to Venn</button> :
              <button type="button" className="btn" disabled={busy} onClick={discard}>{fresh.length ? "Discard" : "Done"}</button>}
          </div>
        </div>
      </section>
    );
  }

  const invite = CIRCLES.find((c) => c.value === loadCircle())?.invite ?? "Invite your person";
  const kept = saved.filter((m) => !removed.includes(m.memory_id));
  const circle = CIRCLES.find((c) => c.value === loadCircle());
  const importFirst = circle?.importFirst ?? true;

  const invitePerson = () => void action.run("invite", () => nav.replaceView("venn_create_invite", {}));
  const importButton = (
    <button type="button" className={importFirst ? "onb__cta" : "onb__link"} disabled={action.busy !== null}
      aria-expanded={showSources} aria-controls={sourcesId} onClick={() => setShowSources((shown) => !shown)}>
      Import contacts
    </button>
  );
  const importSources = (
    <div id={sourcesId} hidden={!showSources}>
      {showSources && <ContactImportSources action={action} nav={nav} replace />}
    </div>
  );

  return (
    <section className="onb">
      <h2 className="onb__title">{plural(saved.length, "memory", "memories")} imported</h2>
      <p className="onb__body" role="status">
        Saved privately.{kept.some((m) => m.category === "INTEREST") && " Imported interests are now on your profile."}
      </p>
      <button type="button" className="btn" disabled={action.busy !== null} onClick={viewProfile}>View profile</button>
      <ActionError action={action} />
      {importFirst ? (
        <>
          {importButton}
          {importSources}
          <div className="onb__row">
            <button type="button" className="onb__link" onClick={invitePerson}>Invite someone</button>
            {kept.length > 0 && <ReviewList kept={kept} busy={action.busy !== null} remove={remove} />}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="onb__cta" disabled={action.busy !== null} onClick={invitePerson}>
            {action.busy === "invite" ? "Opening…" : invite}
          </button>
          <div className="onb__row">
            {importButton}
            {kept.length > 0 && <ReviewList kept={kept} busy={action.busy !== null} remove={remove} />}
          </div>
          {importSources}
        </>
      )}
    </section>
  );
}

function ReviewList({ kept, busy, remove }: { kept: Memory[]; busy: boolean; remove: (id: string) => void }) {
  return (
    <details className="onb__more">
      <summary>What came over (only you)</summary>
      <ul className="onb__list">
        {kept.map((m) => (
          <li key={m.memory_id}>
            <span>{m.title}</span>
            <button type="button" className="onb__x" aria-label={`Remove ${m.title}`} disabled={busy} onClick={() => remove(m.memory_id)}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
