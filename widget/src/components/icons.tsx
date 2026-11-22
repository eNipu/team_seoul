// Venn's icon set, brand mark and spot illustrations. Everything is inline SVG:
// no fonts, no image files, no remote assets.
//
// Icons share one grid (24×24), one stroke (1.75, round caps and joins) and take
// their colour from `currentColor`. They are decorative by default (aria-hidden);
// pass `label` when an icon stands on its own.
//
// Illustrations share one style: a soft blob, flat "paper" shapes and a little
// brand coral. Their colours are CSS variables (--ill-*) so they follow the theme.

import type { MemoryCategory } from "../types";

const dot = (cx: number, cy: number, r = 1.15) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const ICONS = {
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  expand: <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />,
  collapse: <path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.7 2.2c-.8.45-1.3 1-1.3 1.9" />
      {dot(12, 16.6, 1)}
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 11.2v5.3" />
      {dot(12, 7.9, 1)}
    </>
  ),
  alert: (
    <>
      <path d="M12 4.2l8.6 15H3.4z" />
      <path d="M12 10v4.2" />
      {dot(12, 16.7, 1)}
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M8 12.3l2.7 2.7L16 9.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.25" />
      <path d="M15.8 15.8L20 20" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10.2h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  chat: <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6l-4.5 1.4 1.3-4.1A7.5 7.5 0 1 1 20 11.5z" />,
  bulb: <path d="M9.5 18h5M10.5 21h3M8 14.5a6 6 0 1 1 8 0c-.6.6-1 1.2-1 2H9c0-.8-.4-1.4-1-2z" />,
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />,
  sparkle: <path d="M12 3.5c.6 4.6 3.9 7.9 8.5 8.5-4.6.6-7.9 3.9-8.5 8.5-.6-4.6-3.9-7.9-8.5-8.5 4.6-.6 7.9-3.9 8.5-8.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trash: <path d="M5 7h14M10 4h4M7 7l.8 11a2 2 0 0 0 2 1.9h4.4a2 2 0 0 0 2-1.9L17 7M10.5 11v5M13.5 11v5" />,
  pencil: <path d="M4.5 19.5l1-4L16 5a2.05 2.05 0 0 1 2.9 0l.1.1a2.05 2.05 0 0 1 0 2.9L8.5 18.5zM14 7l3 3" />,
  pen: <path d="m4 20 2-7 7-7 5 5-7 7-7 2 5.5-5.5M13 6l2-2a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-2 2M9.5 14.5h.01" />,
  note: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="3" />
      <path d="M9 9h6M9 12.75h6M9 16.5h3" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      {dot(8.75, 8.75)}
      {dot(12, 12)}
      {dot(15.25, 15.25)}
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.7-3.6 3.5-5.5 7-5.5s6.3 1.9 7 5.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.75" r="3.25" />
      <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M15.5 5.7a3.25 3.25 0 0 1 0 6.1M17.6 14.9c1.8.7 2.9 2.2 3.4 4.6" />
    </>
  ),
  "user-plus": (
    <>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 20c.7-3.6 3.2-5.5 6.5-5.5 1.5 0 2.9.4 4 1.1M18 13.5v6M15 16.5h6" />
    </>
  ),
  import: <path d="M12 4v10.5M8 10.5l4 4 4-4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  shield: <path d="M12 3.5l7 2.5v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6zM9 12l2.2 2.2L15 10.5" />,
  heart: <path d="M12 19.5s-7-4.3-7-9.6a3.9 3.9 0 0 1 7-2.3 3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z" />,
  link: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
  send: <path d="M20 4L3.5 10.5l6.5 3 3 6.5zM10 13.5L20 4" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M5.9 5.9l12.2 12.2" />
    </>
  ),
  sliders: (
    <>
      <path d="M4.5 7.5H12M17 7.5h2.5M4.5 16.5H7M12 16.5h7.5" />
      <circle cx="14.5" cy="7.5" r="2.25" />
      <circle cx="9.5" cy="16.5" r="2.25" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  camera: (
    <>
      <rect x="4" y="6.75" width="16" height="12.5" rx="3" />
      <circle cx="12" cy="13" r="3.1" />
      <path d="M9 6.75l1-2h4l1 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="12" r="4.5" />
      {dot(12, 12, 1.1)}
    </>
  ),
  briefcase: (
    <>
      <rect x="4" y="8" width="16" height="11.5" rx="2.5" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" />
    </>
  ),
  bookmark: <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z" />,
  flag: <path d="M6 21V4.5M6 5h11l-2.2 3.5L17 12H6" />,
  ticket: (
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6.5v2M14 11v2M14 15.5v2" />
  ),
  trophy: (
    <path d="M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H5v1a3 3 0 0 0 3 3M16 6.5h3v1a3 3 0 0 1-3 3M12 13.5V17M8.5 20h7M10 17h4" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M8.5 14a4 4 0 0 0 7 0" />
      {dot(9, 9.9, 1)}
      {dot(15, 9.9, 1)}
    </>
  ),
  sprout: <path d="M12 20.5v-8M12 12.5c0-3-2-5-6-5 0 4 2 6 6 5zM12 15c0-3.5 2.5-5.5 6.5-5.5 0 4-2.5 6-6.5 5.5z" />,
  venn: (
    <>
      <circle cx="9" cy="12" r="6.25" />
      <circle cx="15" cy="12" r="6.25" />
    </>
  ),
  inbox: (
    <path d="M4 13.5l2.4-7.2A1.5 1.5 0 0 1 7.8 5.25h8.4a1.5 1.5 0 0 1 1.4 1.05L20 13.5M4 13.5v4A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-4M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" />
  ),
  "calendar-check": (
    <path d="M7.5 3.5v3M16.5 3.5v3M4.5 9.5h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5zM9 14.5l2.2 2.2 4-4.2" />
  ),
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  /** Pixel size of the square icon. Defaults to 20. */
  size?: number;
  /** Accessible name. Omit for decorative icons (the default). */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {ICONS[name]}
    </svg>
  );
}

