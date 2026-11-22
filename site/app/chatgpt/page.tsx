import type { Metadata } from "next";
import ChatGptConnection from "@/components/ChatGptConnection";
import ChatGptPreview from "@/components/ChatGptPreview";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { PROFILE_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "ChatGPT demo · Venn",
  description: "Try a Venn reply and review a sample memory inside the ChatGPT widget.",
};

export const dynamic = "force-dynamic";

function directoryListingUrl(): string | null {
  if (!process.env.CHATGPT_PLUGIN_URL) return null;
  try {
    const url = new URL(process.env.CHATGPT_PLUGIN_URL);
    return url.origin === "https://chatgpt.com" && !url.username && !url.password
      && url.pathname.split("/").filter(Boolean).length > 1 ? url.href : null;
  } catch {
    return null;
  }
}

export default function ChatGptPage() {
  return (
    <>
      <main className="chatgpt-preview" id="top" tabIndex={-1}>
        <SiteHeader current="/chatgpt" />
        <section className="wrap chatgpt-page" id="chatgpt-ui" aria-labelledby="chatgpt-ui-title">
          <h1 className="h-section" id="chatgpt-ui-title">Venn inside ChatGPT.</h1>
          <p className="lead">Try a reply or approve a memory with sample data.</p>
          <ChatGptPreview widgetUrl={process.env.WIDGET_PREVIEW_URL ?? "https://app.joinvennai.com/widget-preview"} />
          <div className="chatgpt-preview__links" id="connect-chatgpt">
            <ChatGptConnection listingUrl={directoryListingUrl()} />
            <a className="btn" href={PROFILE_URL}>Open my Venn profile</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
