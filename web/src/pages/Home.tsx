// Home: your circle, and the latest thing a friend shared (read-only). Recommendations arrive as
// ChatGPT messages, not here. No actions, reminders or dashboard.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link } from "../router";
import { useSession } from "../session";
import { firstName, friendPath, joinNames, type DashboardHome, type FriendKind } from "../types";
import {
  Avatar,
  ConfirmDialog,
  ErrorState,
  Loaded,
  Skeleton,
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

interface Shared {
  kind: FriendKind;
  id: string;
  name: string;
  title: string;
  text: string;
}

/** The latest thing a friend chose to share, shown read-only. Recommendations come from ChatGPT, not here. */
async function latestShared(): Promise<Shared | null> {
  const friends = await api.listFriends();
  const onVenn = friends.filter((f) => f.on_venn).slice(0, 6);
  const details = await Promise.all(onVenn.map((f) => api.getFriend(f.kind, f.id).catch(() => null)));
  for (const f of details) {
    const m = f?.shared_memories[0];
    if (f && m) return { kind: f.kind, id: f.id, name: f.display_name, title: m.title, text: m.description || m.title };
  }
  return null;
}

function LatestShared() {
  const shared = useAsync(async () => ({ s: await latestShared() }), []);
  const s = shared.data?.s;
  if (!s) return null;
  return (
    <Link to={friendPath(s.kind, s.id)} className="say">
      <span className="say__text">
        {firstName(s.name)} shared: {/^(I|I'm|I've)\b/.test(s.text) ? s.text : s.text.charAt(0).toLowerCase() + s.text.slice(1)}
      </span>
      <small>Shared by {firstName(s.name)}'s AI · via venn</small>
    </Link>
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
      <h1 id="page-title" className="sr-only">
        Your circle
      </h1>
      <LatestShared />
      <Circle />
      <div className="quiet-lines">
        {home.pending_requests.length > 0 && (
          <Link to="/account" query={{ section: "connect" }} className="quiet-line">
            {joinNames(home.pending_requests.map((r) => firstName(r.sender_display_name)))}{" "}
            {home.pending_requests.length === 1 ? "wants" : "want"} to connect
            <Icon name="chevron-right" size={16} />
          </Link>
        )}
        <Link to="/account" query={{ section: "connect" }} className="quiet-line">
          Invite someone
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
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
