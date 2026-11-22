// Home: one recommendation from what a friend chose to share (their AI's signal meets yours),
// one action, then your circle. No reminders, no dashboard.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link } from "../router";
import { useSession } from "../session";
import { firstName, friendPath, joinNames, plural, type DashboardHome, type FriendKind } from "../types";
import {
  Avatar,
  ConfirmDialog,
  CopyButton,
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

interface Signal {
  kind: FriendKind;
  id: string;
  name: string;
  /** One plain message, the way ChatGPT would say it. */
  message: string;
  draft: string;
  /** "Shared by Priya's AI · via venn", or Venn's own suggestion. */
  provenance: string;
}

const lower = (s: string) => s.trim().toLowerCase();

/** "Shoots medium format." -> "Jun shoots medium format."; first-person lines are quoted. */
function retell(first: string, said: string): string {
  const t = said.trim().replace(/[.!]+$/, "");
  if (/^(I|I'm|I've|My|We|We're|Our)\b/.test(t)) return `${first} shared “${t}.”`;
  return `${first} ${t.charAt(0).toLowerCase()}${t.slice(1)}.`;
}

/** Pick the strongest thing a friend chose to share that meets something you care about. */
async function findSignal(): Promise<Signal | null> {
  const friends = await api.listFriends();
  const onVenn = friends.filter((f) => f.on_venn).slice(0, 6);
  const details = await Promise.all(onVenn.map((f) => api.getFriend(f.kind, f.id).catch(() => null)));
  let best: { score: number; signal: Signal } | null = null;
  for (const f of details) {
    if (!f) continue;
    const mine = new Set(f.shared_interests.map(lower));
    for (const m of f.shared_memories) {
      const overlap = m.tags.find((t) => mine.has(lower(t)));
      const score =
        (overlap ? 2 : 0) + (m.category === "INTEREST" || m.category === "PREFERENCE" ? 0 : 1) + (m.description ? 1 : 0);
      const first = firstName(f.display_name);
      const signal: Signal = {
        kind: f.kind,
        id: f.id,
        name: f.display_name,
        message: `Btw, ${retell(first, m.description || m.title)}${overlap ? ` You're into ${overlap} too.` : ""} I think you should reconnect.`,
        draft: `Hey ${first}, saw you're into ${lower(m.title)}. I'm in, when are you free?`,
        provenance: `Shared by ${first}'s AI · via venn`,
      };
      if (!best || score > best.score) best = { score, signal };
    }
  }
  if (best) return best.signal;
  // Nobody has shared anything yet: fall back to Venn's own idea from your saved interests.
  const { idea } = await api.getCircleIdea();
  if (!idea) return null;
  return {
    kind: idea.person.kind,
    id: idea.person.id,
    name: idea.person.display_name,
    message: `Btw, ${firstName(idea.person.display_name)} is into ${idea.topic}, like you. I think you should reach out.`,
    draft: idea.draft,
    provenance: "Suggested by Venn · only you see this",
  };
}

function NextMoment() {
  const signal = useAsync(async () => ({ s: await findSignal() }), []);
  return (
    <Loaded state={signal} skeleton={<Skeleton rows={2} />}>
      {({ s }) =>
        s === null ? (
          <section className="next">
            <h1 id="page-title" className="next__title">
              Nothing new from your circle yet.
            </h1>
            <div className="next__actions">
              <Link to="/account" query={{ section: "connect" }} className="btn btn--primary btn--pill">
                Invite a friend
              </Link>
            </div>
          </section>
        ) : (
          <section className="next" aria-labelledby="page-title">
            <h1 id="page-title" className="sr-only">
              From your circle
            </h1>
            <Link to={friendPath(s.kind, s.id)} className="say">
              <span className="say__text">{s.message}</span>
              <small>{s.provenance}</small>
            </Link>
            <div className="next__actions">
              <CopyButton text={s.draft} label="Say hi" className="btn btn--primary btn--pill" icon={false} />
            </div>
          </section>
        )
      }
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
      <NextMoment />
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
