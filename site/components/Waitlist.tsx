"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { readCampaignParams } from "@/lib/attribution";
import { type WaitlistVersion } from "@/lib/version";

type Spot = {
  position: number;
  refCode: string;
  referrals: number;
  status: "pending" | "confirmed";
  version: WaitlistVersion;
  circle: number;
  invitesLeft: number;
};

type State =
  | { step: "form"; busy: boolean; error: string | null }
  | { step: "joined"; spot: Spot; shareNote: string | null };

type Props = {
  /** Which waitlist this page shows: see docs/tasks/WAITLIST.md. */
  version: WaitlistVersion;
  /** The visitor came with an invite link that has room ("open") or has none ("closed"). */
  invite: "open" | "closed" | null;
};

const STORAGE_KEY = "venn.waitlist";
const SHARE_TEXT = "I saved you a place on the Venn waitlist.";
// Same shape the server accepts (lib/waitlist.ts); the server still has the last word.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Reads a spot from the server or from this device. A spot remembered before the waitlist
// had pairs has only the first three fields; it reads as the open version until refreshed.
function readSpot(value: unknown): Spot | null {
  const spot = value as Partial<Spot> | null;
  if (typeof spot?.position !== "number" || typeof spot.refCode !== "string" || typeof spot.referrals !== "number") {
    return null;
  }
  return {
    position: spot.position,
    refCode: spot.refCode,
    referrals: spot.referrals,
    status: spot.status === "pending" ? "pending" : "confirmed",
    version: spot.version === "pair" ? "pair" : "open",
    circle: typeof spot.circle === "number" ? spot.circle : 1,
    invitesLeft: typeof spot.invitesLeft === "number" ? spot.invitesLeft : 0,
  };
}

// Remembering the spot on this device lets a returning visitor see it again.
// Only the public invite code and the counts are kept, never the email.
function remember(spot: Spot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spot));
  } catch {
    // Private mode or storage disabled: the confirmation still shows for this visit.
  }
}