export const CATEGORY_ICONS: Record<MemoryCategory, IconName> = {
  INTEREST: "sparkle",
  DISLIKE: "ban",
  PREFERENCE: "sliders",
  EXPERIENCE: "compass",
  PERSONAL_MEMORY: "camera",
  SOCIAL_GOAL: "target",
  RELATIONSHIP_CONTEXT: "users",
  WORK: "briefcase",
};

/** Tinted tile with the icon of a memory category. Colour comes from `.cat--<category>`. */
export function CategoryIcon({ category, small }: { category: MemoryCategory; small?: boolean }) {
  return (
    <span className={`cat-icon cat--${category.toLowerCase()}${small ? " cat-icon--small" : ""}`} aria-hidden="true">
      <Icon name={CATEGORY_ICONS[category]} size={small ? 16 : 18} />
    </span>
  );
}

/** The Venn mark: a heart, held. Brand coral #E86A4A in both themes. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {/* Two overlapping circles: you, a friend, and what you share. Same mark as plugin/assets. */}
      <rect width="32" height="32" rx="8" fill="#E86A4A" />
      <circle cx="11.75" cy="16" r="8.5" fill="#fff" fillOpacity="0.5" />
      <circle cx="20.25" cy="16" r="8.5" fill="#fff" fillOpacity="0.5" />
      <path d="M16 8.64a8.5 8.5 0 0 1 0 14.72 8.5 8.5 0 0 1 0-14.72z" fill="#fff" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Spot illustrations
// ---------------------------------------------------------------------------

const HEART = "M0 6.5s-6.5-4-6.5-8.7A3.6 3.6 0 0 1 0-4.3a3.6 3.6 0 0 1 6.5 2.1C6.5 2.5 0 6.5 0 6.5z";

const heart = (x: number, y: number, scale = 1, className = "ill-brand") => (
  <path className={className} d={HEART} transform={`translate(${x} ${y}) scale(${scale})`} />
);
const bar = (x: number, y: number, w: number, className = "ill-ink", h = 5) => (
  <rect className={className} x={x} y={y} width={w} height={h} rx={h / 2} />
);
const spark = (x: number, y: number, s = 1, className = "ill-brand") => (
  <path
    className={className}
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0-6c.4 3.3 2.7 5.6 6 6-3.3.4-5.6 2.7-6 6-.4-3.3-2.7-5.6-6-6 3.3-.4 5.6-2.7 6-6z"
  />
);
const person = (x: number, y: number, className: string, r = 15) => (
  <g transform={`translate(${x} ${y})`}>
    <circle className={className} r={r} />
    <circle className="ill-paper" cy={-r * 0.2} r={r * 0.32} />
    <path className="ill-paper" d={`M${-r * 0.55} ${r * 0.62}a${r * 0.55} ${r * 0.5} 0 0 1 ${r * 1.1} 0z`} />
  </g>
);

const BLOB = "M26 52c0-24 20-40 46-40 30 0 50 14 50 38 0 25-22 38-50 38-27 0-46-13-46-36z";

