"use client";

import PricingCarousel, { type PricingCarouselPlan } from "@/components/PricingCarousel";
import { Database, MessageSquareText, Network, Rocket, Workflow } from "@/components/admin/ServerIcons";
import type { IndustryDefinition } from "@/lib/industryCatalog";

function industryPlanDescription(industry: IndustryDefinition, key: "basic" | "starter" | "business" | "business-plus") {
  if (key === "basic") return industry.basicExample;
  if (key === "starter") return industry.starterExample;
  if (key === "business") return industry.businessExample;
  return industry.businessPlusExample;
}

export default function IndustryPricingCarousel({ industry }: { industry: IndustryDefinition }) {
  const plans: PricingCarouselPlan[] = [
    {
      icon: MessageSquareText,
      slug: "basic",
      name: "Basic",
      firstMonth: "₦150,000",
      ongoing: "₦50,000/month",
      description: industryPlanDescription(industry, "basic"),
      features: [
        "2,500 monthly Flux Credits",
        "1 channel: Web, WhatsApp or Voice",
        "24/7 enquiries and support",
        "FAQ, product and service answers",
        "Lead capture + basic qualification",
        "Up to 2 human handoff recipients",
        "Conversation history + dashboard",
        "No automated follow-up or reminders",
      ],
      cta: "Choose Basic",
    },
    {
      icon: Workflow,
      slug: "plus",
      name: "Plus",
      firstMonth: "₦300,000",
      ongoing: "₦100,000/month",
      description: industryPlanDescription(industry, "starter"),
      features: [
        "5,000 monthly Flux Credits",
        "Everything in Basic",
        "Use up to 2 customer channels",
        "Automated follow-up + reminders",
        "Missed-lead recovery",
        "Nurture + re-engagement sequences",
        "Human handoff across both channels",
      ],
      cta: "Choose Plus",
    },
    {
      icon: Network,
      slug: "business",
      name: "Business",
      firstMonth: "₦750,000",
      ongoing: "₦250,000/month",
      description: industryPlanDescription(industry, "business"),
      features: [
        "12,000 monthly Flux Credits",
        "Everything in Plus",
        "Website, WhatsApp, Voice + Email workflows",
        "Admin workspace + team access",
        "Cross-channel context + CRM visibility",
        "Reporting + escalation controls",
        "Leo Admin Assistance",
      ],
      cta: "Choose Business",
      featured: true,
    },
    {
      icon: Database,
      slug: "business-plus",
      name: "Business+",
      firstMonth: "₦2,000,000",
      ongoing: "₦500,000/month",
      description: industryPlanDescription(industry, "business-plus"),
      features: [
        "25,000+ configurable Flux Credits",
        "Everything in Business",
        "Industry or operations database",
        "Custom records + lifecycle history",
        "Advanced workflow automation",
        "Advanced reporting + segmentation",
        "Custom integrations + dashboards",
        "Managed deployment + support",
      ],
      cta: "Choose Business+",
    },
    {
      icon: Rocket,
      slug: "custom",
      name: "Custom",
      firstMonth: "Custom",
      ongoing: "Custom",
      description: `A tailored ${industry.name} automation system built around the exact workflows, channels, data and integrations the organization needs.`,
      features: [
        "Custom automation scope + credits",
        "Any required channel combination",
        "Custom AI agents",
        "Follow-up, reminder + operations workflows",
        "Custom integrations, databases + dashboards",
        "Internal tools + process automation",
        "Deployment, onboarding + support",
      ],
      cta: "Build a Custom Plan",
      custom: true,
    },
  ];

  return <PricingCarousel plans={plans} showDurationSelector />;
}
