import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Privacy · Venn", description: "How Venn handles your data." };

export default function Privacy() {
  return (
    <main className="section section--paper">
      <SiteHeader />
      <div className="wrap legal">
        <h1 className="h-section">Privacy</h1>
        <p className="lead">Short version: we keep the minimum, we never sell it, and you can delete it anytime.</p>
        <h2>What we collect</h2>
        <p>For the waitlist: your email address, and optionally your name and the answer you pick in our sign-up form. We also record which ad or link brought you (UTM tags) so we know which messages work.</p>
        <h2>What we do with it</h2>
        <p>We use your email to send your early-access invite and occasional product updates about Venn. We do not sell or rent your data, and we do not share it with anyone except the service providers that host this site and send our emails.</p>
        <h2>Ads and measurement</h2>
        <p>If you arrive from Meta (Facebook or Instagram) ads, Meta may receive standard events such as a page view or a sign-up, so we can measure our ads. Sign-ups made in a Meta lead form are shared with us by Meta under Meta&apos;s terms.</p>
        <h2>The product</h2>
        <p>Venn only ever uses signals you approve. It does not read your chats or your ChatGPT memory, and nothing is shared with anyone until you choose to share it.</p>
        <h2>Your choices</h2>
        <p>Unsubscribe from any email with one click, or write to us to see, correct or delete your data. We delete waitlist data when Venn launches or when you ask, whichever comes first.</p>
        <h2>Contact</h2>
        <p>Questions or deletion requests: reply to any Venn email, or contact us through the Venn AI Facebook Page.</p>
        <p className="muted">Last updated: 22 November 2026.</p>
      </div>
    </main>
  );
}
