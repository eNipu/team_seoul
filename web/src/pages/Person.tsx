// One friend: what you know, what you share, what to do next.

import { useState } from "react";
import { api } from "../api";
import { CategoryIcon, Icon } from "../icons";
import { navigate } from "../router";
import {
  LIMITS,
  firstName,
  formatDate,
  formatLastSeen,
  type ActivitySuggestion,
  type AskLink,
  type Friend,
  type FriendKind,
} from "../types";
import {
  Avatar,
  CalendarLink,
  Card,
  Chips,
  ConfirmDialog,
  Dialog,
  ErrorState,
  InlineError,
  KindTag,
  Loaded,
  Notice,
  PageHeader,
  Skeleton,
  useAction,
  useAsync,
  useToast,
} from "../ui";
import VennDiagram from "../VennDiagram";
import { AskLinkPanel, PersonForm, TickButton } from "./shared";

interface Props {
  kind: FriendKind;
  id: string;
}

function VennSection({ kind, id, name, version }: Props & { name: string; version: number }) {
  const venn = useAsync(() => api.getVenn(kind, id), [kind, id, version]);
  const first = firstName(name);
  return (
    <Card title={`You and ${first}`} icon="heart" className="card--feature">
      <Loaded state={venn} skeleton={<Skeleton rows={3} />}>
        {(v) => (
          <>
            <p className="venn-summary">{v.summary}</p>
            <VennDiagram you={v.you_only} shared={v.shared} them={v.them_only} themName={first} />
            <div className="venn-lists">
              <div>
                <h3 className="subhead">Only you</h3>
                {v.you_only.length ? <Chips items={v.you_only} /> : <p className="muted small">Nothing on record yet.</p>}
              </div>
              <div>
                <h3 className="subhead">Both of you</h3>
                {v.shared.length ? (
                  <Chips items={v.shared} tone="shared" />
                ) : (
                  <p className="muted small">Nothing in common on record yet.</p>
                )}
              </div>
              <div>
                <h3 className="subhead">Only {first}</h3>
                {v.them_only.length ? <Chips items={v.them_only} /> : <p className="muted small">Nothing on record yet.</p>}
              </div>
            </div>
          </>
        )}
      </Loaded>
    </Card>
  );
}

function IdeaItem({ idea, kind, id, name }: Props & { idea: ActivitySuggestion; name: string }) {
  const act = useAction();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  return (
    <li className="idea">
      <div className="idea__text">
        <h3>{idea.title}</h3>
        <p>{idea.description}</p>
        {idea.grounded_in.length > 0 && (
          <p className="reason">
            <Icon name="link" size={14} />
            Based on {idea.grounded_in.join(", ")}
          </p>
        )}
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={act.busy || saved}
          onClick={() =>
            void act.run(async () => {
              await api.createPlan({
                title: idea.title.slice(0, LIMITS.planTitle),
                details: idea.description.slice(0, LIMITS.planDetails) || undefined,
                ...(kind === "connection" ? { connection_ids: [id] } : { person_ids: [id] }),
              });
              setSaved(true);
              toast(`Plan saved with ${firstName(name)}.`);
            })
          }
        >
          <Icon name={saved ? "check" : "bookmark"} size={16} />
          {saved ? "Plan saved" : "Save plan"}
        </button>
        <CalendarLink title={`${idea.title} with ${firstName(name)}`} details={idea.description} />
      </div>
      <InlineError message={act.error} />
    </li>
  );
}

function IdeasSection({ kind, id, name, version }: Props & { name: string; version: number }) {
  const ideas = useAsync(() => api.getIdeas(kind, id), [kind, id, version]);
  return (
    <Card title="Ideas for next time" icon="bulb">
      <Loaded state={ideas} skeleton={<Skeleton rows={2} />}>
        {(d) =>
          d.suggestions.length === 0 ? (
            <p className="muted">Add an interest or two and Venn will suggest things to do together.</p>
          ) : (
            <>
              <ul className="ideas">
                {d.suggestions.map((s) => (
                  <IdeaItem key={s.title} idea={s} kind={kind} id={id} name={name} />
                ))}
              </ul>
              <p className="fine">Saving a plan keeps it in Venn. The calendar link opens Google Calendar in a new tab.</p>
            </>
          )
        }
      </Loaded>
    </Card>
  );
}

