import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing | Fluxknight",
  description: "Fluxknight AI pricing for WhatsApp AI, inbound call agents, AI front desk automation, and custom AI operations systems.",
};

export default function PricingPage() {
  return <PricingClient />;
}
