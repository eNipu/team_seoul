export type CollagePerson = {
  name: string;
  /** One line of context, e.g. "Launching in Berlin". */
  context: string;
  /** Optional square portrait (a path under /public or a URL). Initials are shown without it. */
  image?: string;
};

export type CollageProps = {
  left: CollagePerson;
  right: CollagePerson;
  /** The common ground, e.g. "Berlin". */
  shared: string;
};

function initials(name: string): string {
  if (name.length <= 3) return name; // "You"
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

// The name is left out beside a circle that already spells it ("You").
function Caption({ person, side }: { person: CollagePerson; side: "left" | "right" }) {
  const named = person.image !== undefined || initials(person.name) !== person.name;
  return (
    <p className={`collage__side collage__side--${side}`}>
      {named && <strong>{person.name}</strong>}
      <span>{person.context}</span>
    </p>
  );
}

function Portrait({ person, side }: { person: CollagePerson; side: "a" | "b" }) {
  return (
    <span className={`venn-pair__who venn-pair__who--${side}${person.image ? " venn-pair__who--photo" : ""}`}>
      {person.image ? (
        <img src={person.image} alt="" width={84} height={84} loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden="true">{initials(person.name)}</span>
      )}
    </span>
  );
}

/**
 * Optional hero visual: two overlapping portraits with what each person is doing
 * and the ground they share. Pass `image` on either person to show a photo.
 * Shown only where the hero has room for it (see `.collage` in globals.css).
 */
export default function HeroCollage({ left, right, shared }: CollageProps) {
  return (
    <figure className="collage">
      <figcaption className="sr-only">
        Example: {left.name} ({left.context}) and {right.name} ({right.context}) share {shared}.
      </figcaption>
      <div className="collage__row" aria-hidden="true">
        <Caption person={left} side="left" />
        <div className="venn-pair">
          <Portrait person={left} side="a" />
          <Portrait person={right} side="b" />
          <span className="venn-pair__shared">{shared}</span>
        </div>
        <Caption person={right} side="right" />
      </div>
    </figure>
  );
}
