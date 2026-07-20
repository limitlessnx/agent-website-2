import type { Metadata } from "next";
import PricingClient from "./PricingClient";
export const metadata: Metadata = { title:"Pricing", description:"Naira pricing for Fluxknight AI automation packages. Starter, Growth, and Full Business OS." };
export default function PricingPage() { return <PricingClient />; }
