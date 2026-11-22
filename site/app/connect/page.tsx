import type { Metadata } from "next";
import ConnectWorkflow from "@/components/ConnectWorkflow";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Connect ChatGPT · Venn",
  description: "Copy Venn's MCP server URL and connect Venn inside ChatGPT in three quick steps.",
};

export default function ConnectPage() {
  return (
    <>
      <main id="top" tabIndex={-1}>
        <SiteHeader current="/connect" />
        <section className="section section--paper connect-page" aria-labelledby="connect-title">
          <div className="wrap connect-page__wrap">
            <div className="section-intro">
              <p className="eyebrow">ChatGPT MCP setup</p>
              <h1 className="h-section" id="connect-title">
                Connect Venn to ChatGPT.
              </h1>
              <p className="lead">
                Add Venn once with Google Single Sign-On. Everything you approve in ChatGPT appears in My Venn too.
              </p>
            </div>
            <ConnectWorkflow />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
