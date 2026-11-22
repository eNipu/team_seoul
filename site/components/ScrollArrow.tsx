export default function ScrollArrow({
  href,
  label,
  direction = "down",
}: {
  href: string;
  label: string;
  direction?: "up" | "down";
}) {
  return (
    <a className="scroll-arrow" href={href} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === "up" ? "M12 20V4m-6 6 6-6 6 6" : "M12 4v16m-6-6 6 6 6-6"} />
      </svg>
    </a>
  );
}
