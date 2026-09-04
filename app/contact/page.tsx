import type { Metadata } from "next";
import ContactClient from "./ContactClient";

const description = "Contact Fluxknight about a business automation requirement, or describe the operational problem you want evaluated before deciding what to build.";

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "/contact", title: "Contact Fluxknight", description },
  twitter: { card: "summary_large_image", title: "Contact Fluxknight", description },
};

export default function ContactPage() {
  return <ContactClient />;
}