const ILLUSTRATIONS = {
  /** Two people and what is held between them. Wide; used as the onboarding hero. */
  welcome: {
    width: 220,
    art: (
      <>
        <path className="ill-blob" d="M30 54c0-26 34-44 82-44 50 0 82 16 82 42 0 27-36 40-82 40-48 0-82-13-82-38z" />
        <path className="ill-line ill-dash" d="M70 50c12-18 28-26 40-18M150 50c-12-18-28-26-40-18" />
        {person(62, 56, "ill-tint-a", 20)}
        {person(158, 56, "ill-tint-b", 20)}
        <rect className="ill-paper ill-edge" x="88" y="32" width="44" height="46" rx="10" />
        {heart(110, 50, 1.25)}
        {bar(98, 64, 24)}
        {bar(102, 71, 16, "ill-ink-soft", 4)}
        {spark(34, 26, 0.8)}
        {spark(190, 84, 0.6, "ill-accent-soft")}
        <circle className="ill-accent-soft" cx="182" cy="22" r="4" />
        <circle className="ill-brand" cx="42" cy="88" r="3" />
      </>
    ),
  },
  /** A question, answered. */
  help: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <path className="ill-paper ill-edge" d="M42 30a10 10 0 0 1 10-10h40a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10H68l-12 10v-10h-4a10 10 0 0 1-10-10z" />
        <path className="ill-brand-line" d="M65 37a7.5 7.5 0 1 1 11 6.6c-2.3 1.3-3.7 2.8-3.7 5.4" />
        <circle className="ill-brand" cx="72.3" cy="56" r="2.3" />
        <rect className="ill-tint-b" x="92" y="52" width="30" height="24" rx="8" />
        {bar(99, 60, 16, "ill-paper", 4)}
        {bar(99, 67, 10, "ill-paper", 4)}
        {spark(112, 26, 0.7)}
        <circle className="ill-accent-soft" cx="32" cy="70" r="4" />
      </>
    ),
  },
  /** What ChatGPT remembers, coming over as cards you choose from. */
  import: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <path className="ill-tint-b" d="M22 34a9 9 0 0 1 9-9h24a9 9 0 0 1 9 9v16a9 9 0 0 1-9 9H41l-9 8v-8h-1a9 9 0 0 1-9-9z" />
        {bar(31, 35, 24, "ill-paper", 4)}
        {bar(31, 43, 15, "ill-paper", 4)}
        <path className="ill-brand-line" d="M68 48h14M77 42l6 6-6 6" />
        <rect className="ill-paper ill-edge" x="92" y="20" width="36" height="24" rx="7" />
        {heart(104, 32, 0.8)}
        {bar(112, 30, 10, "ill-ink", 4)}
        <rect className="ill-paper ill-edge" x="86" y="50" width="36" height="24" rx="7" />
        <path className="ill-brand-line" d="M94 62l3.5 3.5 6-6.5" />
        {bar(108, 60, 9, "ill-ink", 4)}
        {spark(72, 22, 0.6, "ill-accent-soft")}
      </>
    ),
  },
  /** An invitation with a heart seal. */
  invite: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <rect className="ill-paper ill-edge" x="40" y="30" width="64" height="44" rx="9" />
        <path className="ill-line" d="M42 34l30 22 30-22" />
        <circle className="ill-brand" cx="72" cy="57" r="10" />
        {heart(72, 57.5, 0.75, "ill-paper")}
        {spark(112, 26, 0.75)}
        <circle className="ill-tint-b" cx="30" cy="38" r="6" />
        <circle className="ill-accent-soft" cx="116" cy="70" r="4" />
      </>
    ),
  },
  /** A hand of cards with a question on top. */
  quiz: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <rect className="ill-tint-b" x="40" y="22" width="36" height="50" rx="8" transform="rotate(-12 58 47)" />
        <rect className="ill-tint-a" x="68" y="22" width="36" height="50" rx="8" transform="rotate(12 86 47)" />
        <rect className="ill-paper ill-edge" x="54" y="18" width="36" height="52" rx="8" />
        <path className="ill-brand-line" d="M66 37a6.2 6.2 0 1 1 9.2 5.4c-1.9 1.1-3.1 2.3-3.1 4.4" />
        <circle className="ill-brand" cx="72.1" cy="53.5" r="2.1" />
        {spark(116, 30, 0.7)}
        <circle className="ill-accent-soft" cx="30" cy="64" r="4" />
      </>
    ),
  },
  /** A medal for the quiz result. */
  result: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <path className="ill-tint-b" d="M58 16h12l6 26H64z" />
        <path className="ill-tint-a" d="M74 16h12l-6 26H68z" />
        <circle className="ill-paper ill-edge" cx="72" cy="56" r="20" />
        <circle className="ill-brand" cx="72" cy="56" r="14" />
        {heart(72, 56.5, 1, "ill-paper")}
        {spark(110, 28, 0.8)}
        {spark(34, 44, 0.55, "ill-accent-soft")}
        <circle className="ill-accent-soft" cx="114" cy="66" r="4" />
      </>
    ),
  },
  /** An empty page waiting for its first memory. */
  memories: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <rect className="ill-tint-b" x="52" y="18" width="48" height="56" rx="9" transform="rotate(8 76 46)" />
        <rect className="ill-paper ill-edge" x="46" y="20" width="48" height="56" rx="9" />
        <path className="ill-brand" d="M76 20h10v18l-5-4-5 4z" />
        {bar(54, 46, 28)}
        {bar(54, 55, 20, "ill-ink-soft")}
        {bar(54, 64, 24, "ill-ink-soft")}
        {spark(112, 30, 0.7)}
      </>
    ),
  },
  /** Places at the table, not yet taken. */
  friends: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        {person(50, 50, "ill-tint-b", 16)}
        {person(94, 50, "ill-tint-a", 16)}
        <circle className="ill-paper ill-edge" cx="72" cy="46" r="18" />
        <path className="ill-brand-line" d="M72 38v16M64 46h16" />
        {spark(116, 28, 0.6)}
        <circle className="ill-accent-soft" cx="30" cy="70" r="4" />
      </>
    ),
  },
  /** Looked, found nothing. */
  search: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <rect className="ill-paper ill-edge" x="36" y="26" width="56" height="16" rx="8" />
        {bar(44, 32, 26, "ill-ink-soft", 4)}
        <rect className="ill-paper ill-edge" x="36" y="48" width="44" height="16" rx="8" />
        {bar(44, 54, 18, "ill-ink-soft", 4)}
        <circle className="ill-paper ill-brand-ring" cx="92" cy="52" r="15" />
        <path className="ill-brand-line ill-thick" d="M103 63l10 10" />
        {spark(116, 30, 0.6, "ill-accent-soft")}
      </>
    ),
  },
  /** A clear day: nobody is overdue. */
  caught_up: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <circle className="ill-tint-a" cx="72" cy="46" r="24" />
        <circle className="ill-brand" cx="72" cy="46" r="15" />
        <path className="ill-paper-line" d="M65 46.5l5 5 9-10" />
        <path className="ill-brand-line" d="M72 12v6M72 74v6M38 46h6M100 46h6M48 22l4 4M92 66l4 4M96 22l-4 4M52 66l-4 4" />
      </>
    ),
  },
  /** An idea still growing. */
  ideas: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <path className="ill-paper ill-edge" d="M56 68h32l-3 14a4 4 0 0 1-4 3H63a4 4 0 0 1-4-3z" transform="translate(0 -8)" />
        <path className="ill-brand-line" d="M72 60V36" />
        <path className="ill-brand" d="M72 44c0-9-6-15-18-15 0 12 6 18 18 15z" />
        <path className="ill-tint-b" d="M72 38c0-9 7-15 19-15 0 12-7 18-19 15z" />
        {spark(112, 36, 0.6, "ill-accent-soft")}
        <circle className="ill-accent-soft" cx="32" cy="58" r="4" />
      </>
    ),
  },
  /** Done and tidy: something was removed or finished. */
  done: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <rect className="ill-tint-b" x="44" y="30" width="56" height="44" rx="9" />
        <rect className="ill-paper ill-edge" x="38" y="22" width="56" height="44" rx="9" />
        {bar(48, 34, 26)}
        {bar(48, 44, 18, "ill-ink-soft")}
        <circle className="ill-brand" cx="94" cy="64" r="13" />
        <path className="ill-paper-line" d="M88 64.5l4.5 4.5 8-9" />
        {spark(112, 28, 0.6)}
      </>
    ),
  },
  /** The chat is where the conversation continues. */
  chat: {
    width: 144,
    art: (
      <>
        <path className="ill-blob" d={BLOB} />
        <path className="ill-tint-b" d="M70 30a9 9 0 0 1 9-9h30a9 9 0 0 1 9 9v16a9 9 0 0 1-9 9h-2v8l-9-8H79a9 9 0 0 1-9-9z" />
        <path className="ill-paper ill-edge" d="M26 44a10 10 0 0 1 10-10h40a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H50l-11 9v-9h-3a10 10 0 0 1-10-10z" />
        {heart(42, 54, 0.85)}
        {bar(52, 48, 24)}
        {bar(52, 58, 16, "ill-ink-soft")}
        {spark(124, 70, 0.6)}
      </>
    ),
  },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function Illustration({ name, size = "md" }: { name: IllustrationName; size?: "sm" | "md" | "lg" }) {
  const { width, art } = ILLUSTRATIONS[name];
  return (
    <svg
      className={`ill ill--${size}`}
      viewBox={`0 0 ${width} 100`}
      style={{ aspectRatio: `${width} / 100` }}
      aria-hidden="true"
      focusable="false"
    >
      {art}
    </svg>
  );
}
