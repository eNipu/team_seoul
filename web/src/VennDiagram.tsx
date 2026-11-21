// The Venn diagram: you, a friend, and what you share in the lens.
// Two drawings of the same data: side by side for wide screens, stacked for narrow
// ones (so the text stays a readable size). CSS shows one of them. The full lists are
// always printed below the drawing by the caller, so the SVG text is decorative.

interface Props {
  you: string[];
  shared: string[];
  them: string[];
  themName: string;
}

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

function lines(items: string[], max: number, width: number): { text: string; more: boolean }[] {
  const shown = items.slice(0, max).map((t) => ({ text: clip(t, width), more: false }));
  if (items.length > max) shown.push({ text: `+${items.length - max} more`, more: true });
  return shown;
}

function Column({
  items,
  x,
  y,
  step,
  className = "venn__item",
}: {
  items: { text: string; more: boolean }[];
  x: number;
  y: number;
  step: number;
  className?: string;
}) {
  return (
    <>
      {items.map((l, i) => (
        <text key={`${l.text}:${i}`} x={x} y={y + i * step} className={l.more ? "venn__more" : className}>
          {l.text}
        </text>
      ))}
    </>
  );
}

const NONE = ["Nothing in", "common on", "record yet"];

function describe({ you, shared, them, themName }: Props): string {
  const part = (label: string, items: string[]) => `${label}: ${items.length ? items.join(", ") : "nothing on record"}`;
  return `Venn diagram. ${part("Only you", you)}. ${part("Both of you", shared)}. ${part(`Only ${themName}`, them)}.`;
}

export default function VennDiagram(props: Props) {
  const { you, shared, them, themName } = props;
  const label = describe(props);
  const name = clip(themName, 16);

  // Wide: circles r=160 at (220,180) and (420,180); the lens spans x 260–380.
  const wYou = lines(you, 5, 19);
  const wShared = lines(shared, 4, 13);
  const wThem = lines(them, 5, 19);
  const wideStart = (n: number) => 196 - ((n - 1) * 26) / 2;

  // Tall: circles r=130 at (170,140) and (170,300); the lens spans y 170–270.
  const tYou = lines(you, 3, 24);
  const tShared = lines(shared, 3, 20);
  const tThem = lines(them, 3, 24);

  return (
    <div className="venn" role="img" aria-label={label}>
      <svg className="venn__svg venn__svg--wide" viewBox="0 0 640 360" aria-hidden="true" focusable="false">
        <circle className="venn__circle venn__circle--you" cx="220" cy="180" r="160" />
        <circle className="venn__circle venn__circle--them" cx="420" cy="180" r="160" />
        <path className="venn__lens" d="M320 55.1a160 160 0 0 1 0 249.8a160 160 0 0 1 0-249.8z" />
        <text x="150" y="92" className="venn__label">
          You
        </text>
        <text x="490" y="92" className="venn__label">
          {name}
        </text>
        <text x="320" y="92" className="venn__label venn__label--both">
          Both
        </text>
        {you.length === 0 ? (
          <text x="150" y="190" className="venn__more">
            Nothing yet
          </text>
        ) : (
          <Column items={wYou} x={150} y={wideStart(wYou.length)} step={26} />
        )}
        {shared.length === 0 ? (
          <Column items={NONE.map((text) => ({ text, more: true }))} x={320} y={170} step={20} />
        ) : (
          <Column items={wShared} x={320} y={wideStart(wShared.length)} step={26} className="venn__item venn__item--shared" />
        )}
        {them.length === 0 ? (
          <text x="490" y="190" className="venn__more">
            Nothing yet
          </text>
        ) : (
          <Column items={wThem} x={490} y={wideStart(wThem.length)} step={26} />
        )}
      </svg>

      <svg className="venn__svg venn__svg--tall" viewBox="0 0 340 440" aria-hidden="true" focusable="false">
        <circle className="venn__circle venn__circle--you" cx="170" cy="140" r="130" />
        <circle className="venn__circle venn__circle--them" cx="170" cy="300" r="130" />
        <path className="venn__lens" d="M67.5 220a130 130 0 0 1 205 0a130 130 0 0 1-205 0z" />
        <text x="170" y="48" className="venn__label">
          You
        </text>
        {you.length === 0 ? (
          <text x="170" y="100" className="venn__more">
            Nothing yet
          </text>
        ) : (
          <Column items={tYou} x={170} y={78} step={22} />
        )}
        {shared.length === 0 ? (
          <text x="170" y="225" className="venn__more">
            Nothing in common on record yet
          </text>
        ) : (
          <Column
            items={tShared}
            x={170}
            y={225 - ((tShared.length - 1) * 22) / 2}
            step={22}
            className="venn__item venn__item--shared"
          />
        )}
        {them.length === 0 ? (
          <text x="170" y="340" className="venn__more">
            Nothing yet
          </text>
        ) : (
          <Column items={tThem} x={170} y={302} step={22} />
        )}
        <text x="170" y="402" className="venn__label">
          {name}
        </text>
      </svg>
    </div>
  );
}
