// Home: start with a person or a plan, not a chat.

import { useState, type ReactNode } from "react";
import quickstartUrl from "../../../docs/Venn-Quickstart.pdf?url";
import { api } from "../api";
import { Icon, Illustration, type IconName } from "../icons";
import { Link, navigate, type Query } from "../router";
import { useSession } from "../session";
import {
  LIMITS,
  firstName,
  formatDateTime,
  friendPath,
  joinNames,
  plural,
  type DashboardHome,
  type SetupStep,
  type WeekAction,
} from "../types";
import {
  Avatar,
  CalendarLink,
  Card,
  ConfirmDialog,
  CopyButton,
  ErrorState,
  FriendLink,
  InlineError,
  Loaded,
  Skeleton,
  Tag,
  useAction,
  useAsync,
  useToast,
} from "../ui";
import { TickButton } from "./shared";
import { CircleIdea } from "./CircleIdea";
import { OverlapEntry } from "./OverlapEntry";

const EXAMPLES = ["photography", "board games", "climbing", "lives in Lisbon"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function HomeGreeting({ children }: { children: ReactNode }) {
  return (
    <div className="home-greeting">
      <h1 id="page-title">{children}</h1>
      <div className="home-greeting__actions">
        <a className="btn" href="https://chatgpt.com/plugins">
          Open ChatGPT Plugin
        </a>
        <a
          className="btn home-greeting__help"
          href={quickstartUrl}
          target="_blank"
          rel="noopener"
          aria-label="Venn Quickstart Guide (PDF, opens in a new tab)"
          title="Venn Quickstart Guide (PDF)"
        >
          <Icon name="help" />
        </a>
      </div>
    </div>
  );
}

function HeroSearch() {
  const [q, setQ] = useState("");
  return (
    <section className="hero-search" aria-label="Search your circle">
      <form
        className="hero-search__form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate("/search", { q: q.trim() });
        }}
      >
        <Icon name="search" size={22} />
        <input
          type="search"
          id="circle-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Who do I know who…"
          aria-label="Who do I know who…"
          maxLength={LIMITS.searchQuery}
          enterKeyHint="search"
        />
        <button type="submit" className="btn btn--primary">
          Search
        </button>
      </form>
      <p className="hero-search__examples">
        <span>Try</span>
        {EXAMPLES.map((e) => (
          <Link key={e} to="/search" query={{ q: e }} className="chip chip--link">
            {e}
          </Link>
        ))}
      </p>
    </section>
  );
}

