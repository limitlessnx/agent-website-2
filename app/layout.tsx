import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./flux-theme.css";
import "./home-responsive.css";
import "./brand-refresh.css";
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
import "./fluxknight-reference-redesign.css";
import SiteShell from "@/components/SiteShell";
import GlobalLoadingProvider from "@/components/GlobalLoadingProvider";

export const metadata: Metadata = {
  title: {
    default: "Fluxknight — AI Agents & Business Automation for Growing Companies",
    template: "%s | Fluxknight",
  },
  description:
    "Fluxknight builds AI agents and automation systems for growing businesses, including WhatsApp AI agents, customer support agents, AI voice agents, lead generation, email automation, CRM workflows, and custom multi-agent operations.",
  keywords: [
    "AI automation company", "AI automation agency", "AI automation services", "AI agents for business", "AI agents for small business", "custom AI agents for business", "AI sales agent", "AI customer service agent", "AI customer support", "WhatsApp automation for business", "WhatsApp AI agent", "WhatsApp AI assistant", "AI voice agent", "AI phone agent", "AI receptionist", "AI lead generation agent", "lead generation automation", "AI email automation", "AI appointment setting agent", "CRM automation", "AI workflow automation", "business process automation", "multi-agent AI system", "AI employees for business", "business automation", "real estate AI automation",
  ],
  authors: [{ name: "Fluxknight" }], creator: "Fluxknight", publisher: "Fluxknight",
  metadataBase: new URL("https://fluxknight.ai"), alternates: { canonical: "/" }, category: "technology",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], shortcut: "/icon.svg", apple: "/apple-icon.svg" },
  openGraph: { type: "website", locale: "en_US", url: "https://fluxknight.ai", siteName: "Fluxknight", title: "Fluxknight — AI Agents & Business Automation for Growing Companies", description: "Deploy AI sales, customer support, WhatsApp, voice, lead generation, email, CRM, and workflow automation through one connected business operating system.", images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fluxknight AI agents and business automation" }] },
  twitter: { card: "summary_large_image", title: "Fluxknight — AI Agents & Business Automation", description: "AI agents for sales, customer support, WhatsApp, voice, lead generation, email, CRM and workflow automation.", images: ["/og-image.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><GlobalLoadingProvider><SiteShell>{children}</SiteShell></GlobalLoadingProvider></body></html>;
}
