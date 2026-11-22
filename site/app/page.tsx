import HeroBackdrop from "@/components/HeroBackdrop";
import HeroRotator from "@/components/HeroRotator";
import Motion from "@/components/Motion";
import PageView from "@/components/PageView";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Waitlist from "@/components/Waitlist";
import Faq from "@/components/sections/Faq";
import OnboardingPreview from "@/components/OnboardingPreview";
import NextIn from "@/components/sections/NextIn";
import { cleanRef } from "@/lib/analytics";
import { hasDatabase } from "@/lib/db";
import { heroIndex } from "@/lib/heroes";
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
        <section className="section section--dark" id="hero" aria-labelledby="hero-title" tabIndex={-1}>
          <SiteHeader current="/" />
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Early-access waitlist</p>
              <HeroRotator pinned={heroIndex(first(params.h))} />
            </div>
            <div className="hero__join">
              <HeroBackdrop />
              <div className="hero__join-card">
                <Waitlist version={version} invite={invite} />
                <p className="hero__fine">Free early access · Works with ChatGPT · Your friends opt in</p>
              </div>
            </div>
            <div className="hero__paths">
              <a className="btn" href="#inside">Try the demo</a>
              <a className="hero__guide" href="/how-it-works">How it works</a>
            </div>
          </div>
        </section>

        <NextIn />
        <section className="section section--paper" id="inside" aria-labelledby="inside-title" tabIndex={-1}>
          <div className="wrap">
            <div className="inside__heading">
              <div>
                <h2 className="h-section" id="inside-title">One week with Venn.</h2>
                <p className="lead">Your AI drafts your week. You keep what you want. The right friend hears about it.</p>
              </div>
            </div>
            <OnboardingPreview />
          </div>
        </section>
        <Faq />
      </main>
      <SiteFooter top="#hero" />
      <PageView version={version} />
      <Motion />
    </>
  );
}
