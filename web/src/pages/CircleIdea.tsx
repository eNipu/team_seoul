import { useId, useState } from "react";
import { api } from "../api";
import { Card, CopyButton, FriendLink, useAsync } from "../ui";
import "./tools.css";

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
    <Card title="An idea">
      <h3>{suggestion.activity}</h3>
      <p>With <FriendLink {...idea.person} name={idea.person.display_name} />
        {group && <> and <FriendLink {...group.person} name={group.person.display_name} /></>}
      </p>
      <div className="row">
        <button type="button" className="btn btn--primary" aria-expanded={draftOpen} aria-controls={draftId}
          onClick={() => setDraftOpen(!draftOpen)}>{draftOpen ? "Hide invite" : "Draft an invite"}</button>
        <button type="button" className="tl__link" onClick={() => { dismiss(true); onDismiss?.(); }}>Not now</button>
      </div>
      <div id={draftId} hidden={!draftOpen}>
        {draftOpen && <div className="draft">
          <blockquote>{suggestion.draft}</blockquote>
          <div className="row">
            <CopyButton text={suggestion.draft} label="Copy" />
            {idea.group && (
              <button type="button" className="tl__link" aria-pressed={groupOpen}
                onClick={() => setGroupOpen(!groupOpen)}>{groupOpen ? "Just the two of you" : "Make it a group"}</button>
            )}
          </div>
          <p className="draft__label">Nothing is sent for you.</p>
        </div>}
      </div>
    </Card>
  );
}
