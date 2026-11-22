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
    : match?.status === "waiting" ? "You said yes. Their turn."
    : match ? match.title : enrolled ? "Your Seoul window is open" : "Meet someone new in Seoul";
  return (
    <Link to="/overlap" className="callout ov-entry">
      <Icon name="users" size={22} />
      <span className="ov-entry__text"><strong>{label}</strong><span className="callout__sub">Venn Overlap</span></span>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}
