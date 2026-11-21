import VennMark from "./VennMark";

export default function SiteHeader({ note = "For ChatGPT" }: { note?: string }) {
  return (
    <header className="site-header wrap">
      <span className="brand">
        <VennMark />
        Venn
      </span>
      <span className="pill">{note}</span>
    </header>
  );
}
