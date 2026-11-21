import HeroBackdrop from "@/components/HeroBackdrop";
import OnboardingPreview from "@/components/OnboardingPreview";
import PageView from "@/components/PageView";
import SiteHeader from "@/components/SiteHeader";
import Waitlist from "@/components/Waitlist";
import { cleanRef } from "@/lib/analytics";
import { hasDatabase } from "@/lib/db";
import { cleanVersion, defaultVersion } from "@/lib/version";
import { inviteHasRoom } from "@/lib/waitlist";

const PRINCIPLES = [
  {
    title: "Only what you approve",
    text: "Venn saves the signals you tick and nothing else. Nothing is shared until you say so.",
  },
  {
    title: "People you already know",
    text: "No cold outreach and no strangers. Venn looks for overlap inside your own circle.",
  },
  {
    title: "You send, not Venn",
    text: "Venn drafts the intro and stops there. It never contacts anyone for you.",
  },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Someone who arrives with `?ref=` is told whether that link still holds a place for them.
// Looked up here rather than in the browser, so the form is right when it first paints.
async function inviteState(ref: string | null): Promise<"open" | "closed" | null> {
  if (!ref || !hasDatabase()) return null;
  try {
    return (await inviteHasRoom(ref)) ? "open" : "closed";
  } catch (error) {
    console.error("page: could not look up the invite link", error);
    return null;
  }
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const version = cleanVersion(first(params.w)) ?? defaultVersion();
  const invite = await inviteState(cleanRef(first(params.ref)));

  return (
    <>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <HeroBackdrop />
          <SiteHeader />
          <div className="hero__content wrap">
            <h1 id="hero-title">Venn. Connect your AI memories.</h1>
            <p className="hero__sub">Build your inner circle.</p>
            <Waitlist version={version} invite={invite} />
          </div>
        </section>

        <section className="showcase" id="inside" aria-labelledby="inside-title">
          <div className="wrap">
            <div className="section-intro">
              <h2 id="inside-title">Try the onboarding.</h2>
            </div>
            <OnboardingPreview />
          </div>
        </section>

        <section className="principles" aria-labelledby="principles-title">
          <div className="wrap">
            <h2 id="principles-title" className="sr-only">
              How Venn treats what you share
            </h2>
            <ul className="principles__grid">
              {PRINCIPLES.map((principle) => (
                <li key={principle.title} className="principle">
                  <h3>{principle.title}</h3>
                  <p>{principle.text}</p>
                </li>
              ))}
            </ul>
            <div className="closing">
              <h2>Be in the Founding Circle.</h2>
              <a className="btn btn--primary" href="#waitlist">
                Join the Waitlist
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer wrap">
        <span>© {new Date().getFullYear()} Venn</span>
      </footer>
      <PageView version={version} />
    </>
  );
}
