"use client";

import Link from "next/link";
import { ArrowRight, MessageSquareText, Mic, Network, Rocket } from "@/components/admin/ServerIcons";
import PricingCarousel from "@/components/PricingCarousel";

const plans = [
  {
    icon: MessageSquareText,
    name: "WhatsApp AI Starter",
    slug: "whatsapp-ai-starter",
    first: "₦100,000",
    ongoing: "₦50,000/month",
    tag: "One focused AI receptionist for WhatsApp.",
    features: ["24/7 WhatsApp AI receptionist", "Answers approved customer questions", "Lead qualification", "Customer detail capture", "Automated follow-up", "Human handoff when needed", "Basic dashboard access"],
  },
  {
    icon: Mic,
    name: "AI Call Receptionist",
    slug: "ai-call-receptionist",
    first: "₦200,000",
    ongoing: "₦100,000/month",
    tag: "An inbound AI receptionist that never leaves the phone unattended.",
    features: ["24/7 inbound AI call answering", "Answers approved FAQs", "Caller qualification", "Customer detail capture", "Appointment booking where configured", "Human transfer or escalation", "Call summaries", "Leads saved to dashboard"],
  },
  {
    icon: Network,
    name: "AI Front Desk Suite",
    slug: "ai-front-desk-suite",
    first: "₦400,000",
    ongoing: "₦250,000/month",
    tag: "WhatsApp, inbound calls and email working as one customer front desk.",
    features: ["WhatsApp AI", "Inbound AI call agent", "Email automation", "Lead qualification", "Automated follow-up", "Customer detail capture", "Booking support", "Human handoff", "Shared dashboard", "Basic reporting"],
    featured: true,
  },
  {
    icon: Rocket,
    name: "Custom AI Operations",
    slug: "custom-ai-operations",
    first: "Custom",
    ongoing: "Custom",
    tag: "Organization-wide automation built around your actual operations.",
    features: ["Multiple AI agents", "Multiple departments and branches", "Advanced workflows", "Voice, WhatsApp and email channels", "Custom business integrations", "Customer-management automation", "Reporting and analytics", "Workflow monitoring", "Managed organization-wide automation"],
    custom: true,
  },
];

export default function PricingClient() {
  return (
    <main className="quantix-home pricing-page-redesign">
      <section className="brand-section pricing-page-hero">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Fluxknight Pricing</span>
            <h1>Start with the AI your business needs today.</h1>
            <p>Your first month covers installation, configuration, deployment and service. From the second month onward, the consecutive fee keeps the system operating, monitored and supported.</p>
          </div>
        </div>
      </section>

      <section className="brand-section pricing-page-carousel">
        <PricingCarousel plans={plans} />
        <div className="brand-shell">
          <div className="use-case-closing pricing-custom-cta">
            <h2>Need more than a front desk?</h2>
            <p>Custom AI Operations is scoped around your departments, workflows, integrations and customer journey. We map what should be automated before proposing the system, instead of selling you a pile of features your team will never use.</p>
            <div className="hero-buttons">
              <Link className="button-primary" href="/evaluation">Business AI Evaluation <ArrowRight size={17} /></Link>
              <Link className="button-secondary" href="/">Back to Home</Link>
            </div>
          </div>
          <p className="pricing-usage-note">Voice usage, messaging-provider charges, email volume, and third-party platform fees may vary according to usage and provider pricing. These are confirmed during onboarding.</p>
        </div>
      </section>
    </main>
  );
}
