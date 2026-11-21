"use client";

import { useEffect } from "react";

import { readCampaignParams } from "@/lib/attribution";

let sent = false;

/** Reports one page view per page load to our own /api/visit. Renders nothing. */
export default function PageView() {
  useEffect(() => {
    if (sent) return;
    sent = true;
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readCampaignParams()),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
