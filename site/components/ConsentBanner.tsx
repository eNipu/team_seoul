"use client";

import { useEffect, useState } from "react";

import {
  CONSENT_SETTINGS_EVENT,
  consentRegion,
  defaultConsent,
  effectiveConsent,
  openConsentSettings,
  saveConsent,
  storedConsent,
  type ConsentRegion,
} from "@/lib/consent";

type BannerState = { open: boolean; region: ConsentRegion; settings: boolean };

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className ?? "footer-button"} onClick={openConsentSettings}>
      Cookie settings
    </button>
  );
}

export default function ConsentBanner() {
  const [state, setState] = useState<BannerState>({ open: false, region: "opt-in", settings: false });

  useEffect(() => {
    const region = consentRegion();
    setState({ open: !storedConsent(), region, settings: false });
    const open = () => setState((current) => ({ ...current, open: true, settings: true }));
    window.addEventListener(CONSENT_SETTINGS_EVENT, open);
    return () => window.removeEventListener(CONSENT_SETTINGS_EVENT, open);
  }, []);

  if (!state.open) return null;

  const optIn = state.region === "opt-in";
  const saved = effectiveConsent() ?? defaultConsent();

  function close(consent: { analytics: boolean; ads: boolean }) {
    saveConsent(consent);
    setState((current) => ({ ...current, open: false, settings: false }));
  }

  return (
    <section className="consent" aria-label="Cookie settings">
      <div className="consent__body">
        <p className="consent__text">
          {optIn || state.settings
            ? "Choose whether Venn can use cookies for analytics and ads."
            : "We use cookies for analytics and ads."}
        </p>
        {optIn || state.settings ? (
          <div className="consent__actions" aria-label="Consent choices">
            <button type="button" className="btn" onClick={() => close({ analytics: true, ads: true })}>
              Accept all
            </button>
            <button type="button" className="btn" onClick={() => close({ analytics: false, ads: false })}>
              Reject
            </button>
          </div>
        ) : (
          <div className="consent__actions" aria-label="Consent choices">
            <button type="button" className="btn btn--primary" onClick={() => close(saved)}>
              OK
            </button>
            <button type="button" className="btn" onClick={() => close({ analytics: false, ads: false })}>
              Do not sell or share my info
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
