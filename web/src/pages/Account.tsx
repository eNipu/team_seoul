// Account: your profile, Venn in ChatGPT, connecting with friends, signing out.

import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { useLocation } from "../router";
import { useSession } from "../session";
import { DELETE_ACCOUNT_PHRASE, LIMITS, formatDate, type Invite, type Me, type PendingRequest } from "../types";
import {
  Avatar,
  Card,
  CopyButton,
  CopyField,
  Dialog,
  Field,
  InlineError,
  Loaded,
  Notice,
  PageHeader,
  QrBlock,
  Skeleton,
  useAction,
  useAsync,
  useToast,
} from "../ui";

function ProfileCard({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const { setDisplayName } = useSession();
  const [name, setName] = useState(me.profile.display_name);
  const [bio, setBio] = useState(me.profile.bio ?? "");
  const act = useAction();
  const toast = useToast();
  const dirty = name.trim() !== me.profile.display_name || bio.trim() !== (me.profile.bio ?? "");
  return (
    <Card title="Your profile" icon="user">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void act.run(async () => {
            const profile = await api.updateMe({ display_name: name.trim(), bio: bio.trim() });
            setDisplayName(profile.display_name);
            toast("Profile saved.");
            onSaved();
          });
        }}
      >
        <Field label="Display name">
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.displayName} required />}
        </Field>
        <Field label="Bio" optional hint="Friends you connect with on Venn can see this.">
          {(p) => <textarea {...p} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bio} />}
        </Field>
        <InlineError message={act.error} />
        <div className="row">
          <button type="submit" className="btn btn--primary" disabled={act.busy || !dirty || !name.trim()}>
            {act.busy ? "Saving…" : "Save profile"}
          </button>
          {me.username && <span className="muted small">Signed in as @{me.username}</span>}
        </div>
      </form>
    </Card>
  );
}

function ChatGptCard({ me }: { me: Me }) {
  return (
    <Card title="Use Venn in ChatGPT" icon="sparkle" id="chatgpt" className="card--feature">
      <p>
        Venn is one service with two ways in. In ChatGPT you start with a question — “who do I know who likes photography?”
        — and Venn answers inside the chat. Here you start with a person or a plan.
      </p>
      <ol className="numbered">
        <li>In ChatGPT, add Venn as a connector (an MCP server) with this address.</li>
        <li>
          Sign in with the same account
          {me.username ? (
            <>
              {" "}
              (username: <strong className="mono">{me.username}</strong>)
            </>
          ) : null}{" "}
          when ChatGPT asks.
        </li>
        <li>Ask about your friends. Anything you approve there shows up here too.</li>
      </ol>
      {me.mcp_url ? (
        <CopyField label="Venn's MCP server URL" value={me.mcp_url} />
      ) : (
        <p className="muted">This server didn't report an MCP address.</p>
      )}
      <div className="carry">
        <div className="carry__col carry__col--yes">
          <h3>
            <Icon name="check-circle" size={18} />
            Carries over
          </h3>
          <p>Your saved Venn records: approved memories, people, plans and follow-ups. They belong to your Venn account.</p>
        </div>
        <div className="carry__col">
          <h3>
            <Icon name="ban" size={18} />
            Does not carry over
          </h3>
          <p>Your ChatGPT chats and ChatGPT's own memory. Venn never sees or syncs them.</p>
        </div>
      </div>
    </Card>
  );
}

