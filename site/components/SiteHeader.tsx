import { PRODUCT_LINKS } from "@/lib/links";
import VennMark from "./VennMark";

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

export default function SiteHeader({ current, note }: { current?: string; note?: string }) {
  const links = PRODUCT_LINKS.map(({ href, label }) => {
    const isConnect = href === "/connect";
    return (
      <a
        key={href}
        href={href}
        className={isConnect ? "site-header__cta" : undefined}
        aria-current={current === href ? "page" : undefined}
      >
        {isConnect && <SparkleIcon />}
        <span>{label}</span>
      </a>
    );
  });

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
        </div>
      )}
    </header>
  );
}
