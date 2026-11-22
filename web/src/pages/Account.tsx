// Account: your profile, Venn in ChatGPT, connecting with friends, signing out.

import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link, useLocation } from "../router";
import { useSession } from "../session";
import { DELETE_ACCOUNT_PHRASE, LIMITS, formatDate, type Me, type PendingRequest } from "../types";
import {
  Avatar,
  Card,
  CopyField,
  Dialog,
  Field,
  InlineError,
  Loaded,
  PageHeader,
  Skeleton,
  useAction,
  useAsync,
  useToast,
} from "../ui";
import { DEFAULT_MCP_URL } from "./ConnectChatGpt";
import { OverlapLocationCard } from "./OverlapLocationCard";

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
        {(dirty || act.busy) && (
          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={act.busy || !name.trim()}>
              {act.busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}

function ChatGptCard({ me }: { me: Me }) {
  // The guided 1-click workflow lives at /connect; this card is the one quiet way back to it.
  return (
    <Card title="Venn in ChatGPT" icon="sparkle" id="chatgpt">
      <p className="muted">Add Venn once. Then ChatGPT tells you when someone in your circle matters.</p>
      <div className="row">
        <Link to="/connect" className="btn">Connect to ChatGPT</Link>
      </div>
      <details className="quiet-details">
        <summary>Set it up by hand</summary>
        <ol className="numbered">
          <li>In ChatGPT, add Venn as a connector with this address.</li>
          <li>
            Sign in with the same account{me.username ? <> (<strong className="mono">{me.username}</strong>)</> : null}.
          </li>
        </ol>
        <CopyField label="Venn's address" value={me.mcp_url || DEFAULT_MCP_URL} />
      </details>
    </Card>
  );
}

function ConnectCard({ requests, onChanged }: { requests: PendingRequest[]; onChanged: () => void }) {
  const [code, setCode] = useState("");
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const redeem = useAction();
  const respond = useAction();
  const toast = useToast();
  return (
    <Card title="Invite a friend" icon="users" id="connect">

      {requests.length > 0 && (
        <>
          <h3 className="subhead">Waiting for you</h3>
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

      <div className="row">
        <Link to="/invite" className="btn btn--primary" id="create-friend-invite">
          Show my QR code
        </Link>
      </div>

      <details className="more more--quiet">
      <summary>Have a code from a friend?</summary>
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
      </details>
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
    <div className="account-foot">
      <button type="button" className="btn" disabled={out.busy} onClick={() => void out.run(signOut)}>
        {out.busy ? "Signing out…" : "Sign out"}
      </button>
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        Delete account
      </button>
      <InlineError message={out.error} />
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
    </div>
  );
}

export default function Account() {
  const me = useAsync(() => api.getMe(), []);
  const home = useAsync(() => api.getHome(), []);
  const loc = useLocation();
  const section = loc.query.get("section");
  const fromSetup = loc.query.get("from") === "setup";
  const ready = me.data !== null;

  useEffect(() => {
    if (!ready || !section) return;
    const target = document.getElementById(section);
    target?.scrollIntoView({ block: "start" });
    if (fromSetup && section === "connect") document.getElementById("create-friend-invite")?.focus();
  }, [ready, section, fromSetup]);

  const requests = home.data?.view === "dashboard" ? home.data.pending_requests : [];
  return (
    <div className="page page--narrow">
      <PageHeader title="Account" />
      <Loaded state={me} skeleton={<Skeleton rows={5} />}>
        {(m) => (
          <div className="stack">
            <ProfileCard key={`${m.profile.display_name}:${m.profile.bio ?? ""}`} me={m} onSaved={me.reload} />
            <ConnectCard requests={requests} onChanged={home.reload} />
            <ChatGptCard me={m} />
            <OverlapLocationCard />
            {fromSetup && <Link to="/" className="link-btn">Back to Home</Link>}
            <DangerCard />
          </div>
        )}
      </Loaded>
    </div>
  );
}
