import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Boundless Flux AI — AI Employees for Growing Businesses",
    template: "%s | Boundless Flux AI",
  },
  description:
    "We build AI sales agents, customer support systems, WhatsApp automation, voice agents, CRM workflows, and custom AI systems for real estate, retail, and service businesses.",
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
  authors: [{ name: "Boundless Flux AI" }],
  creator: "Boundless Flux AI",
  metadataBase: new URL("https://boundlessflux.ai"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://boundlessflux.ai",
    siteName: "Boundless Flux AI",
    title: "Boundless Flux AI — AI Employees for Growing Businesses",
    description:
      "We build AI sales agents, customer support systems, WhatsApp automation, voice agents, CRM workflows, and custom AI systems for growing businesses.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Boundless Flux AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boundless Flux AI — AI Employees for Growing Businesses",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
