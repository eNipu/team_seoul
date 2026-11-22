import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  LIMITS,
  PROFILE_VISIBILITY_LABELS,
  hasId,
  humanize,
  parseProfile,
  parseView,
  plural,
  type Plan,
  type Connection,
  type DashboardViewData,
  type Memory,
  type PendingRequest,
  type Person,
  type Profile,
} from "../types";
import { ActionError, Avatar, SectionTitle, useAction, type Action, type Nav, type ViewProps } from "./common";
import type { HostBridge } from "../mcp/client";
import MemoriesTab from "./MemoriesTab";
import FriendsTab from "./FriendsTab";
import { PreviewCleanup } from "./DashboardHome";
import { QuietHome } from "./Moment";
import { Icon, type IconName } from "./icons";

export type DashboardTab = "profile" | "memories" | "friends";

interface Props extends ViewProps<DashboardViewData> {
  initialTab: DashboardTab | null;
  onTabChange: (tab: DashboardTab) => void;
}

export default function Dashboard({ data, bridge, nav, initialTab, onTabChange }: Props) {
  const id = useId();
  const action = useAction();
  const [tab, setTabState] = useState<DashboardTab>(initialTab ?? "profile");
  const showAll = initialTab !== null;
  const [profile, setProfile] = useState<Profile>(data.profile);
  const [memories, setMemories] = useState<Memory[]>(data.memories);
  const [connections, setConnections] = useState<Connection[]>(data.connections);
  const [people, setPeople] = useState<Person[]>(data.people);
  const [pending, setPending] = useState<PendingRequest[]>(data.pending_requests);
  const [, setSetupData] = useState(data);
  const [, setPlans] = useState<Plan[]>(data.plans);
  const [, setPendingAnswers] = useState(data.pending_answers);
  const [sampleLoaded, setSampleLoaded] = useState(data.sample_loaded);

  const friendCount = connections.length + people.length;

  function setTab(t: DashboardTab) {
    setTabState(t);
    onTabChange(t);
  }

  /** Replace everything with a freshly fetched dashboard. */
  function applyDashboard(d: DashboardViewData) {
    setProfile(d.profile);
    setMemories(d.memories);
    setConnections(d.connections);
    setPeople(d.people);
    setPending(d.pending_requests);
    setSetupData(d);
    setPlans(d.plans);
    setPendingAnswers(d.pending_answers);
    setSampleLoaded(d.sample_loaded);
  }

  /** Re-fetch the dashboard after something changed many parts of it at once. */
  async function reload(): Promise<string | null> {
    const res = await bridge.callTool("venn_show_dashboard", {});
    if (!res.ok) return res.errorText;
    const parsed = parseView(res.data);
    if (parsed?.view === "welcome") return nav.replaceView("venn_show_dashboard", {});
    if (!parsed || parsed.view !== "dashboard") return "Venn couldn't refresh the dashboard.";
    applyDashboard(parsed);
    return null;
  }

  // Every count shown in the UI is derived from the same arrays that are listed.
  const tabs: { id: DashboardTab; label: string; count?: number; dot?: boolean }[] = [
    { id: "profile", label: "Profile" },
    { id: "memories", label: "Memories", count: memories.length },
    { id: "friends", label: "Friends", count: friendCount, dot: pending.length > 0 },
  ];

  return (
    <>
    <QuietHome bridge={bridge} nav={nav} />
    {/* Lists (friends, memories, plans, setup) only when the chat asked for them. */}
    {showAll && (
    <div className="home-more">
        <div className="home-more__body">
          {sampleLoaded && <PreviewCleanup bridge={bridge} onChanged={() => nav.replaceView("venn_show_dashboard", {})} />}
    <section className="panel panel--tabs">
      <div className="tabs" role="tablist" aria-label="Dashboard sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${id}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${id}-panel`}
            className={`tab ${tab === t.id ? "tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && <span className="tab__count">{t.count}</span>}
            {t.dot && (
              <span className="tab__dot" role="img" aria-label={plural(pending.length, "pending request", "pending requests")} />
            )}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        <ActionError action={action} />
        {tab === "profile" && (
          <ProfileTab
            profile={profile}
            memoryCount={memories.length}
            friendCount={friendCount}
            pendingCount={pending.length}
            onOpenTab={setTab}
            bridge={bridge}
            nav={nav}
            action={action}
            onProfile={setProfile}
          />
        )}
        {tab === "memories" && <MemoriesTab memories={memories} bridge={bridge} nav={nav} action={action} onChange={(next) => { setMemories(next); if (next.length < memories.length) void reload(); }} />}
        {tab === "friends" && (
          <FriendsTab
            connections={connections}
            people={people}
            pending={pending}
            bridge={bridge}
            nav={nav}
            action={action}
            onConnections={setConnections}
            onPeople={(next) => { setPeople(next); if (next.length < people.length) void reload(); }}
            onPending={setPending}
            onDashboard={applyDashboard}
            sampleLoaded={sampleLoaded}
          />
        )}
      </div>
    </section>
        </div>
    </div>
    )}
    </>
  );
}

interface ProfileTabProps {
  profile: Profile;
  memoryCount: number;
  friendCount: number;
  pendingCount: number;
  onOpenTab: (tab: DashboardTab) => void;
  bridge: HostBridge;
  nav: Nav;
  action: Action;
  onProfile: (p: Profile) => void;
}

function ProfileTab({ profile, memoryCount, friendCount, pendingCount, onOpenTab, bridge, nav, action, onProfile }: ProfileTabProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const saving = action.busy === "profile";

  function startEdit() {
    setName(profile.display_name);
    setBio(profile.bio ?? "");
    setEditing(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    const nextBio = bio.trim();
    if (!nextName) return;
    const patch: Record<string, unknown> = {};
    if (nextName !== profile.display_name) patch.display_name = nextName;
    if (nextBio !== (profile.bio ?? "")) patch.bio = nextBio;
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    void action.run("profile", async () => {
      const res = await bridge.callTool("venn_update_profile", patch);
      if (!res.ok) return res.errorText;
      onProfile(
        hasId(res.data, "display_name")
          ? parseProfile(res.data)
          : { ...profile, display_name: nextName, bio: nextBio || null },
      );
      setEditing(false);
      return null;
    });
  }

  return (
    <>
      <div className="profile-head">
        <Avatar name={profile.display_name} size="large" />
        <div className="profile-head__body">
          <h2>{profile.display_name}</h2>
          <div className="row row--wrap">
            <span className={`badge badge--pvis-${profile.profile_visibility.toLowerCase()}`}>
              {PROFILE_VISIBILITY_LABELS[profile.profile_visibility]}
            </span>
          </div>
        </div>
        {!editing && (
          <button type="button" className="btn btn--small profile-head__edit" disabled={action.busy !== null} onClick={startEdit}>
            <Icon name="pencil" size={16} />
            Edit profile
          </button>
        )}
      </div>

      {/* Counts come from the same arrays the tabs list; each tile opens its tab. */}
      <ul className="stats" aria-label="At a glance">
        {(
          [
            { icon: "bookmark", value: memoryCount, label: memoryCount === 1 ? "Memory" : "Memories", tab: "memories" },
            { icon: "users", value: friendCount, label: friendCount === 1 ? "Friend" : "Friends", tab: "friends" },
            { icon: "user-plus", value: pendingCount, label: pendingCount === 1 ? "Request" : "Requests", tab: "friends" },
          ] satisfies { icon: IconName; value: number; label: string; tab: DashboardTab }[]
        ).map((s) => (
          <li key={s.label}>
            <button type="button" className="stat" onClick={() => onOpenTab(s.tab)}>
              <span className="stat__icon">
                <Icon name={s.icon} size={18} />
              </span>
              <span className="stat__value">{s.value}</span>
              <span className="stat__label">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <form className="inline-form form" onSubmit={save}>
          <label className="field" htmlFor={`${id}-name`}>
            <span className="field__label">Display name</span>
            <input
              id={`${id}-name`}
              type="text"
              value={name}
              maxLength={LIMITS.displayName}
              required
              autoComplete="off"
              disabled={saving}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${id}-bio`}>
            <span className="field__label">
              Bio <span className="field__count">{bio.length}/{LIMITS.bio}</span>
            </span>
            <textarea
              id={`${id}-bio`}
              rows={3}
              value={bio}
              maxLength={LIMITS.bio}
              placeholder="A line or two about you."
              disabled={saving}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <div className="actions actions--compact">
            <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving || name.trim() === ""}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : profile.bio ? (
        <p>{profile.bio}</p>
      ) : (
        <p className="muted small">No bio yet. Use “Edit profile” to add a line about yourself.</p>
      )}

      <SectionTitle>What you're here for</SectionTitle>
      {profile.social_goals.length > 0 ? (
        <div className="chips">
          {profile.social_goals.map((g, i) => (
            <span key={`${g}-${i}`} className="chip chip--goal">
              {humanize(g)}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted small">Tell Venn what kind of connections you're looking for.</p>
      )}

      <SectionTitle>Interests</SectionTitle>
      {profile.interests.length > 0 ? (
        <div className="chips">
          {profile.interests.map((it, i) => (
            <span key={`${it}-${i}`} className="chip">
              {it}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted small">No interests yet.</p>
      )}
      <AddInterest nav={nav} />
    </>
  );
}

function AddInterest({ nav }: { nav: Nav }) {
  const id = useId();
  const action = useAction();
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [interest, setInterest] = useState("");
  const busy = action.busy !== null;
  const title = interest.trim();

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  function close() {
    action.clear();
    setInterest("");
    setOpen(false);
    toggle.current?.focus();
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!title) return;
    void action.run("review-interest", () => nav.openView("venn_propose_memories", {
      suggested: [{ category: "INTEREST", title, description: `I'm interested in ${title}.` }],
    }));
  }

  return (
    <>
      <div className="row">
        <button type="button" className="btn" ref={toggle} aria-expanded={open} aria-controls={id}
          disabled={busy} onClick={() => open ? close() : setOpen(true)}>
          Add interest
        </button>
      </div>
      <div id={id} hidden={!open}>
        {open && (
          <form className="inline-form form" onSubmit={review}>
            <label className="field">
              <span className="field__label">Interest</span>
              <input ref={input} type="text" value={interest} maxLength={LIMITS.memoryTitle} placeholder="e.g. Film photography"
                required disabled={busy} autoComplete="off" onChange={(event) => { setInterest(event.target.value); action.clear(); }} />
            </label>
            <ActionError action={action} />
            <div className="actions actions--compact">
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={close}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={busy || !title}>
                {busy ? "Opening…" : "Review interest"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
