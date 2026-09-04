import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./flux-theme.css";
import "./home-responsive.css";
import "./brand-refresh.css";
import "./production-home-enhancements.css";
import "./checkout-mobile-fix.css";
import "./dashboard-light-fix.css";
import "./fluxknight-unified-colors.css";
import "./ui-balance-fix.css";
import "./dashboard-responsive-v2.css";
import "./followup-control.css";
import "./dashboard-visual-system.css";
import "./campaign-console.css";
import "./mobile-dashboard-fixes.css";
import "./limitless-recipient-ui.css";
import "./public-color-unification.css";
import "./homepage-phase7.css";
import SiteShell from "@/components/SiteShell";
import GlobalLoadingProvider from "@/components/GlobalLoadingProvider";

export const metadata: Metadata = {
  title: {
    default: "Fluxknight — Grow Your Organization Without Growing the Workload",
    template: "%s | Fluxknight",
  },
  description:
    "Fluxknight helps organizations respond faster, convert more enquiries, reduce repetitive work, and keep customer operations moving with connected AI communication, follow-up, voice, WhatsApp, CRM, and workflow automation.",
  keywords: [
    "AI automation company", "AI automation agency", "AI automation services", "AI agents for business", "AI agents for small business", "custom AI agents for business", "AI sales agent", "AI customer service agent", "AI customer support", "WhatsApp automation for business", "WhatsApp AI agent", "WhatsApp AI assistant", "AI voice agent", "AI phone agent", "AI receptionist", "AI lead generation agent", "lead generation automation", "AI email automation", "AI appointment setting agent", "CRM automation", "AI workflow automation", "business process automation", "multi-agent AI system", "AI employees for business", "business automation", "real estate AI automation",
  ],
  authors: [{ name: "Fluxknight" }], creator: "Fluxknight", publisher: "Fluxknight",
  metadataBase: new URL("https://fluxknight.ai"), alternates: { canonical: "/" }, category: "technology",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], shortcut: "/icon.svg", apple: "/apple-icon.svg" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://fluxknight.ai",
    siteName: "Fluxknight",
    title: "Grow Your Organization Without Growing the Workload | Fluxknight",
    description: "Respond faster, convert more opportunities, reduce repetitive work, and keep customer operations moving with connected AI automation.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fluxknight business automation for faster response, stronger conversion, and less repetitive work" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grow Your Organization Without Growing the Workload | Fluxknight",
    description: "Respond faster, convert more opportunities, reduce repetitive work, and keep customer operations moving with connected AI automation.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><GlobalLoadingProvider><SiteShell>{children}</SiteShell></GlobalLoadingProvider></body></html>;
}
