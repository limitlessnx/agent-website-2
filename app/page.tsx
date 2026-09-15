"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  MessageSquareText,
  Network,
  Rocket,
  Workflow,
} from "@/components/admin/ServerIcons";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import IndustryCarousel from "@/components/IndustryCarousel";
import ClientReviews from "@/components/ClientReviews";
import PricingCarousel from "@/components/PricingCarousel";
import MaiaCaseStudyTeaser from "@/components/MaiaCaseStudyTeaser";
import ReferenceFluxHeroPhase1 from "@/components/home/ReferenceFluxHeroPhase1";

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
];

const pricingPlans = [
  {
    icon: MessageSquareText,
    slug: "basic",
    name: "Basic",
    firstMonth: "₦150,000",
    ongoing: "₦50,000/month",
    description: "One AI channel for enquiries, support, qualification, capture and human handoff.",
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
    description: "Two customer channels with automated follow-up, reminders and missed-lead recovery.",
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
    description: "Multi-channel customer operations with team controls, CRM visibility, reporting and Leo assistance.",
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
    description: "Advanced operations with structured business data, deeper workflows, integrations and dashboards.",
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
    description: "A tailored system built around your exact workflows, channels, data and automation goals.",
    features: [
      "Custom automation scope + credits",
      "Any required channel combination",
      "Custom AI agents",
      "Follow-up, reminder + ops workflows",
      "Custom integrations, databases + dashboards",
      "Internal tools + process automation",
      "Deployment, onboarding + support",
    ],
    cta: "Build a Custom Plan",
    custom: true,
  },
];

export default function HomePage() {
  return (
    <main className="quantix-home">
      <PublicLeoConsultant />

      <ReferenceFluxHeroPhase1 />

      <MaiaCaseStudyTeaser />

      <IndustryCarousel />

      <section className="brand-section" id="services">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">What Fluxknight automates</span>
            <h2>Three layers. One connected business system.</h2>
            <p>Start with customer conversations, add follow-up when you need it, then connect the wider operation as the business grows.</p>
          </div>
          <div className="brand-grid">
            {automationPillars.map(({ icon: Icon, title, text, detail }) => (
              <article className="brand-card" key={title}>
                <span className="brand-icon"><Icon size={21} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <small>{detail}</small>
                <Link href="/services">Explore capabilities <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ClientReviews />

      <section className="brand-section production-pricing-carousel" id="pricing">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Choose your automation level</span>
            <h2>Plans built for different levels of automation.</h2>
            <p>Compare channels, Flux Credits and automation depth. Swipe through each plan to see what fits.</p>
          </div>
          <PricingCarousel plans={pricingPlans} showDurationSelector />
          <div className="hero-buttons production-pricing-route-link">
            <Link className="button-secondary" href="/pricing" data-cta="pricing-details">See full pricing details <ArrowRight size={16} /></Link>
          </div>
          <p className="production-pricing-note">Basic starts with one channel. Plus adds follow-up. Business expands to multi-channel operations. Business+ adds deeper data and workflows. Custom is fully tailored.</p>
        </div>
      </section>

      <section className="brand-section evaluation-journey" id="evaluation-journey">
        <div className="brand-shell">
          <div className="evaluation-conversion-card evaluation-conversion-card--visual evaluation-conversion-card--image">
            <div className="evaluation-conversion-copy">
              <span className="brand-eyebrow">Not sure where your business fits?</span>
              <h3>Show us the workflow. We’ll identify the best place to automate first.</h3>
              <p>Tell us where enquiries get lost, where follow-up breaks down, or where your team spends too much time on repetitive work.</p>
            </div>

            <picture className="evaluation-workflow-artwork">
              <source media="(max-width: 640px)" srcSet="/evaluation-workflow-mobile.svg" />
              <Image
                src="/evaluation-workflow-desktop.svg"
                alt="Enquiries, support, follow-up, scheduling and CRM flowing into Fluxknight AI, which identifies the best place to automate first."
                width={760}
                height={680}
                sizes="(max-width: 640px) calc(100vw - 72px), (max-width: 980px) 72vw, 52vw"
              />
            </picture>

            <div className="evaluation-conversion-actions">
              <Link className="button-primary" href="/evaluation" data-cta="evaluation-final">Evaluate My Business <ArrowRight size={17} /></Link>
              <small>No package selection required before the evaluation.</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
