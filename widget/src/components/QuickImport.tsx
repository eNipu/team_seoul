import { useEffect, useRef, useState } from "react";
import type { HostBridge } from "../mcp/client";
import { parseSaveMemories, plural, type Memory, type MemoryReviewViewData } from "../types";
import { ActionError, useAction, type Nav } from "./common";
import { Icon } from "./icons";
import { StepCount } from "./Welcome";
import { CIRCLES, loadCircle } from "../onboardingCircle";
import "./onboarding.css";

// After one tap on Connect: save everything PRIVATE straight away (the tap is the consent),
// show one number, one next step. The list only appears if the user asks to review it.
export default function QuickImport({ data, bridge, nav }: { data: MemoryReviewViewData; bridge: HostBridge; nav: Nav }) {
  const action = useAction();
  const started = useRef(false);
  const [saved, setSaved] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);

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
      "Next: ask in one short line who they want closer (a partner or a friend), then call venn_create_invite.",
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
  return (
    <section className="onb">
      <StepCount n={3} />
      <h2 className="onb__title">You're in.</h2>
      {kept.length > 0 && (
        <ul className="onb__saved" aria-label="Saved privately">
          {kept.slice(0, 3).map((m) => <li key={m.memory_id}>{m.title}</li>)}
          {kept.length > 3 && <li className="onb__saved-more">+{kept.length - 3} more</li>}
        </ul>
      )}
      <ActionError action={action} />
      <button type="button" className="onb__cta" disabled={action.busy !== null}
        onClick={() => void action.run("invite", () => nav.openView("venn_create_invite", {}))}>
        {action.busy === "invite" ? "Opening…" : invite}
      </button>
      {kept.length > 0 && (
        <details className="onb__more">
          <summary>Review all</summary>
          <ul className="onb__list">
            {kept.map((m) => (
              <li key={m.memory_id}>
                <span>{m.title}</span>
                <button type="button" className="onb__x" aria-label={`Remove ${m.title}`}
                  disabled={action.busy !== null} onClick={() => remove(m.memory_id)}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
