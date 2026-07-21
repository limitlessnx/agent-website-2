import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: {
    default: "Fluxknight — AI Employees for Growing Businesses",
    template: "%s | Fluxknight",
  },
  description:
    "Fluxknight builds AI sales agents, customer support systems, WhatsApp automation, voice agents, lead generation engines, CRM workflows, and custom AI systems.",
  keywords: [
    "AI automation agency",
    "AI sales agent",
    "WhatsApp AI assistant",
    "AI voice agent",
    "CRM automation",
    "AI customer support",
    "business automation",
    "real estate AI",
  ],
  authors: [{ name: "Fluxknight" }],
  creator: "Fluxknight",
  metadataBase: new URL("https://fluxknight.ai"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://fluxknight.ai",
    siteName: "Fluxknight",
    title: "Fluxknight — AI Employees for Growing Businesses",
    description:
      "We build AI sales agents, customer support systems, WhatsApp automation, voice agents, CRM workflows, and custom AI systems for growing businesses.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fluxknight",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fluxknight — AI Employees for Growing Businesses",
    description:
      "AI sales agents, WhatsApp automation, voice agents, and CRM systems for growing businesses.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
