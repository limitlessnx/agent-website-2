import type { Metadata } from "next";
import PricingClient from "./PricingClient";
export const metadata: Metadata = { title:"Pricing", description:"Clear AI automation packages for growing businesses. Starter, Growth, and Full Business OS." };
export default function PricingPage() { return <PricingClient />; }
