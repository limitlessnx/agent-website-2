import type { Metadata } from "next";
import PricingClient from "./PricingClient";

const description = "Choose the Fluxknight operating level that fits your organization: Basic, Starter, Business, or Business+, then see how scope changes for your industry, channels, usage, workflows, and integrations.";

export const metadata: Metadata = {
  title: "Pricing",
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { type: "website", url: "/pricing", title: "Pricing | Fluxknight", description },
  twitter: { card: "summary_large_image", title: "Pricing | Fluxknight", description },
};

export default function PricingPage() {
  return <PricingClient />;
}
