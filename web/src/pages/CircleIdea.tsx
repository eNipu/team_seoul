import { useId, useState } from "react";
import { api } from "../api";
import { Card, CopyButton, FriendLink, useAsync } from "../ui";

export function CircleIdea({ onDismiss }: { onDismiss?: () => void }) {
  const { data } = useAsync(api.getCircleIdea, []);
  const [dismissed, dismiss] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const draftId = useId();
  const idea = data?.idea;
  if (dismissed || !idea) return null;

  const group = groupOpen ? idea.group : null;
  const suggestion = group ?? idea;
  return (
    <Card title="An idea for your circle">
      <h3>{suggestion.activity}</h3>
      <p>With <FriendLink {...idea.person} name={idea.person.display_name} />
        {group && <> and <FriendLink {...group.person} name={group.person.display_name} /></>}
      </p>
      <p className="reason">{idea.reason}{group && ` ${group.reason}`}</p>
      <div className="row">
        <button type="button" className="btn btn--primary" aria-expanded={draftOpen} aria-controls={draftId}
          onClick={() => setDraftOpen(!draftOpen)}>{draftOpen ? "Hide draft" : "Draft an invite"}</button>
        {idea.group && (
          <button type="button" className="btn" aria-pressed={groupOpen}
            onClick={() => { setGroupOpen(!groupOpen); setDraftOpen(false); }}>Make it a group</button>
        )}
        <button type="button" className="btn" onClick={() => { dismiss(true); onDismiss?.(); }}>Maybe later</button>
      </div>
      <div id={draftId} hidden={!draftOpen}>
        {draftOpen && <div className="draft">
          <p className="draft__label">Unsent draft · Nothing is sent for you</p>
          <blockquote>{suggestion.draft}</blockquote>
          <CopyButton text={suggestion.draft} label="Copy invite" />
        </div>}
      </div>
    </Card>
  );
}
