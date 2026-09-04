import type { Metadata } from "next";
import CaseStudiesClient from "./CaseStudiesClient";

const description = "See how Fluxknight connects AI agents, websites, data, follow-up, onboarding, and human handoff in implemented systems for real estate and customer acquisition operations.";

export const metadata: Metadata = {
  title: "Case Studies",
  description,
  alternates: { canonical: "/case-studies" },
  openGraph: {
    type: "website",
    url: "/case-studies",
    title: "Fluxknight Case Studies",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Fluxknight Case Studies",
    description,
  },
};

export default function CaseStudiesPage() {
  return <CaseStudiesClient />;
}
