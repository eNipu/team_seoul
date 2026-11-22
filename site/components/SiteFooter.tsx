import { CookieSettingsLink } from "./ConsentBanner";
import ScrollArrow from "./ScrollArrow";

export default function SiteFooter({ top = "#top" }: { top?: string }) {
  return (
    <footer className="site-footer wrap">
      <div className="site-footer__links">
        <span>© {new Date().getFullYear()} Venn</span>
        <a href="/privacy">Privacy</a>
        <a href="/pricing">Pricing</a>
        <CookieSettingsLink />
      </div>
      <ScrollArrow href={top} label="Back to top" direction="up" />
    </footer>
  );
}
