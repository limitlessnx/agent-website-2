import type { Metadata } from "next";
import PricingOutcomeClient from "./PricingOutcomeClient";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose a focused Fluxknight starting point for faster customer response, stronger follow-up, reduced repetitive work, or connected AI front-desk operations.",
};

export default function PricingPage() {
  return <PricingOutcomeClient />;
}
