import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./venn-kit.css";
import "./globals.css";

const TITLE = "Venn. Connect your AI memories.";
const DESCRIPTION = "Build your inner circle.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Venn",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
