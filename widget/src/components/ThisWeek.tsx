import { type ThisWeekViewData } from "../types";
import { type ViewProps } from "./common";
import { QuietHome } from "./Moment";

export const PROMISE = "Venn never sends anything for you.";

// The weekly nudge arrives as ChatGPT's own message; the widget only points home.
export default function ThisWeek({ bridge, nav }: ViewProps<ThisWeekViewData>) {
  return <QuietHome bridge={bridge} nav={nav} />;
}
