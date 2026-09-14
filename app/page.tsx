"use client";

import {
  Database,
  Layers3,
  MessageSquareText,
  Network,
  Rocket,
  Workflow,
} from "@/components/admin/ServerIcons";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import FluxMotionDirector from "@/components/home/FluxMotionDirector";
import FluxknightLanding from "@/components/home/FluxknightLanding";

const automationPillars = [
  {
    icon: MessageSquareText,
    title: "Customer conversations",
    text: "Handle enquiries and support across customer-facing channels, answer approved questions, capture context, and hand the right conversations to your team.",
    detail: "WhatsApp · Web support · Inquiry handling · Support desk · Human handoff",
  },
  {
    icon: Workflow,
    title: "Follow-up & customer journey",
    text: "Keep interested customers moving after the first conversation instead of relying on staff memory or manual chasing.",
    detail: "Lead qualification · Follow-up · Reminders · Scheduling · Re-engagement",
  },
  {
    icon: Database,
    title: "Connected business operations",
    text: "Connect customer activity to the systems your team uses so information, next actions, and management visibility stay organized.",
    detail: "Email automation · CRM · Databases · Admin visibility · Custom workflows",
  },
  {
    icon: Layers3,
    title: "Organization layer",
    text: "Keep customer records, owners, next actions, follow-up status, appointment status, and reminders organized around one operating view.",
    detail: "Owners · Stages · Records · Reminders · Team visibility",
  },
];

const pricingPlans = [
  {
    icon: MessageSquareText,
    slug: "basic",
    name: "Basic",
    firstMonth: "₦150,000",
    ongoing: "₦50,000/month",
    description: "One AI customer-service channel for businesses that need instant answers, enquiry handling, qualification and clean human handoff without automated follow-up.",
    features: [
      "2,500 monthly Flux Credits",
      "Choose 1 channel: Website AI, WhatsApp AI, or Voice Agent",
      "24/7 questions, enquiries and support",
      "Approved FAQ, product and service knowledge",
      "Lead or customer detail capture",
      "Basic qualification and intent capture",
      "Up to 2 human handoff recipients",
      "Conversation history and basic dashboard visibility",
      "No automated follow-up or reminder sequences",
    ],
    cta: "Choose Basic",
  },
  {
    icon: Workflow,
    slug: "plus",
    name: "Plus",
    firstMonth: "₦300,000",
    ongoing: "₦100,000/month",
    description: "Everything in Basic, with higher credits, up to two customer channels, plus automated follow-up and reminder workflows that keep enquiries moving.",
    features: [
      "5,000 monthly Flux Credits",
      "Everything in Basic",
      "Use up to 2 customer channels",
      "Examples: WhatsApp + Voice, Website + WhatsApp, or Website + Voice",
      "Automated customer follow-up",
      "Product or service-specific follow-up",
      "Appointment, booking, quote, inspection, payment or renewal reminders where relevant",
      "Missed-lead recovery",
      "Scheduled nurture and re-engagement sequences",
      "Human handoff across the selected channels",
    ],
    cta: "Choose Plus",
  },
  {
    icon: Network,
    slug: "business",
    name: "Business",
    firstMonth: "₦750,000",
    ongoing: "₦250,000/month",
    description: "A broader customer-operations system for teams that need higher usage, multiple connected channels, admin controls, cross-channel context and deeper automation.",
    features: [
      "12,000 monthly Flux Credits",
      "Everything in Plus",
      "Multi-channel customer operations",
      "Website, WhatsApp, Voice and Email workflows where applicable",
      "Admin workspace and team access",
      "Cross-channel customer context",
      "CRM and workflow visibility",
      "Reporting and operational oversight",
      "Expanded human escalation controls",
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
    description: "Everything in Business, plus the deeper operational layer needed when customer conversations must connect to structured business data, advanced workflows and integrations.",
    features: [
      "25,000+ configurable monthly Flux Credits",
      "Everything in Business",
      "Industry-specific customer or operations database",
      "Custom client, member or operational records",
      "Advanced workflow automation",
      "Deeper record history and lifecycle visibility",
      "Advanced reporting and segmentation",
      "Custom integrations where required",
      "Custom dashboards where required",
      "Managed deployment and support",
    ],
    cta: "Choose Business+",
  },
  {
    icon: Rocket,
    slug: "custom",
    name: "Custom",
    firstMonth: "Custom",
    ongoing: "Custom",
    description: "Anything the client needs automated, integrated or set up. The system is scoped around the client’s exact goals, workflows, channels, data, integrations and expected usage.",
    features: [
      "Custom automation scope",
      "Custom Flux Credit allocation",
      "Any required combination of customer channels",
      "Custom AI agents where required",
      "Custom follow-up, reminder and operational workflows",
      "Custom integrations, databases and dashboards where required",
      "Custom internal tools or process automation",
      "Deployment, onboarding and support defined around the client",
    ],
    cta: "Build a Custom Plan",
    custom: true,
  },
];

export default function HomePage() {
  return (
    <main className="quantix-home fk-strict-home">
      <FluxMotionDirector />
      <PublicLeoConsultant />
      <FluxknightLanding automationPillars={automationPillars} pricingPlans={pricingPlans} />
    </main>
  );
}
