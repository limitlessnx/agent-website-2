import type { Metadata } from "next";
import ServicesClient from "./ServicesClient";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore Fluxknight AI systems for faster response, better lead conversion, consistent follow-up, reduced repetitive work, and connected customer operations.",
};

export default function ServicesPage() {
  return <ServicesClient />;
}
