import ChatPreview from "@/components/ChatPreview";
import HeroBackdrop from "@/components/HeroBackdrop";
import HeroCollage, { type CollageProps } from "@/components/HeroCollage";
import NextWord from "@/components/NextWord";
import PageView from "@/components/PageView";
import SiteHeader from "@/components/SiteHeader";
import Waitlist from "@/components/Waitlist";
import { cleanRef } from "@/lib/analytics";
import { hasDatabase } from "@/lib/db";
import { cleanVersion, defaultVersion } from "@/lib/version";
import { inviteHasRoom } from "@/lib/waitlist";

// Optional hero visual. Add `image: "/people/you.jpg"` to either person to show a
// portrait instead of initials, or set this to null to remove the collage.
const COLLAGE: CollageProps | null = {
  left: { name: "You", context: "Launching in Berlin" },
  right: { name: "Teodor Marin", context: "Just moved into Berlin B2B growth" },
  shared: "Berlin",
};

// "You already know your next …": the line under the headline shows these one at a time.
// Each one is a claim; keep "What the copy may claim" in site/README.md in step.
const NEXT = ["customer", "investor", "friend", "gym buddy", "travel buddy"];

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
            <h1 id="hero-title">Find the common ground.</h1>
            <NextWord words={NEXT} />
            <p className="hero__sub">
              Venn shows where you overlap, from what each of you approves, right inside ChatGPT.
            </p>
            <Waitlist version={version} invite={invite} />
            {COLLAGE && <HeroCollage {...COLLAGE} />}
          </div>
        </section>

        <section className="showcase" id="inside" aria-labelledby="inside-title">
          <div className="wrap">
            <div className="section-intro">
              <span className="eyebrow">Inside ChatGPT</span>
              <h2 id="inside-title">Two taps to common ground.</h2>
              <p>Approve what Venn may use, then see who you share ground with. Try it here.</p>
            </div>
            <ChatPreview />
            <p className="showcase__note">A preview with made-up people. Venn is in development.</p>
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
        <span>The people in the examples are made up.</span>
      </footer>
      <PageView version={version} />
    </>
  );
}
