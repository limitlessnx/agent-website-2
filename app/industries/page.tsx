import type { Metadata } from "next";
import IndustriesClient from "./IndustriesClient";

const description = "See how Fluxknight helps hotels, restaurants, clinics, real estate teams, gyms, service businesses, e-commerce brands and other organizations improve customer response, follow-up and operational capacity.";

export const metadata: Metadata = {
  title: "Industries",
  description,
  alternates: { canonical: "/industries" },
  openGraph: { type: "website", url: "/industries", title: "Industries | Fluxknight", description },
  twitter: { card: "summary_large_image", title: "Industries | Fluxknight", description },
};

export default function IndustriesPage() {
  return <IndustriesClient />;
}
