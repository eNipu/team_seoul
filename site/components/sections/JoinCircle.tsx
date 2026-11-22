import HeroBackdrop from "@/components/HeroBackdrop";
import Waitlist from "@/components/Waitlist";
import { defaultVersion } from "@/lib/version";

// The landing page's email signup, so every page ends in the same "leave your email" step.
export default function JoinCircle({ title = "Join the Founding Circle." }: { title?: string }) {
  return (
    <section className="section join-circle" id="join" aria-labelledby="join-title">
      <div className="wrap join-circle__grid">
        <div>
          <p className="eyebrow">Early-access waitlist</p>
          <h2 className="h-section" id="join-title">{title}</h2>
          <p className="lead">Early access is free. Leave your email and we&apos;ll invite you and one person you know.</p>
        </div>
        <div className="hero__join">
          <HeroBackdrop />
          <div className="hero__join-card">
            <Waitlist version={defaultVersion()} invite={null} />
            <p className="hero__fine">Free early access · Works with ChatGPT · Your friends opt in</p>
          </div>
        </div>
      </div>
    </section>
  );
}
