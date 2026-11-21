import HeroBackdrop from "@/components/HeroBackdrop";
import Motion from "@/components/Motion";
import OnboardingPreview from "@/components/OnboardingPreview";
import PageView from "@/components/PageView";
import SiteHeader from "@/components/SiteHeader";
import Waitlist from "@/components/Waitlist";
import Faq from "@/components/sections/Faq";
import HowItWorks from "@/components/sections/HowItWorks";
import Moment from "@/components/sections/Moment";
import PrivacyPrinciples from "@/components/sections/PrivacyPrinciples";
import UseCases from "@/components/sections/UseCases";
import { cleanRef } from "@/lib/analytics";
import { hasDatabase } from "@/lib/db";
import { cleanVersion, defaultVersion } from "@/lib/version";
import { inviteHasRoom } from "@/lib/waitlist";


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
        <section className="section section--dark" id="hero" aria-labelledby="hero-title">
          <SiteHeader />
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Early-access waitlist</p>
              <h1 className="h-display" id="hero-title">Connect your AI memories.</h1>
              <p className="h-sub"><span>Build your inner circle.</span></p>
              <p className="lead hero__what">
                Your ChatGPT tells you which friend, colleague or partner to talk to, from updates they choose to share.
              </p>
              <div className="chat hero__chat" aria-label="Example inside ChatGPT">
                <p className="chat__user">I have no plans this weekend. Ideas?</p>
                <Moment person="Emma" text="Emma from uni is in Berlin on Saturday. You haven't seen her in 2 years." yellow />
              </div>
            </div>
            {/* The join panel, with the 3D circles behind it: beside the copy on a wide screen. */}
            <div className="hero__join">
              <HeroBackdrop />
              <div className="hero__join-card">
                <Waitlist version={version} invite={invite} />
                <p className="hero__fine">Free early access · Works with ChatGPT · Your friends opt in</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--dark manifesto" aria-labelledby="manifesto-title">
          <div className="wrap" data-reveal="group">
            <h2 className="h-display" id="manifesto-title">
              Connecting is solved.<br />
              <span className="manifesto__hit">Keeping relationships is not.</span>
            </h2>
            <p className="lead">
              You meet people at every conference, every trip, every job. Then life happens and you lose them. Venn makes sure
              you don&apos;t forget the people you connected with.
            </p>
          </div>
        </section>

        <HowItWorks />
        <UseCases />

        <section className="section section--paper" id="inside" aria-labelledby="inside-title">
          <div className="wrap">
            <h2 className="h-section" id="inside-title" data-reveal="up">One week with Venn.</h2>
            <p className="lead" data-reveal="up">Your AI drafts your week. You keep what you want. The right friend hears about it.</p>
            <div data-reveal="up">
              <OnboardingPreview />
            </div>
          </div>
        </section>

        <PrivacyPrinciples />
        <Faq />

        <section className="section" id="early-access" aria-labelledby="closing-title">
          <div className="closing wrap" data-reveal="group">
            <img
              className="mark mark--faces"
              src="/brand/mark-faces-circle.webp"
              width={665}
              height={700}
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
            <h2 className="h-section" id="closing-title">Join the Founding Circle.</h2>
            <p className="lead">Early access opens by invitation. Get on the list.</p>
            <a className="btn btn--primary" href="#waitlist">
              Build your inner circle.
            </a>
          </div>
        </section>
      </main>

      <footer className="wrap">
        <span>© {new Date().getFullYear()} Venn · <a href="/privacy">Privacy</a></span>
        <p>The people in the examples are made up.</p>
      </footer>
      <PageView version={version} />
      <Motion />
    </>
  );
}
