const ROUTES = [
  "M70 68 C102 68 96 38 121 38 C140 38 134 68 154 68",
  "M70 68 H154",
  "M70 68 C102 68 96 98 121 98 C140 98 134 68 154 68",
];

const CAPTIONS = [
  () => "Your AI drafts a few updates about your week. You keep what you want.",
  (circle: string) => `Only the updates you kept go to your ${circle}. Nothing else.`,
  (_: string, matched: boolean) =>
    matched ? "Maya asks her ChatGPT. Your update comes up at the right moment." : "Maya asks. Nothing comes up: you didn't share that one.",
] as const;

export default function ConnectionMap({
  circle,
  kept,
  shared,
  matched,
  step,
}: {
  step: number;
  circle: string;
  kept: readonly boolean[];
  shared: boolean;
  matched: boolean;
}) {
  return (
    <div className="connection-map">
      <svg viewBox="0 0 360 158" focusable="false" aria-hidden="true">
        {ROUTES.map((route, index) => (
          <g key={route} data-kept={kept[index]}>
            <path className="connection-map__guide" d={route} />
            <path className="connection-map__signal" d={route} pathLength={1}
              data-active={shared && kept[index]} />
            <circle className="connection-map__dot" cx={121} cy={38 + index * 30} r={4} />
          </g>
        ))}
        <path className="connection-map__guide" d="M206 68 H290" />
        <path className="connection-map__signal connection-map__signal--match" d="M206 68 H290"
          pathLength={1} data-active={matched} />
        <circle className="connection-map__pulse" cx="210" cy="68" r="4" data-active={matched} />

        <circle className="connection-map__source" cx="48" cy="68" r="23" />
        <circle className="connection-map__ring" cx="180" cy="68" r="34" />
        <circle className="connection-map__circle" cx="180" cy="68" r="26" data-active={shared} />
        <circle className="connection-map__person" cx="312" cy="68" r="23" data-active={matched} />
        <path className="connection-map__origin-mark" d="M40 68h16m-8-8v16" />
        <g className="connection-map__mark">
          <circle cx="175" cy="68" r="9" />
          <circle cx="185" cy="68" r="9" />
          <circle cx="312" cy="64" r="3" />
          <path d="M305 76a7 7 0 0 1 14 0" />
        </g>
        <text x="48" y="125">You</text>
        <text className="connection-map__small" x="48" y="143">your AI drafts</text>
        <text x="180" y="125">{circle}</text>
        <text className="connection-map__small" x="180" y="143">only who you pick</text>
        <text x="312" y="125">Maya</text>
        <text className="connection-map__small" x="312" y="143">in her ChatGPT</text>
        <text className="connection-map__small" x="121" y="18">{kept.filter(Boolean).length} updates</text>
      </svg>
      <p className="connection-map__caption" aria-live="polite">{CAPTIONS[step](circle.toLowerCase(), matched)}</p>
    </div>
  );
}
