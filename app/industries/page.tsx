import type { Metadata } from "next";
import IndustriesClient from "./IndustriesClient";

export const metadata: Metadata = {
  title: "Industries",
  description: "See how Fluxknight helps hotels, restaurants, clinics, real estate teams, gyms, service businesses, e-commerce brands and other organizations improve customer response, follow-up and operational capacity.",
};

export default function IndustriesPage() {
  return <IndustriesClient />;
}
