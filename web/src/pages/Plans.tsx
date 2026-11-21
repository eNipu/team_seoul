// Plans: things you mean to do with friends, and the ones you did.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link, navigate, useLocation } from "../router";
import { LIMITS, firstName, formatDateTime, friendPath, joinNames, plural, type Plan, type PlanInput } from "../types";
import {
  CalendarLink,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  FriendPicker,
  InlineError,
  Loaded,
  PageHeader,
  Skeleton,
  Tag,
  splitKey,
  useAction,
  useAsync,
  useToast,
} from "../ui";

function NewPlanForm({ onSaved, onCancel }: { onSaved: (plan: Plan) => void; onCancel: () => void }) {
  const friends = useAsync(() => api.listFriends(), []);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const action = useAction();

  const submit = () => {
    if (!title.trim()) {
      setTitleError("Give the plan a title.");
      return;
    }
    setTitleError(null);
    const input: PlanInput = { title: title.trim() };
    if (details.trim()) input.details = details.trim();
    if (when) {
      const d = new Date(when);
      if (!Number.isNaN(d.getTime())) input.planned_for = d.toISOString();
    }
    const picked = members.map(splitKey);
    const connections = picked.filter((m) => m.kind === "connection").map((m) => m.id);
    const people = picked.filter((m) => m.kind === "person").map((m) => m.id);
    if (connections.length) input.connection_ids = connections;
    if (people.length) input.person_ids = people;
    void action.run(async () => onSaved(await api.createPlan(input)));
  };

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Title" error={titleError}>
        {(p) => (
          <input
            {...p}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.planTitle}
            placeholder="Golden-hour photo walk"
            autoFocus
          />
        )}
      </Field>
      <Field label="Details" optional>
        {(p) => (
          <textarea {...p} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={LIMITS.planDetails} />
        )}
      </Field>
      <Field label="When" optional hint="Leave empty if you haven't picked a time.">
        {(p) => <input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}
      </Field>
      <FriendPicker
        friends={friends.data ?? []}
        selected={members}
        onChange={setMembers}
        max={LIMITS.planMembers}
        legend="With whom"
      />
      <InlineError message={action.error ?? friends.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={action.busy}>
          {action.busy ? "Saving…" : "Save plan"}
        </button>
      </div>
    </form>
  );
}

function PlanCard({ plan, onDone, onDelete }: { plan: Plan; onDone: () => void; onDelete: () => void }) {
  const done = plan.status === "done";
  return (
    <li className={`plan card ${done ? "plan--done" : ""}`}>
      <div className="plan__date" aria-hidden="true">
        <Icon name={done ? "check-circle" : "calendar"} size={22} />
      </div>
      <div className="plan__main">
        <div className="plan__head">
          <h3>{plan.title}</h3>
          {done && (
            <Tag tone="success" icon="check">
              Done
            </Tag>
          )}
        </div>
        <p className="muted">{plan.planned_for ? formatDateTime(plan.planned_for) : "No date yet"}</p>
        {plan.details && <p>{plan.details}</p>}
        {plan.members.length > 0 && (
          <p className="plan__with">
            With{" "}
            {plan.members.map((m, i) => (
              <span key={`${m.kind}:${m.id}`}>
                {i > 0 && ", "}
                <Link to={friendPath(m.kind, m.id)}>{m.display_name}</Link>
              </span>
            ))}
          </p>
        )}
        <div className="row">
          {!done && (
            <>
              <button type="button" className="btn btn--small btn--primary" onClick={onDone}>
                <Icon name="check" size={16} />
                Done
              </button>
              <CalendarLink
                title={plan.title}
                details={plan.details ?? ""}
                start={plan.planned_for ? new Date(plan.planned_for) : null}
              />
            </>
          )}
          <button type="button" className="btn btn--small btn--quiet-danger" onClick={onDelete}>
            <Icon name="trash" size={16} />
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

export default function Plans() {
  const loc = useLocation();
  const plans = useAsync(() => api.listPlans("all"), []);
  const toast = useToast();
  const [finishing, setFinishing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const adding = loc.query.get("new") === "1";
  const close = () => navigate("/plans", {}, { replace: true });
  const newPlan = (
    <Link to="/plans" query={{ new: "1" }} className="btn btn--primary">
      <Icon name="plus" size={18} />
      New plan
    </Link>
  );

  return (
    <div className="page">
      <PageHeader title="Plans" lead="Things you mean to do together. Marking one done logs the hangout." actions={newPlan} />
      <Loaded state={plans} skeleton={<Skeleton rows={3} />}>
        {(list) => {
          if (list.length === 0) {
            return (
              <EmptyState illustration="ideas" title="No plans yet" actions={newPlan}>
                <p>Start with something small: a walk, a coffee, a game night.</p>
              </EmptyState>
            );
          }
          const planned = list.filter((p) => p.status === "planned");
          const done = list.filter((p) => p.status === "done");
          return (
            <>
              <section className="results-section">
                <h2>
                  Planned <span className="count-badge">{planned.length}</span>
                </h2>
                {planned.length === 0 ? (
                  <p className="muted">Nothing planned right now.</p>
                ) : (
                  <ul className="plans">
                    {planned.map((p) => (
                      <PlanCard key={p.plan_id} plan={p} onDone={() => setFinishing(p)} onDelete={() => setDeleting(p)} />
                    ))}
                  </ul>
                )}
              </section>
              {done.length > 0 && (
                <section className="results-section">
                  <h2>
                    Done <span className="count-badge">{done.length}</span>
                  </h2>
                  <ul className="plans">
                    {done.map((p) => (
                      <PlanCard key={p.plan_id} plan={p} onDone={() => undefined} onDelete={() => setDeleting(p)} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          );
        }}
      </Loaded>

      {adding && (
        <Dialog title="New plan" onClose={close}>
          <NewPlanForm
            onCancel={close}
            onSaved={(p) => {
              toast(`Saved “${p.title}”.`);
              close();
              plans.reload();
            }}
          />
        </Dialog>
      )}
      {finishing && (
        <ConfirmDialog
          title="Mark this plan done?"
          body={
            <p>
              {finishing.members.length > 0
                ? `This marks “${finishing.title}” as done and logs a hangout today with ${joinNames(
                    finishing.members.map((m) => firstName(m.display_name)),
                  )}, so Venn knows when you last saw each of them.`
                : `This marks “${finishing.title}” as done. No one is on this plan, so no hangout is logged.`}
            </p>
          }
          confirmLabel="Mark done"
          onClose={() => setFinishing(null)}
          onConfirm={async () => {
            const r = await api.completePlan(finishing.plan_id);
            toast(r.logged > 0 ? `Done. Logged ${plural(r.logged, "hangout", "hangouts")}.` : "Plan marked done.");
            plans.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this plan?"
          body={<p>“{deleting.title}” will be removed. Hangouts already logged stay.</p>}
          confirmLabel="Delete plan"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deletePlan(deleting.plan_id);
            toast("Plan deleted.");
            plans.reload();
          }}
        />
      )}
    </div>
  );
}
