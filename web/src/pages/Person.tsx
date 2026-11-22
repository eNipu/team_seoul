// One friend: what they shared and what you have in common. Read and edit, no actions.

import { useState } from "react";
import { api } from "../api";
import { CategoryIcon } from "../icons";
import { navigate } from "../router";
import { firstName, type FriendKind } from "../types";
import {
  Avatar,
  Card,
  Chips,
  ConfirmDialog,
  Dialog,
  ErrorState,
  Loaded,
  Notice,
  PageHeader,
  Skeleton,
  Tag,
  useAsync,
  useToast,
} from "../ui";
import VennDiagram from "../VennDiagram";
import { PersonForm } from "./shared";

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
            <details className="more">
            <summary>See every interest</summary>
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
            </details>
          </>
        )}
      </Loaded>
    </Card>
  );
}







export default function PersonPage({ kind, id }: Props) {
  const friend = useAsync(() => api.getFriend(kind, id), [kind, id]);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const back = { to: "/people", label: "Circle" };

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
            {f.is_sample && <Tag tone="info">Preview</Tag>}
          </p>
          <p className="muted small">{f.on_venn ? `Shares with you on Venn` : `Only you see this`}</p>
        </div>
        <div className="profile__actions">
          {kind === "person" && (
            <>
            <button type="button" className="link-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="link-btn" onClick={() => setDeleting(true)}>
              Delete
            </button>
            </>
          )}
        </div>
      </section>

      {kind === "connection" && (
            <Card title={`${first} shared`} icon="users" className="signals">
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
          {f.bio && <p className="muted">{f.bio}</p>}
        </Card>
      )}

      {kind === "person" && (
        <Card title="Your notes" icon="note">
          {f.notes ? <p className="notes">{f.notes}</p> : <p className="muted">No notes yet.</p>}
          {f.interests.length > 0 && <Chips items={f.interests} />}
        </Card>
      )}

      <VennSection kind={kind} id={id} name={f.display_name} version={version} />

      {editing && (
        <Dialog title={`Edit ${f.display_name}`} onClose={() => setEditing(false)}>
          {f.is_sample && <Notice tone="quiet">Clearing preview data also removes edits you make to this note.</Notice>}
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
