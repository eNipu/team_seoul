import { useState } from "react";
import { firstName, formatDateTime, isObj, joinNames, plural, type Plan } from "../types";
import type { HostBridge } from "../mcp/client";
import { ActionError, Avatar, SectionTitle, useAction } from "./common";
import { Icon } from "./icons";

/** Slim banner shown while the made-up sample circle is loaded. */
export function SampleBanner({ bridge, onChanged }: { bridge: HostBridge; onChanged: () => Promise<string | null> }) {
  const action = useAction();
  const [confirming, setConfirming] = useState(false);
  const busy = action.busy !== null;

  function remove() {
    void action.run("remove", async () => {
      const res = await bridge.callTool("venn_remove_sample_circle", {});
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.removed !== true) return "Venn couldn't remove the sample data.";
      setConfirming(false);
      return onChanged();
    });
  }

  return (
    <section className="sample-banner" aria-label="Sample data">
      <div className="sample-banner__row">
        <span className="sample-banner__text">
          <Icon name="sparkle" size={18} />
          <span>
            <strong>Sample data is loaded.</strong> Fictional profiles are marked Sample.
          </span>
        </span>
        {!confirming && (
          <button type="button" className="btn btn--small" disabled={busy} onClick={() => setConfirming(true)}>
            Remove sample data
          </button>
        )}
      </div>
      {confirming && (
        <div className="confirm confirm--plain">
          <span className="small">Remove all sample data, including any edits to samples? Your own data stays.</span>
          <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={remove}>
            {action.busy === "remove" ? "Removing…" : "Remove"}
          </button>
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </div>
      )}
      <ActionError action={action} />
    </section>
  );
}

function PlanRow({
  plan,
  bridge,
  onDone,
  onDeleted,
}: {
  plan: Plan;
  bridge: HostBridge;
  onDone: (plan: Plan, logged: number) => void;
  onDeleted: (plan: Plan) => void;
}) {
  const action = useAction();
  const [confirming, setConfirming] = useState(false);
  const busy = action.busy !== null;
  const when = formatDateTime(plan.planned_for);
  const names = plan.members.map((m) => firstName(m.display_name));

  function complete() {
    void action.run("done", async () => {
      const res = await bridge.callTool("venn_complete_plan", { plan_id: plan.plan_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.done !== true) return "Venn couldn't mark that plan as done.";
      onDone(plan, typeof res.data.logged === "number" ? res.data.logged : plan.members.length);
      return null;
    });
  }

  function remove() {
    void action.run("delete", async () => {
      const res = await bridge.callTool("venn_delete_plan", { plan_id: plan.plan_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.deleted !== true) return "Venn couldn't delete that plan.";
      onDeleted(plan);
      return null;
    });
  }

  return (
    <li className="card plan">
      <div className="plan__head">
        <span className={`plan__date ${when ? "" : "plan__date--none"}`}>
          <Icon name="calendar" size={14} />
          {when || "No date yet"}
        </span>
        <strong className="card__title">{plan.title}</strong>
        {plan.details && <p className="muted small plan__details">{plan.details}</p>}
      </div>
      {plan.members.length > 0 && (
        <div className="plan__members">
          <span className="avatar-stack avatar-stack--small" aria-hidden="true">
            {plan.members.map((m) => (
              <Avatar key={`${m.kind}:${m.id}`} name={m.display_name} size="small" />
            ))}
          </span>
          <span className="small">With {joinNames(names)}</span>
        </div>
      )}
      <ActionError action={action} />
      {confirming ? (
        <div className="confirm">
          <span className="small">Delete this plan? No hangout will be logged.</span>
          <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={remove}>
            {action.busy === "delete" ? "Deleting…" : "Delete"}
          </button>
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </div>
      ) : (
        <div className="card__actions">
          <button type="button" className="btn btn--small" disabled={busy} onClick={complete}>
            <Icon name="check" size={16} />
            {action.busy === "done" ? "Saving…" : "Done"}
          </button>
          <span className="muted small plan__hint">
            {plan.members.length > 0 ? `Logs a hangout with ${plan.members.length === 1 ? names[0] : "each of them"}.` : ""}
          </span>
          <button
            type="button"
            className="btn btn--danger-quiet btn--small btn--icon"
            disabled={busy}
            aria-label={`Delete plan: ${plan.title}`}
            onClick={() => setConfirming(true)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

/** Saved plans. Renders nothing when there are none and nothing was just completed. */
export function Plans({ plans, bridge, onChanged }: { plans: Plan[]; bridge: HostBridge; onChanged: (next: Plan[]) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  if (plans.length === 0 && message === null) return null;

  function done(plan: Plan, logged: number) {
    const names = plan.members.map((m) => firstName(m.display_name));
    const who =
      logged === 0
        ? "No hangout was logged because the plan had no friends on it."
        : logged === names.length
          ? `Logged a hangout with ${joinNames(names)}.`
          : `Logged ${plural(logged, "hangout", "hangouts")}.`;
    setMessage(`“${plan.title}” is done. ${who}`);
    onChanged(plans.filter((p) => p.plan_id !== plan.plan_id));
  }

  function deleted(plan: Plan) {
    setMessage(`Deleted “${plan.title}”.`);
    onChanged(plans.filter((p) => p.plan_id !== plan.plan_id));
  }

  return (
    <section className="panel plans" aria-label="Plans">
      <SectionTitle count={plans.length || undefined}>Plans</SectionTitle>
      {message && (
        <p className="logged-row" role="status">
          <Icon name="check" size={16} />
          <span>{message}</span>
        </p>
      )}
      {plans.length > 0 && (
        <ul className="list list--tight">
          {plans.map((p) => (
            <PlanRow key={p.plan_id} plan={p} bridge={bridge} onDone={done} onDeleted={deleted} />
          ))}
        </ul>
      )}
    </section>
  );
}
