import { firstName, friendArg, plural, type VennViewData } from "../types";
import { ActionError, Avatar, SectionTitle, useAction, type ViewProps } from "./common";
import { Icon } from "./icons";
import { PlanTools, SuggestionBody } from "./PlanTools";

/** Labels shown inside one region of the diagram; the complete lists follow underneath. */
const IN_DIAGRAM = 3;

type Side = "you" | "both" | "them";

function Region({ side, items, caption }: { side: Side; items: string[]; caption: string }) {
  const shown = items.slice(0, IN_DIAGRAM);
  const more = items.length - shown.length;
  return (
    <div className={`vd__region vd__region--${side}`}>
      <span className="vd__count">{items.length}</span>
      <span className="vd__caption">{caption}</span>
      {shown.length > 0 && (
        <ul className="vd__labels">
          {shown.map((item, i) => (
            <li key={`${item}-${i}`}>{item}</li>
          ))}
          {more > 0 && <li className="vd__more">+{more} more</li>}
        </ul>
      )}
    </div>
  );
}

function Group({ side, title, items, empty }: { side: Side; title: string; items: string[]; empty: string }) {
  return (
    <div className="vgroup">
      <h3 className="vgroup__title">
        <span className={`vgroup__dot vgroup__dot--${side}`} aria-hidden="true" />
        {title}
        <span className="count">{items.length}</span>
      </h3>
      {items.length > 0 ? (
        <ul className="chips">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className={`chip chip--venn-${side}`}>
              {side === "both" && <Icon name="star" size={12} />}
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{empty}</p>
      )}
    </div>
  );
}

export default function VennCard({ data, bridge, nav }: ViewProps<VennViewData>) {
  const action = useAction();
  const first = firstName(data.display_name);
  const arg = friendArg(data.kind, data.id);
  const busy = action.busy !== null;
  const none = data.shared.length === 0;
  const headline = data.summary || (none ? "Nothing in common on record yet" : `You and ${first} have ${plural(data.shared.length, "thing", "things")} in common`);

  return (
    <section className="panel venn-card">
      <div className="venn-card__head">
        <p className="eyebrow">Common ground</p>
        <h2>{headline}</h2>
      </div>

      <div className="vd-wrap">
        <div className="vd__who" aria-hidden="true">
          <span className="vd__person">
            <span className="avatar avatar--small avatar--you">You</span>
            <strong>You</strong>
          </span>
          <span className="vd__person vd__person--them">
            <strong>{first}</strong>
            <Avatar name={data.display_name} size="small" />
          </span>
        </div>
        <div className={`vd ${none ? "vd--none" : ""}`} aria-hidden="true">
          <svg className="vd__svg" viewBox="0 0 288 196" focusable="false">
            <circle className="vd__circle vd__circle--you" cx="94" cy="98" r="90" />
            <circle className="vd__circle vd__circle--them" cx="194" cy="98" r="90" />
            <path className="vd__lens" d="M144 23.2A90 90 0 0 1 144 172.8A90 90 0 0 1 144 23.2Z" />
          </svg>
          <Region side="you" items={data.you_only} caption="only you" />
          <Region side="both" items={data.shared} caption="in common" />
          <Region side="them" items={data.them_only} caption={`only ${first}`} />
        </div>
      </div>

      <div className="vgroups">
        <Group side="both" title="In common" items={data.shared} empty={`Nothing in common on record yet. Ask ${first} what they have been into lately.`} />
        <Group side="you" title="Only you" items={data.you_only} empty="Nothing here yet." />
        <Group side="them" title={`Only ${first}`} items={data.them_only} empty={`Venn doesn't know anything else about ${first} yet.`} />
      </div>

      <ActionError action={action} />

      <div className="stack-actions">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy}
          onClick={() => void action.run("ideas", () => nav.openView("venn_suggest_activity", arg))}
        >
          <Icon name="bulb" size={18} />
          {action.busy === "ideas" ? "Opening…" : "Get more ideas"}
        </button>
        <button
          type="button"
          className="btn btn--block"
          disabled={busy}
          onClick={() => void action.run("open", () => nav.openView("venn_view_friend", arg))}
        >
          <Icon name="user" size={18} />
          {action.busy === "open" ? "Opening…" : `Open ${first}`}
        </button>
      </div>

      {data.suggestions.length > 0 && (
        <>
          <SectionTitle count={data.suggestions.length}>{none ? "Ideas to find common ground" : "Ideas from your overlap"}</SectionTitle>
          <ul className="list">
            {data.suggestions.map((s, i) => (
              <li key={i} className="card">
                <SuggestionBody s={s} />
                <PlanTools
                  bridge={bridge}
                  title={s.title}
                  details={s.description}
                  calendarTitle={`${s.title} with ${data.display_name}`}
                  friends={[{ kind: data.kind, id: data.id }]}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
