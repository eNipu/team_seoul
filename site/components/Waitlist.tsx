"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { readCampaignParams } from "@/lib/attribution";

type Spot = { position: number; refCode: string; referrals: number };

type State =
  | { step: "form"; busy: boolean; error: string | null }
  | { step: "joined"; spot: Spot; shareNote: string | null };

const STORAGE_KEY = "venn.waitlist";
const SHARE_TEXT = "Find the common ground. Join me on the Venn waitlist.";
// Same shape the server accepts (lib/waitlist.ts); the server still has the last word.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isSpot(value: unknown): value is Spot {
  const spot = value as Partial<Spot> | null;
  return typeof spot?.position === "number" && typeof spot.refCode === "string" && typeof spot.referrals === "number";
}

// Remembering the spot on this device lets a returning visitor see their number
// again. Only the public invite code and number are kept, never the email.
function remember(spot: Spot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spot));
  } catch {
    // Private mode or storage disabled: the confirmation still shows for this visit.
  }
}

function recall(): Spot | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return isSpot(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** The Founding Circle waitlist: one email field, then the confirmation with an invite link. */
export default function Waitlist() {
  const [state, setState] = useState<State>({ step: "form", busy: false, error: null });
  const [email, setEmail] = useState("");
  const confirmation = useRef<HTMLDivElement>(null);
  const justJoined = useRef(false);

  // A returning visitor: show their spot, then refresh it in case invites moved them up.
  useEffect(() => {
    const saved = recall();
    if (!saved) return;
    setState({ step: "joined", spot: saved, shareNote: null });
    let cancelled = false;
    fetch(`/api/waitlist?code=${encodeURIComponent(saved.refCode)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((fresh: unknown) => {
        if (cancelled || !isSpot(fresh)) return;
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
        body: JSON.stringify({ email, ...readCampaignParams() }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isSpot(body)) {
        const message = (body as { error?: unknown } | null)?.error;
        setState({
          step: "form",
          busy: false,
          error: typeof message === "string" ? message : "Something went wrong. Please try again.",
        });
        return;
      }
      remember(body);
      justJoined.current = true;
      setState({ step: "joined", spot: body, shareNote: null });
    } catch {
      setState({ step: "form", busy: false, error: "You seem to be offline. Check your connection and try again." });
    }
  }

  async function invite(spot: Spot) {
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
      note("Invite link copied. Send it to someone you'd like on Venn.");
    } catch {
      note(`Your invite link: ${url}`);
    }
  }

  if (state.step === "joined") {
    const { spot, shareNote } = state;
    return (
      <div className="waitlist" id="waitlist">
        <div className="waitlist__joined" ref={confirmation} tabIndex={-1} role="status">
          <p className="waitlist__spot">
            You&rsquo;re <strong>#{spot.position}</strong> in the Founding Circle.
          </p>
          <div className="waitlist__actions">
            <button type="button" className="btn btn--primary" onClick={() => invite(spot)}>
              Invite a connection to move up
            </button>
            <a className="btn" href="#inside">
              See it inside ChatGPT
            </a>
          </div>
          <p className="waitlist__note" aria-live="polite">
            {shareNote ??
              (spot.referrals > 0
                ? `${spot.referrals} ${spot.referrals === 1 ? "person has" : "people have"} joined with your link.`
                : "Everyone who joins with your link moves you up the list.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist" id="waitlist">
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
            {state.busy ? "Joining…" : "Join the Waitlist"}
          </button>
        </div>
        <p
          id="waitlist-note"
          className={`waitlist__note${state.error ? " waitlist__note--error" : ""}`}
          role={state.error ? "alert" : undefined}
        >
          {state.error ?? "Founding Circle. We only email you about your invite."}
        </p>
      </form>
    </div>
  );
}
