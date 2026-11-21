import VennMark from "./VennMark";

export default function SiteHeader({ note = "For ChatGPT" }: { note?: string }) {
  return (
    <header className="site-header wrap">
      <span className="brand">
        <VennMark size={104} />
      </span>
      <span className="site-header__note">{note}</span>
    </header>
  );
}
