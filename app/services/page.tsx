import type { Metadata } from "next";
import ServicesClient from "./ServicesClient";

const description = "Explore Fluxknight AI systems for faster response, better lead conversion, consistent follow-up, reduced repetitive work, and connected customer operations.";

export const metadata: Metadata = {
  title: "Services",
  description,
  alternates: { canonical: "/services" },
  openGraph: { type: "website", url: "/services", title: "Fluxknight Services", description },
  twitter: { card: "summary_large_image", title: "Fluxknight Services", description },
};

export default function ServicesPage() {
  return <ServicesClient />;
}
