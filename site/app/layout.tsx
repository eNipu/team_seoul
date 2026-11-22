import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./venn-kit.css";
import "./globals.css";

const DESCRIPTION =
  "Venn connects your AI with the AIs of people you know. They choose what to share. Join the waitlist for early access.";

export const metadata: Metadata = {
  title: "Venn: Connect your AI memories.",
  description: DESCRIPTION,
  openGraph: {
    title: "Venn: Connect your AI memories.",
    description: DESCRIPTION,
    type: "website",
    siteName: "Venn",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F8F8F8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