function recall(): Spot | null {
  try {
    return readSpot(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

function circleCaption({ circle, invitesLeft }: Spot): string {
  if (invitesLeft === 0) return `${circle} in your circle. Your circle is full for now.`;
  return `${circle} in your circle. ${invitesLeft} ${invitesLeft === 1 ? "invite" : "invites"} left.`;
}

function formNote(version: WaitlistVersion, invite: Props["invite"]): string {
  if (invite === "open") return "No +1 needed. We only email you about your invite.";
  if (version === "pair") return "You join with one person you know. We only email you about your invite.";
  return "Founding Circle. We only email you about your invite.";
}

/** The Founding Circle waitlist: one email field, then the confirmation with an invite link. */
export default function Waitlist({ version, invite }: Props) {
  const [state, setState] = useState<State>({ step: "form", busy: false, error: null });
  const [email, setEmail] = useState("");
  const confirmation = useRef<HTMLDivElement>(null);
  const justJoined = useRef(false);

  // A returning visitor: show their spot, then refresh it in case their +1 has joined.
  useEffect(() => {
    const saved = recall();
    if (!saved) return;
    setState({ step: "joined", spot: saved, shareNote: null });
    let cancelled = false;
    fetch(`/api/waitlist?code=${encodeURIComponent(saved.refCode)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        const fresh = readSpot(body);
        if (cancelled || !fresh) return;
        remember(fresh);
        setState((current) => (current.step === "joined" ? { ...current, spot: fresh } : current));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the confirmation after a submit, so screen readers announce it.
  useEffect(() => {
    if (state.step === "joined" && justJoined.current) {
      justJoined.current = false;
      confirmation.current?.focus({ preventScroll: true });
    }
  }, [state.step]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.step !== "form" || state.busy) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setState({ step: "form", busy: false, error: "Enter a valid email address." });
      return;
    }
    setState({ step: "form", busy: true, error: null });
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, version, ...readCampaignParams() }),
      });
      const body: unknown = await response.json().catch(() => null);
      const spot = response.ok ? readSpot(body) : null;
      if (!spot) {
        const message = (body as { error?: unknown } | null)?.error;
        setState({
          step: "form",
          busy: false,
          error: typeof message === "string" ? message : "Something went wrong. Please try again.",
        });
        return;
      }
      remember(spot);
      justJoined.current = true;
      setState({ step: "joined", spot, shareNote: null });
    } catch {
      setState({ step: "form", busy: false, error: "You seem to be offline. Check your connection and try again." });
    }
  }

  async function share(spot: Spot) {
    const url = `${window.location.origin}/?ref=${spot.refCode}`;
    const note = (shareNote: string) =>
      setState((current) => (current.step === "joined" ? { ...current, shareNote } : current));
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Venn", text: SHARE_TEXT, url });
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return; // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      note(`Invite link copied. Send it to ${spot.status === "pending" ? "one person" : "someone"} you'd like on Venn.`);
    } catch {
      note(`Your invite link: ${url}`);
    }
  }

  if (state.step === "joined" && state.spot.version === "open") {
    const { spot, shareNote } = state;
    return (
      <div className="waitlist" id="waitlist">
        <div className="waitlist__joined" ref={confirmation} tabIndex={-1} role="status">
          <p className="waitlist__spot">
            You&rsquo;re <strong>#{spot.position}</strong> in the Founding Circle.
          </p>
          <div className="waitlist__actions">
            <button type="button" className="btn btn--primary" onClick={() => share(spot)}>
              Invite a connection to move up
            </button>
            <a className="btn" href="#inside">
              See how it works
            </a>
          </div>
          <p className="waitlist__note" aria-live="polite">
            {shareNote ??
              (spot.referrals > 0
                ? `${spot.referrals} ${spot.referrals === 1 ? "person has" : "people have"} joined with your link.`
                : null)}
          </p>
        </div>
      </div>
    );
  }

  if (state.step === "joined") {
    const { spot, shareNote } = state;
    const pending = spot.status === "pending";
    return (
      <div className="waitlist" id="waitlist">
        <div className="waitlist__joined" ref={confirmation} tabIndex={-1} role="status">
          <p className="waitlist__spot">{pending ? "Good things come in pairs." : "You\u2019re both in."}</p>
          <p className="waitlist__text">
            {pending
              ? "Your place is held. It is confirmed when one person you know joins with your link."
              : "Your places in the Founding Circle are confirmed."}
          </p>
          {!pending && (
            // Decorative: the caption below says the same in words.
            <div className="waitlist__circle" aria-hidden="true">
              {Array.from({ length: spot.circle + spot.invitesLeft }, (_, seat) => (
                <span
                  key={seat}
                  className={`avatar avatar--small ${seat < spot.circle ? "avatar--you" : "waitlist__seat"}`}
                />
              ))}
            </div>
          )}
          <div className="waitlist__actions">
            <button type="button" className="btn btn--primary" onClick={() => share(spot)}>
              Share my invite link
            </button>
            <a className="btn" href="#inside">
              See how it works
            </a>
          </div>
          <p className="waitlist__note" aria-live="polite">
            {shareNote ?? (pending ? "One link. A confirmed place for both of you." : circleCaption(spot))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist" id="waitlist">
      {invite === "open" && (
        <div className="waitlist__invite">
          <p className="waitlist__spot">Someone saved you a place.</p>
          <p className="waitlist__text">Joining confirms a place for both of you.</p>
        </div>
      )}
      {invite === "closed" && (
        <p className="waitlist__invite waitlist__text">That invite link is no longer open. You can still join.</p>
      )}
      <form className="waitlist__form" onSubmit={submit} noValidate>
        <div className={`waitlist__field${state.error ? " waitlist__field--invalid" : ""}`}>
          <label className="sr-only" htmlFor="waitlist-email">
            Email address
          </label>
          <input
            id="waitlist-email"
            className="waitlist__input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Email address"
            required
            maxLength={254}
            value={email}
            disabled={state.busy}
            aria-invalid={state.error ? true : undefined}
            aria-describedby="waitlist-note"
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="btn btn--primary waitlist__submit" disabled={state.busy}>
            {state.busy ? "Joining…" : invite === "open" ? "Accept the invite" : "Build your inner circle"}
          </button>
        </div>
        <p
          id="waitlist-note"
          className={`waitlist__note${state.error ? " waitlist__note--error" : ""}`}
          role={state.error ? "alert" : undefined}
        >
          {state.error ?? formNote(version, invite)}
        </p>
      </form>
    </div>
  );
}
