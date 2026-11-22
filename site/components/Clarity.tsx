"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

import { CONSENT_EVENT, effectiveConsent } from "@/lib/consent";

declare global {
  interface Window {
    clarity?: ((command: "consent") => void) & { q?: unknown[] };
  }
}

export default function Clarity() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID || "zhd6eu9vuv";
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(effectiveConsent()?.analytics === true);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (allowed && typeof window.clarity === "function") window.clarity("consent");
  }, [allowed]);

  if (!id || !/^[a-z0-9]{5,20}$/i.test(id) || !allowed) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");clarity("consent");`}
    </Script>
  );
}
