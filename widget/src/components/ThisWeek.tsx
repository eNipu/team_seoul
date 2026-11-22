import { useState } from "react";
import { firstName, type ThisWeekViewData } from "../types";
import { ActionError, useAction, type ViewProps } from "./common";
import { MomentCard } from "./Moment";

export const PROMISE = "Venn never sends anything for you.";

export default function ThisWeek({ data, bridge, nav }: ViewProps<ThisWeekViewData>) {
  const action = useAction();
  const busy = action.busy !== null;
  const [at, setAt] = useState(0);
  const actions = data.actions;

  function trySample() {
    void action.run("sample", async () => {
      const res = await bridge.callTool("venn_load_sample_circle", {});
      if (!res.ok) return res.errorText;
      return nav.replaceView("venn_this_week", {});
    });
  }

  if (actions.length === 0) {
    return (
      <section className="onb">
        <h2 className="onb__title">Nobody to nudge yet.</h2>
        <p className="onb__body">{data.empty_reason || "Bring your person in and Venn tells you when."}</p>
        <ActionError action={action} />
        <button type="button" className="onb__cta" disabled={busy}
          onClick={() => void action.run("invite", () => nav.openView("venn_create_invite", {}))}>
          {action.busy === "invite" ? "Opening…" : "Invite your person"}
        </button>
        <details className="onb__more">
          <summary>More</summary>
          <div className="onb__more-body">
            <button type="button" className="btn btn--block" disabled={busy}
              onClick={() => void action.run("add", () => nav.openDashboard("friends"))}>
              {action.busy === "add" ? "Opening…" : "Add more people"}
            </button>
            <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={trySample}>
              {action.busy === "sample" ? "Loading…" : "Try with sample friends"}
            </button>
          </div>
        </details>
      </section>
    );
  }

  const a = actions[at % actions.length];
  const next = actions.length > 1 ? actions[(at + 1) % actions.length] : null;
  return (
      <MomentCard
        key={`${a.type}:${a.kind}:${a.id}:${at}`}
        a={a}
        bridge={bridge}
        nav={nav}
        onNext={next ? () => setAt(at + 1) : undefined}
        nextLabel={next ? `Next: ${firstName(next.display_name)}` : undefined}
        eyebrow={`This week · ${(at % actions.length) + 1} of ${actions.length}`}
      />
  );
}
