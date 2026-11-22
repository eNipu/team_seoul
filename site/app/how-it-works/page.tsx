import type { Metadata } from "next";
import Motion from "@/components/Motion";
import OnboardingPreview from "@/components/OnboardingPreview";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import HowItWorks from "@/components/sections/HowItWorks";
import PrivacyPrinciples from "@/components/sections/PrivacyPrinciples";
import UseCases from "@/components/sections/UseCases";

export const metadata: Metadata = {
  title: "How it works · Venn",
  description: "See how approved signals reach the right person and try a week with Venn.",
};

export default function HowItWorksPage() {
  return (
    <>
      <main id="top" tabIndex={-1}>
        <SiteHeader current="/how-it-works" />
        <HowItWorks pageTitle />
        <section className="section section--paper" id="inside" aria-labelledby="inside-title" tabIndex={-1}>
          <div className="wrap">
            <div className="inside__heading">
              <div>
                <h2 className="h-section" id="inside-title">One week with Venn.</h2>
                <p className="lead">Your AI drafts your week. You keep what you want. The right friend hears about it.</p>
              </div>
              <a className="btn" href="/chatgpt">ChatGPT demo</a>
            </div>
            <OnboardingPreview />
          </div>
        </section>
        <UseCases />
        <PrivacyPrinciples />
      </main>
      <SiteFooter />
      <Motion />
    </>
  );
}
