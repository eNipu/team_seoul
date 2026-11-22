import { type ReconnectViewData } from "../types";
import { type ViewProps } from "./common";
import { QuietHome } from "./Moment";

// Who to reconnect with is said by ChatGPT in plain text; the widget only points home.
export default function Reconnect({ bridge, nav }: ViewProps<ReconnectViewData>) {
  return <QuietHome bridge={bridge} nav={nav} />;
}
