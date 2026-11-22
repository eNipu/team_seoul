// Home: the next moment (who to reach out to, why, one action) and your circle. Nothing else.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link } from "../router";
import { useSession } from "../session";
import { LIMITS, firstName, friendPath, joinNames, plural, type DashboardHome, type WeekAction } from "../types";
import {
  Avatar,
  ConfirmDialog,
  CopyButton,
  ErrorState,
  InlineError,
  Loaded,
  Skeleton,
  useAction,
  useAsync,
  useToast,
} from "../ui";

export function SampleBanner({ onRemoved }: { onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  return (
    <p className="sample-line" role="status">
      These are sample friends.{" "}
      <button type="button" className="link-btn" onClick={() => setConfirm(true)}>
        Remove them
      </button>
      {confirm && (
        <ConfirmDialog
          title="Remove the sample friends?"
          body={<p>Your own people and memories stay.</p>}
          confirmLabel="Remove sample data"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await api.removeSample();
            toast("Sample data removed.");
            onRemoved();
          }}
        />
      )}
    </p>
  );
}

/** What the yellow card says: the message to send, the thing to ask, or the plan. */
function momentText(a: WeekAction): string {
  if (a.type === "reach_out" && a.draft_message) return a.draft_message;
  if (a.type === "follow_up" && a.follow_up) return a.follow_up.text;
  if (a.type === "plan" && a.suggestion) return a.suggestion.title;
  return a.reason;
}

function MomentAction({ action, onChanged }: { action: WeekAction; onChanged: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [saved, setSaved] = useState(false);
  const s = action.suggestion;
  let button = (
    <Link to={friendPath(action.kind, action.id)} className="btn btn--primary btn--pill">
      Open {firstName(action.display_name)}
    </Link>
  );
  if (action.type === "reach_out" && action.draft_message) {
    button = <CopyButton text={action.draft_message} label="Copy message" className="btn btn--primary btn--pill" icon={false} />;
  } else if (action.type === "follow_up" && action.follow_up) {
    button = (
      <button
        type="button"
        className="btn btn--primary btn--pill"
        disabled={act.busy}
        onClick={() =>
          void act.run(async () => {
            await api.completeFollowUp(action.follow_up?.follow_up_id ?? "");
            toast("Done.");
            onChanged();
          })
        }
      >
        Mark done
      </button>
    );
  } else if (action.type === "plan" && s) {
    button = (
      <button
        type="button"
        className="btn btn--primary btn--pill"
        disabled={act.busy || saved}
        onClick={() =>
          void act.run(async () => {
            await api.createPlan({
              title: s.title.slice(0, LIMITS.planTitle),
              details: s.description.slice(0, LIMITS.planDetails) || undefined,
              ...(action.kind === "connection" ? { connection_ids: [action.id] } : { person_ids: [action.id] }),
            });
            setSaved(true);
            toast(`Plan saved with ${firstName(action.display_name)}.`);
            onChanged();
          })
        }
      >
        {saved ? "Plan saved" : "Save plan"}
      </button>
    );
  }
  return (
    <>
      {button}
      <InlineError message={act.error} />
    </>
  );
}

function NextMoment({ onChanged }: { onChanged: () => void }) {
  const week = useAsync(() => api.getThisWeek(), []);
  
  return (
    <Loaded state={week} skeleton={<Skeleton rows={2} />}>
      {(w) => {
        const actions = [...w.actions].sort((a, b) => Number(b.type === "follow_up") - Number(a.type === "follow_up"));
        if (actions.length === 0) {
          return (
            <section className="next">
              <h1 id="page-title" className="next__title">
                You're all caught up.
              </h1>
            </section>
          );
        }
        const a = actions[0];
        return (
          <section className="next" aria-labelledby="page-title">
            <h1 id="page-title" className="next__title">
              {a.title}.
            </h1>
            <Link to={friendPath(a.kind, a.id)} className="moment" aria-label={`${a.display_name}: ${a.reason}`}>
              <span className="moment__who">
                <Avatar name={a.display_name} size="small" />
                <span>{a.type === "follow_up" ? a.display_name : a.reason}</span>
              </span>
              <span className="moment__text">{momentText(a)}</span>
              <small>Only you see this · via venn.</small>
            </Link>
            <div className="next__actions">
              <MomentAction
                key={`${a.type}:${a.id}`}
                action={a}
                onChanged={() => {
                  week.reload();
                  onChanged();
                }}
              />
            </div>
          </section>
        );
      }}
    </Loaded>
  );
}

function Circle() {
  const friends = useAsync(() => api.listFriends(), []);
  return (
    <section className="circle" aria-labelledby="circle-title">
      <h2 id="circle-title">
        <Link to="/people" className="circle__title">Your circle</Link>
      </h2>
      <Loaded state={friends} skeleton={<Skeleton rows={1} />}>
        {(list) => (
          <ul className="circle__list">
            {list.slice(0, 12).map((f) => (
              <li key={`${f.kind}:${f.id}`}>
                <Link to={friendPath(f.kind, f.id)} className="circle__person">
                  <Avatar name={f.display_name} size="large" />
                  <span>{firstName(f.display_name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Loaded>
    </section>
  );
}

function Dashboard({ home, reloadHome }: { home: DashboardHome; reloadHome: () => void }) {
  return (
    <div className="page page--home">
      <NextMoment onChanged={reloadHome} />
      <Circle />
      {(home.pending_requests.length > 0 || home.pending_answers > 0) && (
        <div className="quiet-lines">
          {home.pending_requests.length > 0 && (
            <Link to="/account" query={{ section: "connect" }} className="quiet-line">
              {joinNames(home.pending_requests.map((r) => firstName(r.sender_display_name)))}{" "}
              {home.pending_requests.length === 1 ? "wants" : "want"} to connect
              <Icon name="chevron-right" size={16} />
            </Link>
          )}
          {home.pending_answers > 0 && (
            <Link to="/answers" className="quiet-line">
              {plural(home.pending_answers, "friend", "friends")} answered
              <Icon name="chevron-right" size={16} />
            </Link>
          )}
        </div>
      )}
      {home.sample_loaded && <SampleBanner onRemoved={reloadHome} />}
    </div>
  );
}

/** Someone signed in here before using Venn in ChatGPT: one line, one button. */
function Welcome({ name }: { name: string }) {
  return (
    <div className="page page--home">
      <section className="next">
        <h1 id="page-title" className="next__title">
          Hi {firstName(name) || "there"}. Venn lives in ChatGPT.
        </h1>
        <div className="next__actions">
          <Link to="/account" query={{ section: "chatgpt" }} className="btn btn--primary btn--pill">
            Get Venn in ChatGPT
          </Link>
          <Link to="/people" query={{ new: "1", from: "setup" }} className="link-btn">
            Add someone here
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const home = useAsync(() => api.getHome(), []);
  const { displayName } = useSession();
  if (home.data === null) {
    if (home.error) {
      return (
        <div className="page">
          <ErrorState message={home.error} onRetry={home.reload} />
        </div>
      );
    }
    return (
      <div className="page page--home">
        <Skeleton kind="page" rows={3} />
      </div>
    );
  }
  if (home.data.view === "welcome") return <Welcome name={home.data.display_name || displayName} />;
  return <Dashboard home={home.data} reloadHome={home.reload} />;
}
