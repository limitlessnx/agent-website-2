import type { Metadata } from "next";
import ServicesClient from "./ServicesClient";

export const metadata: Metadata = {
  title: "Services",
  description:
    "AI sales agents, customer support systems, WhatsApp automation, voice agents, CRM workflows, and content systems for growing businesses.",
};

export default function ServicesPage() {
  return <ServicesClient />;
}
