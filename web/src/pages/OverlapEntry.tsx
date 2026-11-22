import { useEffect } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link } from "../router";
import { useAsync } from "../ui";

/** Home is only a doorway. Viewing it never enrolls anyone or reveals either name. */
export function OverlapEntry() {
  const { data, error, reload } = useAsync(() => api.getOverlap(), []);
  const enrolled = !error && Boolean(data?.preference);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) reload(); };
    document.addEventListener("visibilitychange", refresh);
    const id = enrolled ? window.setInterval(refresh, 15_000) : undefined;
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enrolled, reload]);

  const match = enrolled ? data?.match : null;
  const label = match?.status === "introduced" ? "You both said yes"
    : match?.status === "waiting" ? "You said yes to this plan"
    : match ? match.title : enrolled ? "Looking for your overlap" : "Meet someone new";
  const hint = match?.status === "introduced" ? "Open your introduction and see your shared challenge."
    : match?.status === "waiting" ? "Your name stays private until you both opt in to the plan."
    : match ? "An activity for two, based on the interests and window you chose."
    : enrolled ? "You’re opted in for one window. View or withdraw your request."
    : "Choose a Seoul neighborhood and an activity. Get introduced only if you both say yes.";
  return (
    <Link to="/overlap" className="callout ov-entry">
      <Icon name="users" size={22} />
      <span className="ov-entry__text"><span className="ov-kicker">Venn Overlap</span><strong>{label}</strong><span className="callout__sub">{hint}</span></span>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}
