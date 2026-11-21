"use client";

import { useEffect } from "react";

import { readCampaignParams } from "@/lib/attribution";
import { type WaitlistVersion } from "@/lib/version";

let sent = false;

/** Reports one page view per page load to our own /api/visit. Renders nothing. */
export default function PageView({ version }: { version: WaitlistVersion }) {
  useEffect(() => {
    if (sent) return;
    sent = true;
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...readCampaignParams(), version }),
      keepalive: true,
    }).catch(() => {});
  }, [version]);
  return null;
}
