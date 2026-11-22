import { type ThisWeekViewData } from "../types";
import { ActionError, useAction, type ViewProps } from "./common";
import { ChatMoment, OpenMyVenn } from "./Moment";

export const PROMISE = "Venn never sends anything for you.";

export default function ThisWeek({ data, bridge, nav }: ViewProps<ThisWeekViewData>) {
  const action = useAction();
  const busy = action.busy !== null;
  const a = data.actions[0];

  if (!a) {
    return (
      <section className="onb">
        <h2 className="onb__title">Bring your person in.</h2>
        <ActionError action={action} />
        <button type="button" className="onb__cta" disabled={busy}
          onClick={() => void action.run("invite", () => nav.openView("venn_create_invite", {}))}>
          {action.busy === "invite" ? "Opening…" : "Invite your person"}
        </button>
        <div className="onb__row"><OpenMyVenn bridge={bridge} /></div>
      </section>
    );
  }

  return (
    <ChatMoment key={`${a.kind}:${a.id}`} bridge={bridge} kind={a.kind} id={a.id} name={a.display_name}
      idea={a.suggestion?.title} footer={<OpenMyVenn bridge={bridge} />} />
  );
}
