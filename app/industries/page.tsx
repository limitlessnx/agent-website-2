import type { Metadata } from "next";
import IndustriesClient from "./IndustriesClient";
export const metadata: Metadata = { title:"Industries", description:"AI automation for real estate, computer sales, e-commerce, clinics, logistics, and professional services." };
export default function IndustriesPage() { return <IndustriesClient />; }
