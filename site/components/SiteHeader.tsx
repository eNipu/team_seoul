import { PRODUCT_LINKS, PROFILE_URL } from "@/lib/links";
import VennMark from "./VennMark";

export default function SiteHeader({ current, note }: { current?: string; note?: string }) {
  const links = PRODUCT_LINKS.map(({ href, label }) => (
    <a key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</a>
  ));

  return (
    <header className="site-header wrap">
      <a className="brand" href="/" aria-label="Venn home" aria-current={current === "/" ? "page" : undefined}>
        <VennMark size={104} />
      </a>
      {note ? <span className="site-header__note">{note}</span> : (
        <div className="site-header__end">
          <nav className="site-header__nav" aria-label="Main navigation">{links}</nav>
          <details className="site-header__menu">
            <summary>Menu</summary>
            <nav aria-label="Main navigation">{links}</nav>
          </details>
          <a className="site-header__account" href={PROFILE_URL}>My Venn</a>
        </div>
      )}
    </header>
  );
}
