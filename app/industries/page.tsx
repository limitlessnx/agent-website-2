import type { Metadata } from "next";
import IndustriesClient from "./IndustriesClient";
export const metadata: Metadata = { title:"Industries", description:"AI automation for hotels, restaurants, clinics, sales companies, real estate, gyms, service businesses, auto shops, e-commerce, and professional services." };
export default function IndustriesPage() { return <IndustriesClient />; }
