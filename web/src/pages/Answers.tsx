// Answers from friends without an account: nothing is saved until you approve it.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link } from "../router";
import { LIMITS, formatDate, friendPath, plural, type AnswerResponse, type AskLink, type QuestionLink } from "../types";
import {
  Avatar,
  Card,
  ConfirmDialog,
  CopyButton,
  Dialog,
  EmptyState,
  Field,
  InlineError,
  Loaded,
  Notice,
  PageHeader,
  Skeleton,
  Tag,
  useAction,
  useAsync,
  useToast,
} from "../ui";
import { AskLinkPanel } from "./shared";

function ResponseCard({ response, onChanged }: { response: AnswerResponse; onChanged: () => void }) {
  const [keys, setKeys] = useState<string[]>(response.items.map((i) => i.key));
  const [name, setName] = useState(response.name);
  const [discarding, setDiscarding] = useState(false);
  const act = useAction();
  const toast = useToast();
  const isNew = response.person_id === null;
  return (
    <section className="card response">
      <header className="response__head">
        <Avatar name={name || response.name} />
        <div>
          <h2>{response.name}</h2>
          <p className="muted small">Answered {formatDate(response.received_at)}</p>
        </div>
        {isNew ? <Tag icon="user-plus">New person</Tag> : <Tag icon="note">In your people</Tag>}
      </header>
      {isNew ? (
        <Field label="Save as" hint="Saving adds this person to your people under this name.">
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.answerName} />}
        </Field>
      ) : (
        <p className="muted">
          Saves to{" "}
          <Link to={friendPath("person", response.person_id ?? "")}>{response.person_name ?? response.name}</Link>.
        </p>
      )}
      <fieldset className="answers">
        <legend>Choose what to keep</legend>
        {response.items.map((item) => {
          const on = keys.includes(item.key);
          return (
            <label key={item.key} className={`answer ${on ? "answer--on" : ""}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setKeys(on ? keys.filter((k) => k !== item.key) : [...keys, item.key])}
              />
              <span className="answer__body">
                <span className="answer__q">{item.question}</span>
                <span className="answer__a">{item.answer}</span>
                <span className="answer__saves">
                  <Icon name="arrow-right" size={14} />
                  {item.saves_as}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <InlineError message={act.error} />
      <div className="row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={act.busy || keys.length === 0 || (isNew && !name.trim())}
          onClick={() =>
            void act.run(async () => {
              const order = response.items.map((i) => i.key).filter((k) => keys.includes(k));
              const r = await api.saveAnswers(response.response_id, order, isNew ? name.trim() : undefined);
              toast(`Saved ${plural(order.length, "answer", "answers")} to ${r.person.name}.`);
              onChanged();
            })
          }
        >
          {act.busy ? "Saving…" : `Save selected (${keys.length})`}
        </button>
        <button type="button" className="btn btn--quiet-danger" disabled={act.busy} onClick={() => setDiscarding(true)}>
          Discard
        </button>
      </div>
      {discarding && (
        <ConfirmDialog
          title={`Discard ${response.name}'s answers?`}
          body={<p>Nothing from this reply will be saved. This can't be undone.</p>}
          confirmLabel="Discard answers"
          danger
          onClose={() => setDiscarding(false)}
          onConfirm={async () => {
            await api.discardAnswers(response.response_id);
            toast("Answers discarded.");
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function CreateLink({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [link, setLink] = useState<AskLink | null>(null);
  const act = useAction();
  return (
    <Dialog title={link ? "Your question link" : "Create a question link"} onClose={onClose} wide={link !== null}>
      {link ? (
        <>
          <AskLinkPanel link={link} />
          <div className="dialog__actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act.run(async () => {
              setLink(await api.createQuestionLink(name.trim() ? { name: name.trim() } : {}));
              onCreated();
            });
          }}
        >
          <p className="dialog__text">
            A link with four short questions. Whoever opens it can answer without an account; their answers wait here for
            your review.
          </p>
          <Field label="Who is it for?" optional hint="Leave empty for a link anyone can answer.">
            {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.answerName} autoFocus />}
          </Field>
          <InlineError message={act.error} />
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={onClose} disabled={act.busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={act.busy}>
              {act.busy ? "Creating…" : "Create link"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function LinkRow({ link, onRevoke }: { link: QuestionLink; onRevoke: () => void }) {
  return (
    <li className="list__item link-row">
      <span className="list__icon">
        <Icon name="link" size={18} />
      </span>
      <div className="list__text">
        <span>
          <strong>{link.for_name ? `For ${link.for_name}` : "Open link"}</strong>{" "}
          {!link.active && <Tag>Closed</Tag>}
        </span>
        <span className="mono small link-row__url">{link.link}</span>
        <span className="muted small">
          {plural(link.responses, "reply", "replies")} · expires {formatDate(link.expires_at)}
        </span>
      </div>
      {link.active && (
        <div className="row">
          <CopyButton text={link.link} />
          <button type="button" className="btn btn--small btn--quiet-danger" onClick={onRevoke}>
            Revoke
          </button>
        </div>
      )}
    </li>
  );
}

export default function Answers() {
  const answers = useAsync(() => api.getAnswers(), []);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<QuestionLink | null>(null);
  const toast = useToast();
  const create = (
    <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
      <Icon name="link" size={18} />
      Create a link
    </button>
  );
  return (
    <div className="page">
      <PageHeader
        title="Answers"
        lead="Friends can answer a few questions without joining Venn. You decide what gets saved."
        actions={create}
      />
      <Loaded state={answers} skeleton={<Skeleton rows={4} />}>
        {(a) => (
          <>
            <Notice icon="shield">Nothing is saved until you approve it.</Notice>
            <section className="results-section">
              <h2>
                Waiting for review <span className="count-badge">{a.responses.length}</span>
              </h2>
              {a.responses.length === 0 ? (
                <EmptyState illustration="chat" title="No answers waiting">
                  <p>Create a link and send it to a friend. Their answers will show up here for you to approve.</p>
                </EmptyState>
              ) : (
                <div className="stack">
                  {a.responses.map((r) => (
                    <ResponseCard key={r.response_id} response={r} onChanged={answers.reload} />
                  ))}
                </div>
              )}
            </section>
            <section className="results-section">
              <h2>
                Your links <span className="count-badge">{a.links.length}</span>
              </h2>
              {a.links.length === 0 ? (
                <p className="muted">No links yet.</p>
              ) : (
                <Card className="card--flush">
                  <ul className="list list--padded">
                    {a.links.map((l) => (
                      <LinkRow key={l.link_id} link={l} onRevoke={() => setRevoking(l)} />
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          </>
        )}
      </Loaded>
      {creating && <CreateLink onClose={() => setCreating(false)} onCreated={answers.reload} />}
      {revoking && (
        <ConfirmDialog
          title="Revoke this link?"
          body={<p>The link stops working. Answers you already received stay here for review.</p>}
          confirmLabel="Revoke link"
          danger
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            await api.revokeQuestionLink(revoking.link_id);
            toast("Link revoked.");
            answers.reload();
          }}
        />
      )}
    </div>
  );
}
