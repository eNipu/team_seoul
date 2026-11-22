import type { ReactNode } from "react";
import VennMark from "./VennMark";

export default function SiteHeader({ note = "For ChatGPT", action }: { note?: string; action?: ReactNode }) {
  return (
    <header className="site-header wrap">
      <span className="brand">
        <VennMark size={104} />
      </span>
      <div className="site-header__end">
        <span className="site-header__note">{note}</span>
        {action}
      </div>
    </header>
  );
}
