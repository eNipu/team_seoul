import { type ReconnectViewData } from "../types";
import { type ViewProps } from "./common";
import { ChatMoment, OpenMyVenn } from "./Moment";
import "./onboarding.css";

// ChatGPT speaking: one person, why now (what they shared), one action. No queue, no day counts.
export default function Reconnect({ data, bridge }: ViewProps<ReconnectViewData>) {
  const c = data.candidates[0];
  if (!c) {
    return (
      <section className="onb">
        <h2 className="onb__title">Nothing to nudge right now.</h2>
        <div className="onb__row"><OpenMyVenn bridge={bridge} /></div>
      </section>
    );
  }
  return (
    <ChatMoment key={`${c.kind}:${c.id}`} bridge={bridge} kind={c.kind} id={c.id} name={c.display_name}
      idea={c.suggested_activity || null} footer={<OpenMyVenn bridge={bridge} />} />
  );
}