function BriefSection({ kind, id, name, version }: Props & { name: string; version: number }) {
  const brief = useAsync(() => api.getBrief(kind, id), [kind, id, version]);
  return (
    <Card title="Prep for a meetup" icon="chat">
      <Loaded state={brief} skeleton={<Skeleton rows={2} />}>
        {(b) => (
          <div className="brief">
            <div>
              <h3 className="subhead">Things to ask</h3>
              {b.things_to_ask.length === 0 ? (
                <p className="muted small">No open follow-ups with {firstName(name)}.</p>
              ) : (
                <ul className="bullets">
                  {b.things_to_ask.map((t) => (
                    <li key={t.follow_up_id}>{t.text}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="subhead">Conversation starters</h3>
              {b.conversation_starters.length === 0 ? (
                <p className="muted small">Add interests or notes to get starters.</p>
              ) : (
                <ul className="bullets">
                  {b.conversation_starters.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
            {b.last_activity && (
              <p className="muted small brief__last">
                Last time: {b.last_activity}
                {b.days_since_last_interaction !== null && ` (${b.days_since_last_interaction} days ago)`}
              </p>
            )}
          </div>
        )}
      </Loaded>
    </Card>
  );
}

function FollowUpsSection({ friend, onChanged }: { friend: Friend; onChanged: () => void }) {
  const [text, setText] = useState("");
  const act = useAction();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <Card title="Follow-ups" icon="flag">
      {friend.follow_ups.length === 0 ? (
        <p className="muted">Nothing open. Note something to ask {firstName(friend.display_name)} next time.</p>
      ) : (
        <ul className="list">
          {friend.follow_ups.map((f) => (
            <li key={f.follow_up_id} className="list__item">
              <TickButton
                label={`Mark done: ${f.text}`}
                busy={busyId === f.follow_up_id}
                onClick={async () => {
                  setBusyId(f.follow_up_id);
                  try {
                    await api.completeFollowUp(f.follow_up_id);
                    toast("Follow-up done.");
                    onChanged();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "That didn't work.", "error");
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
              <div className="list__text">
                <span>{f.text}</span>
                <span className="muted small">Added {formatDate(f.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          void act.run(async () => {
            await api.addFollowUp(friend.kind, friend.id, t);
            setText("");
            toast("Follow-up added.");
            onChanged();
          });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.followUp}
          placeholder="Something to ask or do next time"
          aria-label={`Add a follow-up for ${friend.display_name}`}
        />
        <button type="submit" className="btn" disabled={act.busy || !text.trim()}>
          Add
        </button>
      </form>
      <InlineError message={act.error} />
    </Card>
  );
}

function HangoutsSection({ friend, onChanged }: { friend: Friend; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const act = useAction();
  const toast = useToast();
  return (
    <Card
      title="Recent hangouts"
      icon="clock"
      action={
        !open && (
          <button type="button" className="btn btn--small" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} />
            Log a hangout
          </button>
        )
      }
    >
      {open && (
        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault();
            void act.run(async () => {
              await api.logInteraction(friend.kind, friend.id, activity.trim() || undefined);
              setActivity("");
              setOpen(false);
              toast(`Logged a hangout with ${firstName(friend.display_name)}.`);
              onChanged();
            });
          }}
        >
          <input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            maxLength={LIMITS.activity}
            placeholder="What did you do? (optional)"
            aria-label="What did you do? Optional"
            autoFocus
          />
          <button type="submit" className="btn btn--primary" disabled={act.busy}>
            {act.busy ? "Logging…" : "Log for today"}
          </button>
          <button type="button" className="btn" onClick={() => setOpen(false)} disabled={act.busy}>
            Cancel
          </button>
        </form>
      )}
      <InlineError message={act.error} />
      {friend.recent_interactions.length === 0 ? (
        <p className="muted">No hangouts logged yet.</p>
      ) : (
        <ul className="list">
          {friend.recent_interactions.map((i, n) => (
            <li key={`${i.occurred_at}:${n}`} className="list__item">
              <span className="list__icon">
                <Icon name="check-circle" size={18} />
              </span>
              <div className="list__text">
                <span>{i.activity ?? "Spent time together"}</span>
                <span className="muted small">{formatDate(i.occurred_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AskSection({ friend }: { friend: Friend }) {
  const [link, setLink] = useState<AskLink | null>(null);
  const act = useAction();
  const first = firstName(friend.display_name);
  return (
    <Card title={`Ask ${first} a few questions`} icon="help">
      {link ? (
        <AskLinkPanel link={link} />
      ) : (
        <>
          <p>
            Send {first} a link with four short questions — what they're into, what they'd like to do together. They don't
            need an account.
          </p>
          <Notice icon="shield" tone="quiet">
            Nothing is saved until you approve it. Answers wait for your review.
          </Notice>
          <InlineError message={act.error} />
          <button
            type="button"
            className="btn"
            disabled={act.busy}
            onClick={() => void act.run(async () => setLink(await api.createQuestionLink({ person_id: friend.id })))}
          >
            <Icon name="link" size={18} />
            {act.busy ? "Creating…" : "Create a question link"}
          </button>
        </>
      )}
    </Card>
  );
}

export default function PersonPage({ kind, id }: Props) {
  const friend = useAsync(() => api.getFriend(kind, id), [kind, id]);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const back = { to: "/people", label: "People" };

  if (friend.data === null) {
    return (
      <div className="page">
        {friend.error ? (
          <>
            <PageHeader title="Person" back={back} />
            <ErrorState message={friend.error} onRetry={friend.reload} />
          </>
        ) : (
          <Skeleton kind="page" rows={4} />
        )}
      </div>
    );
  }

  const f = friend.data;
  const first = firstName(f.display_name);
  const changed = () => {
    friend.reload();
    setVersion((v) => v + 1);
  };

  return (
    <div className="page">
      <PageHeader title={f.display_name} back={back} />
      <section className="profile card">
        <Avatar name={f.display_name} size="xl" />
        <div className="profile__main">
          <p className="profile__meta">
            {f.relationship && <span>{f.relationship}</span>}
            <KindTag onVenn={f.on_venn} />
          </p>
          <p className="muted">
            <Icon name="clock" size={16} /> {formatLastSeen(f.last_interaction_at)}
          </p>
          <p className="muted small">
            {f.on_venn
              ? `${first} has a Venn account. You see only what ${first} chose to share with you.`
              : `A private note of yours. ${first} doesn't need a Venn account and can't see this.`}
          </p>
        </div>
        {kind === "person" && (
          <div className="profile__actions">
            <button type="button" className="btn btn--small" onClick={() => setEditing(true)}>
              <Icon name="pencil" size={16} />
              Edit
            </button>
            <button type="button" className="btn btn--small btn--quiet-danger" onClick={() => setDeleting(true)}>
              <Icon name="trash" size={16} />
              Delete
            </button>
          </div>
        )}
      </section>

      <VennSection kind={kind} id={id} name={f.display_name} version={version} />

      <div className="grid-2 grid-2--even">
        <div className="stack">
          {kind === "person" ? (
            <Card title="Your notes" icon="note">
              {f.notes ? <p className="notes">{f.notes}</p> : <p className="muted">No notes yet.</p>}
              <h3 className="subhead">Interests</h3>
              {f.interests.length ? <Chips items={f.interests} /> : <p className="muted small">None added yet.</p>}
              <p className="fine">
                <Icon name="lock" size={14} />
                Only you can see this.
              </p>
            </Card>
          ) : (
            <Card title={`What ${first} shares with you`} icon="users">
              {f.bio && <p className="notes">{f.bio}</p>}
              {f.interests.length > 0 && (
                <>
                  <h3 className="subhead">Interests</h3>
                  <Chips items={f.interests} />
                </>
              )}
              {f.shared_memories.length === 0 ? (
                !f.bio && f.interests.length === 0 && <p className="muted">{first} hasn't shared anything with you yet.</p>
              ) : (
                <ul className="shared-memories">
                  {f.shared_memories.map((m) => (
                    <li key={`${m.category}:${m.title}`}>
                      <CategoryIcon category={m.category} small />
                      <div>
                        <strong>{m.title}</strong>
                        <p>{m.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="fine">
                <Icon name="shield" size={14} />
                This is what {first} chose to share with connections. You can't edit it, and {first} sees only what you share.
              </p>
            </Card>
          )}
          <FollowUpsSection friend={f} onChanged={changed} />
          <HangoutsSection friend={f} onChanged={changed} />
        </div>
        <div className="stack">
          <IdeasSection kind={kind} id={id} name={f.display_name} version={version} />
          <BriefSection kind={kind} id={id} name={f.display_name} version={version} />
          {kind === "person" && <AskSection friend={f} />}
        </div>
      </div>

      {editing && (
        <Dialog title={`Edit ${f.display_name}`} onClose={() => setEditing(false)}>
          <PersonForm
            person={{ person_id: id, name: f.display_name, relationship: f.relationship, notes: f.notes, interests: f.interests }}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              toast("Changes saved.");
              changed();
            }}
          />
        </Dialog>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${f.display_name}?`}
          body={
            <p>
              This deletes your notes about {first}, their follow-ups and logged hangouts. It can't be undone. Memories that
              mention {first} stay.
            </p>
          }
          confirmLabel="Delete person"
          danger
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await api.deletePerson(id);
            toast(`${f.display_name} deleted.`);
            navigate("/people");
          }}
        />
      )}
    </div>
  );
}
