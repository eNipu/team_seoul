import type { Metadata } from "next";

import { CookieSettingsLink } from "@/components/ConsentBanner";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Pricing · Venn",
  description: "Planned launch pricing for Venn: one subscription shared by your circle. The more you invite, the less you pay.",
};

const LADDER = [
  { people: "Just you", each: "$6", total: "$6 a month", note: "Start on your own." },
  { people: "You + 1", each: "$4", total: "$8 a month, split by 2", note: "Bring your partner or best friend." },
  { people: "You + 2", each: "$3", total: "$9 a month, split by 3", note: "A small circle." },
  { people: "You + 4", each: "$2", total: "$10 a month, split by 5", note: "The full inner circle.", featured: true },
];

const FAQS = [
  {
    question: "Is this pricing live now?",
    answer: "No. These are planned launch prices. Early access is free for the Founding Circle.",
  },
  {
    question: "How does the price drop?",
    answer: "Everyone you add to your circle shares one subscription. The plan gets a little bigger, but it is split between more people, so each person pays less: $6 alone, $2 each when five of you share it.",
  },
  {
    question: "Who pays inside a shared circle?",
    answer: "You choose. One person can cover everyone, or each person pays their own share. Either way, every member has their own account and decides for themselves what they share.",
  },
  {
    question: "Does sharing a subscription share my data?",
    answer: "No. Sharing the bill never shares your AI memory. Each person only shares the signals they approve, with the people they pick.",
  },
  {
    question: "Can someone I invite use Venn for free?",
    answer: "Yes. Anyone can accept an invite, stay connected and approve what they share for free. The subscription is for getting the full Venn in ChatGPT: reconnection nudges, your whole network, and more.",
  },
  {
    question: "What is the Founding Circle offer?",
    answer: "Waitlist members get early access free, and keep the lowest price of their circle size for the first year after launch.",
  },
];

export default function PricingPage() {
  return (
    <>
      <main>
        <section className="section section--paper pricing-hero" aria-labelledby="pricing-title">
          <SiteHeader note="Planned pricing" />
          <div className="wrap pricing-hero__body">
            <p className="eyebrow">Early access is free</p>
            <h1 className="h-section" id="pricing-title">The more you invite, the less you pay.</h1>
            <p className="lead">
              One Venn subscription, shared by your circle. Every person you add makes it cheaper for everyone, down to $2 a month each.
            </p>
            <a className="btn btn--primary" href="/#waitlist">
              Build your inner circle
            </a>
            <p className="pricing__note">Planned pricing at launch. Early access is free.</p>
          </div>
        </section>

        <section className="section pricing-plans" aria-labelledby="plans-title">
          <div className="wrap">
            <h2 className="h-section" id="plans-title">Share the subscription.</h2>
            <div className="pricing-grid" aria-label="Price per person by circle size">
              {LADDER.map((step) => (
                <article className={`pricing-card${step.featured ? " pricing-card--featured" : ""}`} key={step.people}>
                  <div className="pricing-card__head">
                    <h3>{step.people}</h3>
                    {step.featured ? <span className="badge">Best price</span> : null}
                  </div>
                  <p className="pricing-card__price">
                    {step.each}
                    <span>per person, per month</span>
                  </p>
                  <p>{step.total}</p>
                  <p>{step.note}</p>
                </article>
              ))}
            </div>
            <p className="pricing__note">Everyone gets the full Venn: your whole network, reconnection nudges and your AI meeting theirs inside ChatGPT.</p>
          </div>
        </section>

        <section className="section section--paper pricing-promise" aria-labelledby="promise-title">
          <div className="wrap pricing-promise__grid">
            <div>
              <p className="eyebrow">The promise</p>
              <h2 className="h-section" id="promise-title">You share the bill. Not your memory.</h2>
              <p className="lead">
                Every person in a shared circle has their own account. They choose what to share and with whom. Anyone you invite can also stay connected for free.
              </p>
            </div>
            <div className="moment" aria-hidden="true">
              <span className="moment__text">Lena joined your circle. You now pay $4 instead of $6.</span>
              <span className="moment__prov">Shared subscription · via <b>venn</b></span>
            </div>
          </div>
        </section>

        <section className="section pricing-founder" aria-labelledby="founder-title">
          <div className="wrap pricing-founder__body">
            <p className="eyebrow">Founding Circle</p>
            <h2 className="h-section" id="founder-title">Free while we build.</h2>
            <p className="lead">
              Waitlist members get early access free, and keep the lowest price of their circle size for the first year after launch.
            </p>
          </div>
        </section>

        <section className="section section--paper faq" aria-labelledby="pricing-faq-title">
          <div className="wrap">
            <h2 className="h-section" id="pricing-faq-title">Pricing questions</h2>
            {FAQS.map(({ question, answer }) => (
              <details className="faq__item" key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="wrap">
        <span>
          © {new Date().getFullYear()} Venn · <a href="/">Home</a> · <a href="/privacy">Privacy</a> · <CookieSettingsLink />
        </span>
        <p>The people in the examples are made up.</p>
      </footer>
    </>
  );
}
