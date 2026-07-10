import type { Metadata } from "next";
import ContactClient from "./ContactClient";
export const metadata: Metadata = { title:"Contact", description:"Book a free strategy call or send us a message. We respond within 24 hours." };
export default function ContactPage() { return <ContactClient />; }
