import { useEffect, useId, useRef, useState } from "react";
import type { HostBridge } from "../mcp/client";
import { parseSaveMemories, plural, type Memory, type MemoryReviewViewData } from "../types";
import { ActionError, useAction, type Nav } from "./common";
import { Icon } from "./icons";
import { StepCount } from "./Welcome";
import { CIRCLES, loadCircle } from "../onboardingCircle";
import ContactImportSources from "./ContactImportSources";
import "./onboarding.css";

// After one tap on Connect: save everything PRIVATE straight away (the tap is the consent),
// show one number, one next step. The list only appears if the user asks to review it.
export default function QuickImport({ data, bridge, nav }: { data: MemoryReviewViewData; bridge: HostBridge; nav: Nav }) {
  const action = useAction();
  const started = useRef(false);
  const [saved, setSaved] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [showSources, setShowSources] = useState(false);
  const sourcesId = useId();

  async function save() {
    setError(null);
    const fresh = data.proposals.filter((p) => !p.already_saved);
    if (fresh.length === 0) { setSaved([]); return; }
    const res = await bridge.callTool("venn_save_memories", {
      proposal_id: data.proposal_id,
      approvals: fresh.map((p) => ({ index: p.index, visibility: "PRIVATE", title: p.title, description: p.description })),
    });
    if (!res.ok) { setError(res.errorText); return; }
    const result = parseSaveMemories(res.data);
    setSaved(result.saved);
    void bridge.updateModelContext(
      `Venn saved ${plural(result.count, "memory", "memories")} privately from the user's one-tap Connect. ` +
      "Next: the card offers to import contacts or invite someone; follow what the user picks.",
      { count: result.count, visibility: "PRIVATE" },
    );
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void save();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function remove(id: string) {
    void action.run(`rm-${id}`, async () => {
      const res = await bridge.callTool("venn_delete_memory", { memory_id: id });
      if (!res.ok) return res.errorText;
      setRemoved((r) => [...r, id]);
      return null;
    });
  }

  if (error) {
    return (
      <section className="onb">
        <h2 className="onb__title">That didn't connect.</h2>
        <p className="small text-danger">{error}</p>
        <button type="button" className="onb__cta" onClick={() => void save()}>Try again</button>
      </section>
    );
  }

  if (saved === null) {
    return (
      <section className="onb" aria-live="polite">
        <h2 className="onb__title">Connecting…</h2>
      </section>
    );
  }

  const invite = CIRCLES.find((c) => c.value === loadCircle())?.invite ?? "Invite your person";
  const kept = saved.filter((m) => !removed.includes(m.memory_id));
  const circle = CIRCLES.find((c) => c.value === loadCircle());
  const importFirst = circle?.importFirst ?? true;

  const invitePerson = () => void action.run("invite", () => nav.openView("venn_create_invite", {}));
  const importButton = (
    <button type="button" className={importFirst ? "onb__cta" : "onb__link"} disabled={action.busy !== null}
      aria-expanded={showSources} aria-controls={sourcesId} onClick={() => setShowSources((shown) => !shown)}>
      Import contacts
    </button>
  );
  const importSources = (
    <div id={sourcesId} hidden={!showSources}>
      {showSources && <ContactImportSources action={action} nav={nav} />}
    </div>
  );

  return (
    <section className="onb">
      <StepCount n={3} />
      <h2 className="onb__title">{importFirst ? "You're in. Now bring your people." : "You're in. Now invite your partner."}</h2>
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
