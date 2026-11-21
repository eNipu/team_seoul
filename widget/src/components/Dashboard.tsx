import { useId, useState, type FormEvent } from "react";
import {
  LIMITS,
  PROFILE_VISIBILITY_LABELS,
  hasId,
  humanize,
  parseProfile,
  plural,
  type Connection,
  type DashboardViewData,
  type Memory,
  type PendingRequest,
  type Person,
  type Profile,
} from "../types";
import { ActionError, Avatar, SectionTitle, useAction, type Action, type ViewProps } from "./common";
import type { HostBridge } from "../mcp/client";
import MemoriesTab from "./MemoriesTab";
import FriendsTab from "./FriendsTab";

export type DashboardTab = "profile" | "memories" | "friends";

interface Props extends ViewProps<DashboardViewData> {
  initialTab: DashboardTab | null;
  onTabChange: (tab: DashboardTab) => void;
}

export default function Dashboard({ data, bridge, nav, initialTab, onTabChange }: Props) {
  const id = useId();
  const action = useAction();
  const [tab, setTabState] = useState<DashboardTab>(initialTab ?? "profile");
  const [profile, setProfile] = useState<Profile>(data.profile);
  const [memories, setMemories] = useState<Memory[]>(data.memories);
  const [connections, setConnections] = useState<Connection[]>(data.connections);
  const [people, setPeople] = useState<Person[]>(data.people);
  const [pending, setPending] = useState<PendingRequest[]>(data.pending_requests);

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
  }

  // Every count shown in the UI is derived from the same arrays that are listed.
  const tabs: { id: DashboardTab; label: string; count?: number; dot?: boolean }[] = [
    { id: "profile", label: "Profile" },
    { id: "memories", label: "Memories", count: memories.length },
    { id: "friends", label: "Friends", count: friendCount, dot: pending.length > 0 },
  ];

  return (
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
            bridge={bridge}
            action={action}
            onProfile={setProfile}
          />
        )}
        {tab === "memories" && <MemoriesTab memories={memories} bridge={bridge} nav={nav} action={action} onChange={setMemories} />}
        {tab === "friends" && (
          <FriendsTab
            connections={connections}
            people={people}
            pending={pending}
            bridge={bridge}
            nav={nav}
            action={action}
            onConnections={setConnections}
            onPeople={setPeople}
            onPending={setPending}
            onDashboard={applyDashboard}
          />
        )}
      </div>
    </section>
  );
}

interface ProfileTabProps {
  profile: Profile;
  memoryCount: number;
  friendCount: number;
  bridge: HostBridge;
  action: Action;
  onProfile: (p: Profile) => void;
}

function ProfileTab({ profile, memoryCount, friendCount, bridge, action, onProfile }: ProfileTabProps) {
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
      const res = await bridge.callTool("heldly_update_profile", patch);
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
          <p className="muted small">
            {plural(memoryCount, "memory", "memories")} · {plural(friendCount, "friend", "friends")}
          </p>
          <div className="row row--wrap">
            <span className={`badge badge--pvis-${profile.profile_visibility.toLowerCase()}`}>
              {PROFILE_VISIBILITY_LABELS[profile.profile_visibility]}
            </span>
          </div>
        </div>
        {!editing && (
          <button type="button" className="btn btn--small profile-head__edit" disabled={action.busy !== null} onClick={startEdit}>
            Edit profile
          </button>
        )}
      </div>

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
        <p className="muted small">Tell Heldly what kind of connections you're looking for.</p>
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
        <p className="muted small">No interests yet. Tell Heldly what you enjoy and approve what it should remember.</p>
      )}
    </>
  );
}
