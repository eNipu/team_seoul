import type { Metadata } from "next";

import { CookieSettingsLink } from "@/components/ConsentBanner";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Pricing · Venn",
  description: "Planned launch pricing for Venn. Early access is free, and invited friends are always free.",
};

const PLANS = [
  {
    name: "Free Guest",
    price: "$0",
    note: "Forever.",
    audience: "For invited friends and light personal use.",
    items: [
      "Accept invites and stay connected.",
      "Approve, edit, or stop sharing any signal.",
      "Answer question links without an account wall.",
      "Keep up to 10 private people of your own.",
    ],
  },
  {
    name: "Inner Circle",
    price: "$5",
    note: "Per month, planned at launch.",
    audience: "For the person who wants Venn to maintain their network.",
    featured: true,
    items: [
      "Up to 1,000 people.",
      "Five free friend passes.",
      "Reconnection nudges and private notes.",
      "Your ChatGPT helps you find the right person.",
    ],
  },
  {
    name: "Patron Circle",
    price: "$10",
    note: "Per month, planned at launch.",
    audience: "For people who can pay more and sponsor more of the network.",
    items: [
      "Everything in Inner Circle.",
      "Ten free friend passes.",
      "Priority early features.",
      "Optional supporter status.",
    ],
  },
];

const FAQS = [
  {
    question: "Is this pricing live now?",
    answer: "No. These are planned launch prices. Early access is free for the Founding Circle.",
  },
  {
    question: "Do invited friends ever have to pay?",
    answer: "No. Invited friends can accept, share, edit, stop sharing, and stay connected for free.",
  },
  {
    question: "What happens after five friends?",
    answer: "Your extra contacts still stay in Venn. Five active friend passes are included at launch, and friends who upgrade get their own passes without changing your connection.",
  },
  {
    question: "Why not charge per friend?",
    answer: "Because Venn works only when inviting someone feels generous. The person who wants a larger circle pays; the friend never gets a bill for being invited.",
  },
  {
    question: "What is the Founding Circle offer?",
    answer: "Waitlist members get early access free. When billing starts, founders can keep Inner Circle at $5 per month or choose $50 for the first year.",
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
            <h1 className="h-section" id="pricing-title">One subscription grows the circle.</h1>
            <p className="lead">
              Venn is planned to be inexpensive at launch. The person who wants a larger circle pays. The friends they invite are always free.
            </p>
            <a className="btn btn--primary" href="/#waitlist">
              Build your inner circle
            </a>
            <p className="pricing__note">Planned pricing at launch. Early access is free.</p>
          </div>
        </section>

        <section className="section pricing-plans" aria-labelledby="plans-title">
          <div className="wrap">
            <h2 className="h-section" id="plans-title">Simple by design.</h2>
            <div className="pricing-grid" aria-label="Pricing plans">
              {PLANS.map((plan) => (
                <article className={`pricing-card${plan.featured ? " pricing-card--featured" : ""}`} key={plan.name}>
                  <div className="pricing-card__head">
                    <h3>{plan.name}</h3>
                    {plan.featured ? <span className="badge">Planned core plan</span> : null}
                  </div>
                  <p className="pricing-card__price">
                    {plan.price}
                    <span>{plan.note}</span>
                  </p>
                  <p>{plan.audience}</p>
                  <ul>
                    {plan.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--paper pricing-promise" aria-labelledby="promise-title">
          <div className="wrap pricing-promise__grid">
            <div>
              <p className="eyebrow">The promise</p>
              <h2 className="h-section" id="promise-title">Invited friends are always free.</h2>
              <p className="lead">
                They can accept your invite, approve what they share, revoke it, and stay connected without paying. If they later want to grow their own circle, they can choose to subscribe.
              </p>
            </div>
            <div className="moment" aria-hidden="true">
              <span className="moment__text">You sponsor the circle. They choose what to share.</span>
              <span className="moment__prov">No friend is charged because you invited them.</span>
            </div>
          </div>
        </section>

        <section className="section pricing-founder" aria-labelledby="founder-title">
          <div className="wrap pricing-founder__body">
            <p className="eyebrow">Founding Circle</p>
            <h2 className="h-section" id="founder-title">Free while we build.</h2>
            <p className="lead">
              Waitlist members get early access free. When billing starts, founders can keep Inner Circle at $5 per month or choose $50 for the first year.
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
