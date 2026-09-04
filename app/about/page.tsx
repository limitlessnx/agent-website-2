import type { Metadata } from "next";
import AboutOutcomeClient from "./AboutOutcomeClient";

const description = "How Fluxknight helps organizations respond faster, convert more opportunities, reduce repetitive work, and deploy AI automation without losing operational control.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: { type: "website", url: "/about", title: "About Fluxknight", description },
  twitter: { card: "summary_large_image", title: "About Fluxknight", description },
};

export default function AboutPage() {
  return <AboutOutcomeClient />;
}
