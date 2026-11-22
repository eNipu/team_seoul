import { useEffect, useRef, useState } from "react";
import type { HostBridge } from "../mcp/client";
import { parseSaveMemories, plural, type Memory, type MemoryReviewViewData } from "../types";
import { ActionError, ChatFallback, useAction, type Nav } from "./common";
import { Icon } from "./icons";
import { StepCount } from "./Welcome";
import { CIRCLES, loadCircle } from "../onboardingCircle";
import { IMPORT_CONTACTS_PROMPT } from "../memoryImport";
import "./onboarding.css";

// After one tap on Connect: save everything PRIVATE straight away (the tap is the consent),
// show one number, one next step. The list only appears if the user asks to review it.
export default function QuickImport({ data, bridge, nav }: { data: MemoryReviewViewData; bridge: HostBridge; nav: Nav }) {
  const action = useAction();
  const started = useRef(false);
  const [saved, setSaved] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [importSent, setImportSent] = useState<"sent" | "fallback" | null>(null);

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

  async function importContacts() {
    if (action.busy !== null) return;
    let sent = false;
    try { sent = await bridge.sendMessage(IMPORT_CONTACTS_PROMPT); } catch { sent = false; }
    setImportSent(sent ? "sent" : "fallback");
  }
  const invitePerson = () => void action.run("invite", () => nav.openView("venn_create_invite", {}));

  if (importSent) {
    return (
      <section className="onb" aria-live="polite">
        <StepCount n={3} />
        <h2 className="onb__title">Upload or paste your contacts in the chat.</h2>
        {importSent === "fallback" && <ChatFallback text={IMPORT_CONTACTS_PROMPT} />}
      </section>
    );
  }

  return (
    <section className="onb">
      <StepCount n={3} />
      <h2 className="onb__title">{importFirst ? "You're in. Now bring your people." : "You're in. Now invite your partner."}</h2>
      <ActionError action={action} />
      {importFirst ? (
        <>
          <button type="button" className="onb__cta" disabled={action.busy !== null} onClick={() => void importContacts()}>
            Import contacts
          </button>
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
            <button type="button" className="onb__link" onClick={() => void importContacts()}>Import contacts</button>
            {kept.length > 0 && <ReviewList kept={kept} busy={action.busy !== null} remove={remove} />}
          </div>
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
