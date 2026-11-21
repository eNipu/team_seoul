/** The Venn mark: two circles and the ground they share. Decorative; pair it with the wordmark. */
export default function VennMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="venn-mark"
      viewBox="0 0 32 20"
      width={size}
      height={(size * 20) / 32}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="22" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 3.29a9 9 0 0 1 0 13.42a9 9 0 0 1 0-13.42z" fill="currentColor" />
    </svg>
  );
}