function ConnectCard({ requests, onChanged }: { requests: PendingRequest[]; onChanged: () => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [code, setCode] = useState("");
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const create = useAction();
  const redeem = useAction();
  const respond = useAction();
  const toast = useToast();
  return (
    <Card title="Connect with friends" icon="users" id="connect">
      <p>
        Friends don't need to join for Venn to be useful. If a friend does use Venn, connecting lets each of you see what the
        other chose to share.
      </p>

      {requests.length > 0 && (
        <>
          <h3 className="subhead">Requests waiting for you</h3>
          <ul className="list">
            {requests.map((r) => (
              <li key={r.request_id} className="list__item">
                <Avatar name={r.sender_display_name} size="small" />
                <div className="list__text">
                  <strong>{r.sender_display_name}</strong>
                  <span className="muted small">Asked {formatDate(r.created_at)}</span>
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--small btn--primary"
                    disabled={respond.busy}
                    onClick={() =>
                      void respond.run(async () => {
                        await api.respondRequest(r.request_id, true);
                        toast(`You and ${r.sender_display_name} are connected.`);
                        onChanged();
                      })
                    }
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={respond.busy}
                    onClick={() =>
                      void respond.run(async () => {
                        await api.respondRequest(r.request_id, false);
                        toast("Request declined.");
                        onChanged();
                      })
                    }
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <InlineError message={respond.error} />
        </>
      )}

      <h3 className="subhead">Invite a friend</h3>
      {invite ? (
        <div className="invite">
          <div className="invite__main">
            <p className="invite__code">
              <span className="muted small">Invite code</span>
              <strong className="mono">{invite.code}</strong>
            </p>
            <CopyField label="Invite link" value={invite.link} copyLabel="Copy link" />
            <div className="row">
              <CopyButton text={invite.code} label="Copy code" />
              <CopyButton text={invite.share_text} label="Copy message" />
            </div>
            <p className="muted small">
              They become a connection only after you accept their request. Expires{" "}
              {formatDate(invite.expires_at)}.
            </p>
          </div>
          <QrBlock rows={invite.qr} label="QR code for the invite link" caption="Or let them scan this" />
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={create.busy}
          onClick={() => void create.run(async () => setInvite(await api.createInvite()))}
        >
          <Icon name="ticket" size={18} />
          {create.busy ? "Creating…" : "Create an invite"}
        </button>
      )}
      <InlineError message={create.error} />

      <h3 className="subhead">Have a code from a friend?</h3>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim();
          if (!c) return;
          setRedeemed(null);
          void redeem.run(async () => {
            const r = await api.redeemInvite(c);
            setRedeemed(r.message || `Request sent to ${r.inviter_display_name}.`);
            setCode("");
            onChanged();
          });
        }}
      >
        <input
          className="mono"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VENN-XXXX"
          aria-label="Invite code"
          maxLength={40}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={redeem.busy || !code.trim()}>
          {redeem.busy ? "Checking…" : "Use code"}
        </button>
      </form>
      <InlineError message={redeem.error} />
      {redeemed && (
        <p className="inline-ok" role="status">
          <Icon name="check-circle" size={16} />
          {redeemed}
        </p>
      )}
    </Card>
  );
}

function DangerCard() {
  const { signOut, signedOut } = useSession();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const out = useAction();
  const del = useAction();
  return (
    <Card title="Sign out or leave" icon="log-out">
      <div className="row row--between">
        <p>Sign out of Venn on this browser. Your account and everything saved stay as they are.</p>
        <button type="button" className="btn" disabled={out.busy} onClick={() => void out.run(signOut)}>
          <Icon name="log-out" size={18} />
          {out.busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <InlineError message={out.error} />
      <hr />
      <div className="row row--between">
        <p>Delete your Venn account and everything in it: memories, people, plans, follow-ups and connections.</p>
        <button type="button" className="btn btn--quiet-danger" onClick={() => setOpen(true)}>
          <Icon name="trash" size={18} />
          Delete account
        </button>
      </div>
      {open && (
        <Dialog title="Delete your Venn account?" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (phrase !== DELETE_ACCOUNT_PHRASE) return;
              void del.run(async () => {
                await api.deleteAccount(phrase);
                signedOut();
              });
            }}
          >
            <p className="dialog__text">
              This permanently deletes your account and everything saved in it, here and in ChatGPT. It can't be undone.
            </p>
            <Field label={`Type ${DELETE_ACCOUNT_PHRASE} to confirm`}>
              {(p) => (
                <input
                  {...p}
                  className="mono"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
              )}
            </Field>
            <InlineError message={del.error} />
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={() => setOpen(false)} disabled={del.busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn--danger" disabled={del.busy || phrase !== DELETE_ACCOUNT_PHRASE}>
                {del.busy ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </Card>
  );
}

export default function Account() {
  const me = useAsync(() => api.getMe(), []);
  const home = useAsync(() => api.getHome(), []);
  const loc = useLocation();
  const section = loc.query.get("section");
  const ready = me.data !== null;

  useEffect(() => {
    if (!ready || !section) return;
    document.getElementById(section)?.scrollIntoView({ block: "start" });
  }, [ready, section]);

  const requests = home.data?.view === "dashboard" ? home.data.pending_requests : [];
  return (
    <div className="page page--narrow">
      <PageHeader title="Account" lead="One Venn account, on this website and in ChatGPT." />
      <Loaded state={me} skeleton={<Skeleton rows={5} />}>
        {(m) => (
          <div className="stack">
            <ProfileCard key={`${m.profile.display_name}:${m.profile.bio ?? ""}`} me={m} onSaved={me.reload} />
            <ChatGptCard me={m} />
            <ConnectCard requests={requests} onChanged={home.reload} />
            <Notice icon="lock" tone="quiet">
              Private by default. Venn never sends messages, invitations or calendar events for you.
            </Notice>
            <DangerCard />
          </div>
        )}
      </Loaded>
    </div>
  );
}
