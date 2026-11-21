import Moment from "./Moment";

const USE_CASES = [
  {
    audience: "business",
    tag: "For founders",
    title: "Stop networking. Start using your network.",
    line: "Find the warm person already close to the thing you need.",
    photo: "founder-1am",
    photoAlt: "Founder working late at a laptop.",
    person: "Nina",
    text: "Nina from OnDeck needs beta users in fintech. Intro?",
  },
  {
    audience: "friends",
    tag: "For friends far apart",
    title: "Don't miss the people you miss.",
    line: "Notice the small window before it passes.",
    photo: "friend-tempelhof",
    photoAlt: "Friends walking outside in Berlin.",
    person: "Maya",
    text: "Maya is at Tempelhof Sunday. Walk?",
  },
  {
    audience: "couples",
    tag: "For couples",
    title: "Same sofa. Different conversations.",
    line: "Turn quiet context into a better next question.",
    photo: "couple-sofa",
    photoAlt: "A couple sitting together on a sofa.",
    person: "Sam",
    text: "Sam saved three flat ideas. Talk before dinner?",
  },
];

export default function UseCases() {
  return (
    <section className="section" id="use-cases" aria-labelledby="use-cases-title">
      <div className="wrap">
        <p className="eyebrow">Example moments</p>
        <h2 className="h-section" id="use-cases-title">The right person at the right time.</h2>
        <div className="usecases">
          {USE_CASES.map(({ audience, tag, title, line, photo, photoAlt, person, text }) => (
            <article className={`usecase usecase--${audience}`} key={audience}>
              <img
                className="usecase__photo"
                src={`/brand/photos/${photo}.webp`}
                width={900}
                height={1350}
                alt={photoAlt}
                loading="lazy"
              />
              <div className="usecase__body">
                <span className="usecase__tag">{tag}</span>
                <h3 className="usecase__title">{title}</h3>
                <p>{line}</p>
                <Moment person={person} text={text} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
