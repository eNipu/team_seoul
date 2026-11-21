import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./venn-kit.css";
import "./globals.css";

const DESCRIPTION =
  "Your AI knows what you're building. Venn quietly surfaces the exact overlap with the people you already know, right inside ChatGPT.";

export const metadata: Metadata = {
  title: "Venn: Find the common ground.",
  description: DESCRIPTION,
  openGraph: {
    title: "Venn: Find the common ground.",
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
