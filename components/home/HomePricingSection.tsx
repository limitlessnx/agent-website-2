"use client";

import Link from "next/link";
import {
  ArrowRight,
  Database,
  MessageSquareText,
  Network,
  Rocket,
  Workflow,
} from "@/components/admin/ServerIcons";
import HomePricingOverview from "@/components/home/HomePricingOverview";

const pricingPlans = [
  { icon: MessageSquareText, slug: "basic", name: "Basic", firstMonth: "₦150,000", ongoing: "₦50,000/month", description: "One AI channel for enquiries, support, qualification, capture and human handoff.", features: ["2,500 monthly Flux Credits", "1 channel: Web, WhatsApp or Voice", "24/7 enquiries and support", "FAQ, product and service answers", "Lead capture + basic qualification", "Up to 2 human handoff recipients", "Conversation history + dashboard", "No automated follow-up or reminders"], cta: "Choose Basic" },
  { icon: Workflow, slug: "plus", name: "Plus", firstMonth: "₦300,000", ongoing: "₦100,000/month", description: "Two customer channels with automated follow-up, reminders and missed-lead recovery.", features: ["5,000 monthly Flux Credits", "Everything in Basic", "Use up to 2 customer channels", "Automated follow-up + reminders", "Missed-lead recovery", "Nurture + re-engagement sequences", "Human handoff across both channels"], cta: "Choose Plus" },
  { icon: Network, slug: "business", name: "Business", firstMonth: "₦750,000", ongoing: "₦250,000/month", description: "Multi-channel customer operations with team controls, CRM visibility, reporting and Leo assistance.", features: ["12,000 monthly Flux Credits", "Everything in Plus", "Website, WhatsApp, Voice + Email workflows", "Admin workspace + team access", "Cross-channel context + CRM visibility", "Reporting + escalation controls", "Leo Admin Assistance"], cta: "Choose Business", featured: true },
  { icon: Database, slug: "business-plus", name: "Business+", firstMonth: "₦2,000,000", ongoing: "₦500,000/month", description: "Advanced operations with structured business data, deeper workflows, integrations and dashboards.", features: ["25,000+ configurable Flux Credits", "Everything in Business", "Industry or operations database", "Custom records + lifecycle history", "Advanced workflow automation", "Advanced reporting + segmentation", "Custom integrations + dashboards", "Managed deployment + support"], cta: "Choose Business+" },
  { icon: Rocket, slug: "custom", name: "Custom", firstMonth: "Custom", ongoing: "Custom", description: "A tailored system built around your exact workflows, channels, data and automation goals.", features: ["Custom automation scope + credits", "Any required channel combination", "Custom AI agents", "Follow-up, reminder + ops workflows", "Custom integrations, databases + dashboards", "Internal tools + process automation", "Deployment, onboarding + support"], cta: "Build a Custom Plan", custom: true },
];

export default function HomePricingSection() {
  return (
    <section className="brand-section production-pricing-carousel" id="pricing">
      <div className="brand-shell">
        <div className="brand-heading">
          <span className="brand-eyebrow">Choose your automation level</span>
          <h2>Plans built for different levels of automation.</h2>
          <p>Start with the level that fits your operation today, then expand as your channels, workflows and customer volume grow.</p>
        </div>
        <HomePricingOverview plans={pricingPlans} />
        <div className="hero-buttons production-pricing-route-link">
          <Link className="button-secondary" href="/pricing" data-cta="pricing-details">
            See full pricing details <ArrowRight size={16} />
          </Link>
        </div>
        <p className="production-pricing-note">Basic starts with one channel. Plus adds follow-up. Business expands to multi-channel operations. Business+ adds deeper data and workflows. Custom is fully tailored.</p>
      </div>
    </section>
  );
}
