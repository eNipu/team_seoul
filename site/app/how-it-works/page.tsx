import type { Metadata } from "next";
import Motion from "@/components/Motion";
import ConnectionWalkthrough from "@/components/ConnectionWalkthrough";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import HowItWorks from "@/components/sections/HowItWorks";
import PrivacyPrinciples from "@/components/sections/PrivacyPrinciples";
import UseCases from "@/components/sections/UseCases";
import JoinCircle from "@/components/sections/JoinCircle";

export const metadata: Metadata = {
  title: "How it works · Venn",
  description: "See how approved signals reach the right person and try connecting with a friend.",
};

export const dynamic = "force-dynamic";

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
                <h2 className="h-section" id="inside-title">Try connecting with a friend.</h2>
                <p className="lead">Choose sample memories, preview an invite, and see what you and Maya have in common.</p>
              </div>
            </div>
            <ConnectionWalkthrough />
          </div>
        </section>
        <UseCases />
        <PrivacyPrinciples />
        <JoinCircle />
      </main>
      <SiteFooter />
      <Motion />
    </>
  );
}
