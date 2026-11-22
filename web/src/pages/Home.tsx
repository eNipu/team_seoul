// Home: your circle, and the latest thing a friend shared (read-only). Recommendations arrive as
// ChatGPT messages, not here. No actions, reminders or dashboard.

import { useEffect, useState } from "react";
import { api } from "../api";
import { Link } from "../router";
import { useSession } from "../session";
import { firstName, joinNames, type DashboardHome } from "../types";
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
      These are preview profiles.{" "}
      <button type="button" className="link-btn" onClick={() => setConfirm(true)}>
        Clear preview data
      </button>
      {confirm && (
        <ConfirmDialog
          title="Clear preview data?"
          body={<p>Your own people and memories stay.</p>}
          confirmLabel="Clear preview data"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await api.removeSample();
            toast("Preview data cleared.");
            onRemoved();
          }}
        />
      )}
    </p>
  );
}

const EXAMPLES = [
  { ask: "Any plans this weekend?", text: "Btw, Maya is in Berlin right now and she's into marketing. I think you should reconnect.", who: "Maya" },
  { ask: "Who could help with our launch?", text: "Btw, Daniel just shared he's looking for early users for his fintech app. Worth a hello?", who: "Daniel" },
  { ask: "What should we do Saturday?", text: "Btw, Sofia has wanted to try a pottery class, and there's one Saturday at 11. You both like making things.", who: "Sofia" },
];

/** An example of how Venn shows up in ChatGPT. Marked as an example; real ones arrive in ChatGPT. */
function DemoMoment() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 6000);
    return () => window.clearInterval(t);
  }, []);
  const ex = EXAMPLES[i];
  return (
    <figure className="h2-demo" aria-label="Example of Venn in ChatGPT">
      <figcaption>Example · how Venn speaks up in ChatGPT</figcaption>
      <p className="h2-demo__ask" key={`a${i}`}>{ex.ask}</p>
      <div className="h2-moment" key={`m${i}`}>
        <img className="h2-moment__icon" src={`${import.meta.env.BASE_URL}brand/ai-icon.png`} alt="" width={33} height={35} />
        <p className="h2-moment__text">{ex.text}</p>
        <small className="h2-moment__prov">Shared by {ex.who}&apos;s AI · via <b>venn</b></small>
      </div>
      <div className="h2-demo__dots" aria-hidden="true">{EXAMPLES.map((_, n) => <span key={n} data-on={n === i} />)}</div>
    </figure>
  );
}

function Circle() {
  const friends = useAsync(() => api.listFriends(), []);
  return (
    <Loaded state={friends} skeleton={<Skeleton rows={1} />}>
      {(list) => (
        <Link to="/people" className="h2-stack" aria-label={`Your circle, ${list.length} people`}>
          <span className="h2-stack__faces">
            {list.slice(0, 7).map((f) => <Avatar key={`${f.kind}:${f.id}`} name={f.display_name} size="large" />)}
          </span>
          <span className="h2-stack__label">{list.length} {list.length === 1 ? "person" : "people"} in your circle</span>
        </Link>
      )}
    </Loaded>
  );
}

function Dashboard({ home, reloadHome }: { home: DashboardHome; reloadHome: () => void }) {
  return (
    <div className="page h2">
      <div className="h2__copy">
        <h1 id="page-title" className="h2__title">Build your <mark>inner circle.</mark></h1>
        <DemoMoment />
      </div>
      <div className="h2__side">
        <Circle />
        {home.pending_requests.length > 0 && (
          <Link to="/account" query={{ section: "connect" }} className="h2__quiet">
            {joinNames(home.pending_requests.map((r) => firstName(r.sender_display_name)))}{" "}
            {home.pending_requests.length === 1 ? "wants" : "want"} to connect
          </Link>
        )}
        <Link to="/account" query={{ section: "connect" }} className="btn btn--primary btn--pill h2__invite">
          Invite someone
        </Link>
      </div>
      {home.sample_loaded && <div className="h2__foot"><SampleBanner onRemoved={reloadHome} /></div>}
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