function PreviewCleanup({ onRemoved }: { onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  return (
    <div>
      <button type="button" className="btn btn--small" onClick={() => setConfirm(true)}>
        Clear preview data
      </button>
      {confirm && (
        <ConfirmDialog
          title="Clear preview data?"
          body={
            <p>
              This removes preview profiles, their notes and follow-ups (including edits), and preview memories. Your own
              contacts and memories stay.
            </p>
          }
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
    </div>
  );
}

const TYPE_LABEL: Record<WeekAction["type"], { label: string; icon: IconName }> = {
  reach_out: { label: "Reach out", icon: "send" },
  follow_up: { label: "Follow up", icon: "flag" },
  plan: { label: "Make a plan", icon: "calendar" },
};

function WeekActionCard({ action, onChanged }: { action: WeekAction; onChanged: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [saved, setSaved] = useState(false);
  const meta = TYPE_LABEL[action.type];
  const s = action.suggestion;
  return (
    <li className="week-item">
      <div className="week-item__head">
        <Avatar name={action.display_name} />
        <div className="week-item__text">
          <Tag tone="brand" icon={meta.icon}>
            {meta.label}
          </Tag>
          <h3>
            <Link to={friendPath(action.kind, action.id)}>{action.title}</Link>
          </h3>
          <p className="reason">{action.reason}</p>
        </div>
      </div>
      {action.type === "reach_out" && action.draft_message && (
        <div className="draft">
          <p className="draft__label">A message you could send</p>
          <blockquote>{action.draft_message}</blockquote>
          <CopyButton text={action.draft_message} label="Copy message" />
        </div>
      )}
      {action.type === "follow_up" && action.follow_up && (
        <div className="week-item__row">
          <p className="quote-line">{action.follow_up.text}</p>
          <button
            type="button"
            className="btn btn--small"
            disabled={act.busy}
            onClick={() =>
              void act.run(async () => {
                await api.completeFollowUp(action.follow_up?.follow_up_id ?? "");
                toast("Follow-up done.");
                onChanged();
              })
            }
          >
            <Icon name="check" size={16} />
            Done
          </button>
        </div>
      )}
      {action.type === "plan" && s && (
        <div className="week-item__plan">
          <p>
            <strong>{s.title}</strong>
            {s.description ? ` — ${s.description}` : ""}
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn--small btn--primary"
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
              <Icon name={saved ? "check" : "bookmark"} size={16} />
              {saved ? "Plan saved" : "Save plan"}
            </button>
            <CalendarLink title={s.title} details={s.description} />
          </div>
        </div>
      )}
      <InlineError message={act.error} />
    </li>
  );
}

// Only link to known, local flows. The API remains the source of truth for completion.
const SETUP_ACTIONS = new Map<string, { to: string; query: Query; hint: string }>([
  ["about_you", { to: "/memories", query: { new: "1", from: "setup" }, hint: "Save an interest, preference or memory about yourself." }],
  ["your_people", { to: "/people", query: { new: "1", from: "setup" }, hint: "Add someone you want to stay in touch with. A name is enough." }],
  ["connect", { to: "/account", query: { section: "connect", from: "setup" }, hint: "Create an invite link to share with a friend." }],
]);

function SetupSteps({ steps }: { steps: SetupStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="setup">
      {steps.map((s) => {
        const action = SETUP_ACTIONS.get(s.key);
        const content = (
          <>
            <span className="setup__mark" aria-hidden="true">{s.done && <Icon name="check" size={14} />}</span>
            <span>
              <strong>{s.title}</strong>{s.done && <span className="sr-only"> (done)</span>}
              <span className="setup__hint">{action?.hint ?? s.description}</span>
            </span>
          </>
        );
        return (
          <li key={s.key}>
            {!s.done && action ? (
              <Link to={action.to} query={action.query} className="setup__step setup__step--link">
                {content}<Icon name="chevron-right" size={18} />
              </Link>
            ) : <div className={`setup__step${s.done ? " setup__step--done" : ""}`}>{content}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function Welcome({ name, steps, onLoaded }: { name: string; steps: SetupStep[]; onLoaded: () => void }) {
  const act = useAction();
  const toast = useToast();
  return (
    <div className="page page--narrow">
      <section className="welcome">
        <Illustration name="welcome" size="lg" />
        <HomeGreeting>Welcome to Venn, {firstName(name) || "friend"}</HomeGreeting>
        <p className="lead">
          A private place to stay close to the people who matter. Start with a person or a plan — your friends don't need to
          join for Venn to be useful.
        </p>
      </section>
      <div className="starts">
        <Link to="/people" query={{ new: "1", from: "setup" }} className="start">
          <span className="start__icon">
            <Icon name="user-plus" size={22} />
          </span>
          <strong>Add your first person</strong>
          <span>A name and a few things you want to remember about them.</span>
        </Link>
        <Link to="/memories" query={{ new: "1", from: "setup" }} className="start">
          <span className="start__icon">
            <Icon name="bookmark" size={22} />
          </span>
          <strong>Save something about you</strong>
          <span>An interest, a preference or a memory. Private unless you say otherwise.</span>
        </Link>
        <button
          type="button"
          className="start"
          disabled={act.busy}
          onClick={() =>
            void act.run(async () => {
              const r = await api.loadSample();
              toast(`Starter circle ready: ${plural(r.connections + r.people, "person", "people")}.`);
              onLoaded();
            })
          }
        >
          <span className="start__icon">
            <Icon name="sparkle" size={22} />
          </span>
          <strong>{act.busy ? "Loading starter circle…" : "Explore a starter circle"}</strong>
          <span>Explore Venn with a built-in circle instead of importing your contacts.</span>
        </button>
      </div>
      <InlineError message={act.error} />
      <OverlapEntry />
      {steps.length > 0 && (
        <Card title="Getting set up" icon="sprout">
          <SetupSteps steps={steps} />
        </Card>
      )}
    </div>
  );
}

function Dashboard({ home, reloadHome }: { home: DashboardHome; reloadHome: () => void }) {
  const week = useAsync(() => api.getThisWeek(), []);
  const followUps = useAsync(() => api.listFollowUps(), []);
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const topAction = week.data?.actions.find((a) => a.type === "follow_up") ?? week.data?.actions[0];
  const otherActions = week.data?.actions.filter((a) => a !== topAction) ?? [];
  const upcoming = home.plans.filter((p) => p.status === "planned");
  const refresh = () => {
    week.reload();
    followUps.reload();
    reloadHome();
  };
  const openSetup = home.setup.filter((s) => !s.done);

  return (
    <div className="page">
      <header className="home-head">
        <HomeGreeting>
          {greeting()}, {firstName(home.profile.display_name)}
        </HomeGreeting>
        <p className="lead">Start with a person or a plan.</p>
      </header>

      <Card title="This week" icon="sparkle" className="card--feature">
        <Loaded state={week} skeleton={<Skeleton rows={1} />}>
          {(w) => topAction ? (
            <>
              <ul className="week">
                <WeekActionCard key={`${topAction.type}:${topAction.kind}:${topAction.id}:${topAction.follow_up?.follow_up_id ?? ""}`} action={topAction} onChanged={refresh} />
              </ul>
              <p className="fine">
                <Icon name="shield" size={14} />
                Venn never sends anything for you.
              </p>
            </>
          ) : (
            <p className="muted">{w.empty_reason || "Nothing needs your attention this week."}</p>
          )}
        </Loaded>
      </Card>

      <CircleIdea key={String(home.sample_loaded)} onDismiss={() => document.getElementById("circle-search")?.focus()} />
      <OverlapEntry />
      <HeroSearch />

      {home.pending_answers > 0 && (
        <Link to="/answers" className="callout">
          <Icon name="chat" size={20} />
          <span>
            <strong>{plural(home.pending_answers, "answer", "answers")} waiting for review</strong>
            <span className="callout__sub">Nothing is saved until you approve it.</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </Link>
      )}
      {home.pending_requests.length > 0 && (
        <Link to="/account" query={{ section: "connect" }} className="callout">
          <Icon name="user-plus" size={20} />
          <span>
            <strong>
              {joinNames(home.pending_requests.map((r) => r.sender_display_name))}{" "}
              {home.pending_requests.length === 1 ? "wants" : "want"} to connect
            </strong>
            <span className="callout__sub">Accept or decline in your account.</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </Link>
      )}

      <div className="quick">
        <Link to="/people" query={{ new: "1" }} className="quick__item">
          <Icon name="user-plus" size={20} />
          Add a person
        </Link>
        <Link to="/memories" query={{ new: "1" }} className="quick__item">
          <Icon name="bookmark" size={20} />
          Add a memory
        </Link>
        <Link to="/plans" query={{ new: "1" }} className="quick__item">
          <Icon name="calendar" size={20} />
          New plan
        </Link>
      </div>

      <div className={otherActions.length ? "grid-2" : "stack"}>
        {otherActions.length > 0 && (
          <Card title="More this week" icon="sparkle">
            <ul className="week">
              {otherActions.map((a) => (
                <WeekActionCard key={`${a.type}:${a.kind}:${a.id}`} action={a} onChanged={refresh} />
              ))}
            </ul>
          </Card>
        )}

        <div className="stack">
          <Card
            title="Open follow-ups"
            icon="flag"
            action={
              <Link to="/follow-ups" className="card__link">
                See all
              </Link>
            }
          >
            <Loaded state={followUps} skeleton={<Skeleton rows={3} />}>
              {(items) =>
                items.length === 0 ? (
                  <p className="muted">
                    Nothing open. Add one from a <Link to="/people">person's page</Link>.
                  </p>
                ) : (
                  <ul className="list">
                    {items.slice(0, 5).map((f) => (
                      <li key={f.follow_up_id} className="list__item">
                        <TickButton
                          label={`Mark done: ${f.text}`}
                          busy={busyId === f.follow_up_id}
                          onClick={async () => {
                            setBusyId(f.follow_up_id);
                            try {
                              await api.completeFollowUp(f.follow_up_id);
                              toast("Follow-up done.");
                              refresh();
                            } catch (e) {
                              toast(e instanceof Error ? e.message : "That didn't work.", "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        />
                        <div className="list__text">
                          <span>{f.text}</span>
                          <span className="muted small">
                            <FriendLink kind={f.kind} id={f.id} name={f.display_name} />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              }
            </Loaded>
          </Card>

          <Card
            title="Upcoming plans"
            icon="calendar"
            action={
              <Link to="/plans" className="card__link">
                See all
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <p className="muted">
                No plans yet. <Link to="/plans" query={{ new: "1" }}>Make one</Link>.
              </p>
            ) : (
              <ul className="list">
                {upcoming.slice(0, 4).map((p) => (
                  <li key={p.plan_id} className="list__item">
                    <span className="list__icon">
                      <Icon name="calendar" size={18} />
                    </span>
                    <div className="list__text">
                      <Link to="/plans" className="strong-link">
                        {p.title}
                      </Link>
                      <span className="muted small">
                        {p.planned_for ? formatDateTime(p.planned_for) : "No date yet"}
                        {p.members.length > 0 && ` · with ${joinNames(p.members.map((m) => firstName(m.display_name)))}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {openSetup.length > 0 && (
            <Card title="Getting set up" icon="sprout">
              <SetupSteps steps={home.setup} />
            </Card>
          )}
        </div>
      </div>
      {home.sample_loaded && <PreviewCleanup onRemoved={refresh} />}
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
      <div className="page">
        <Skeleton kind="page" rows={4} />
      </div>
    );
  }
  if (home.data.view === "welcome") {
    return (
      <>
        <Welcome name={home.data.display_name || displayName} steps={home.data.setup} onLoaded={home.reload} />
        {home.data.sample_loaded && (
          <div className="page page--narrow">
            <PreviewCleanup onRemoved={home.reload} />
          </div>
        )}
      </>
    );
  }
  return <Dashboard home={home.data} reloadHome={home.reload} />;
}
