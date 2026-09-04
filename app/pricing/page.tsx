import type { Metadata } from "next";
import PricingOutcomeClient from "./PricingOutcomeClient";

const description = "Choose a focused Fluxknight starting point for faster customer response, stronger follow-up, reduced repetitive work, or connected AI front-desk operations.";

export const metadata: Metadata = {
  title: "Pricing",
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { type: "website", url: "/pricing", title: "Pricing | Fluxknight", description },
  twitter: { card: "summary_large_image", title: "Pricing | Fluxknight", description },
};

export default function PricingPage() {
  return <PricingOutcomeClient />;
}
