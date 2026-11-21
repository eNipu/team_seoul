import Moment from "./Moment";

const USE_CASES = [
  {
    audience: "business",
    tag: "For founders",
    title: "Stop networking. Start using your network.",
    line: "2,000 connections. How many do you actually keep in touch with? Manage the relationships you already have.",
    photo: "founder-sbahn",
    photoAlt: "Founder on a train holding a stack of business cards.",
    person: "Lena",
    text: "Lena from last week's panel is raising too. Intro?",
  },
  {
    audience: "friends",
    tag: "For friends far apart",
    title: "AI knows more about you than your mom. Why not your friends?",
    line: "Share selected AI memory updates with your friends every week.",
    photo: "friend-tempelhof",
    photoAlt: "Woman alone on a picnic blanket at Tempelhof, looking at her phone.",
    person: "Emma",
    text: "Emma from uni is in Berlin Saturday. Drinks?",
  },
  {
    audience: "couples",
    tag: "For couples",
    title: "What if our ChatGPTs talked?",
    line: "Two people. Two AIs. One shared memory.",
    photo: "couple-sofa",
    photoAlt: "A couple on one sofa, each on their own phone.",
    person: "both your",
    text: "You both told your AI: a weekend at the Baltic Sea.",
  },
];

export default function UseCases() {
  return (
    <section className="section" id="use-cases" aria-labelledby="use-cases-title">
      <div className="wrap">
        <p className="eyebrow">Share your AI memory with your inner circle</p>
        <h2 className="h-section" id="use-cases-title">One Venn. Three kinds of people.</h2>
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
