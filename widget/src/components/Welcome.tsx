import type { WelcomeViewData } from "../types";
import type { ViewProps } from "./common";
import SetupCard from "./Setup";

export default function Welcome({ data, nav }: ViewProps<WelcomeViewData>) {
  return <SetupCard data={data} nav={nav} />;
}
