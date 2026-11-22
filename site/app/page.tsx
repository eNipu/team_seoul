import HeroBackdrop from "@/components/HeroBackdrop";
import Motion from "@/components/Motion";
import PageView from "@/components/PageView";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Waitlist from "@/components/Waitlist";
import Faq from "@/components/sections/Faq";
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
        <section className="section section--dark" id="hero" aria-labelledby="hero-title" tabIndex={-1}>
          <SiteHeader current="/" />
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Early-access waitlist</p>
              <h1 className="h-display" id="hero-title">Connect your AI memories.</h1>
              <p className="h-sub"><span>Build your inner circle.</span></p>
            </div>
            <p className="lead hero__what">
              Your ChatGPT tells you which friend, colleague or partner to talk to, from updates they choose to share.
            </p>
            <div className="hero__join">
              <HeroBackdrop />
              <div className="hero__join-card">
                <Waitlist version={version} invite={invite} />
                <p className="hero__fine">Free early access · Works with ChatGPT · Your friends opt in</p>
              </div>
            </div>
            <div className="hero__paths">
              <a className="btn" id="chatgpt-ui" href="/chatgpt">Try the ChatGPT demo</a>
              <a className="hero__guide" id="inside" href="/how-it-works">How it works</a>
            </div>
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
