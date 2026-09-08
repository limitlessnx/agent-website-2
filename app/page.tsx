"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  MessageSquareText,
  Network,
  Rocket,
  Sparkles,
  Workflow,
} from "@/components/admin/ServerIcons";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import IndustryCarousel from "@/components/IndustryCarousel";
import ClientReviews from "@/components/ClientReviews";
import PricingCarousel from "@/components/PricingCarousel";
import MaiaCaseStudyTeaser from "@/components/MaiaCaseStudyTeaser";

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
    firstMonth: "₦100,000",
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
    firstMonth: "₦200,000",
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
    firstMonth: "₦400,000",
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
    icon: Rocket,
    slug: "business-plus",
    name: "Custom",
    firstMonth: "Custom",
    ongoing: "Custom",
    description: "A fully custom Fluxknight deployment built around the client’s exact goals, channels, workflows, integrations, data requirements and expected usage.",
    features: [
      "Custom Flux Credit allocation",
      "Custom number and combination of customer channels",
      "Custom AI agents where required",
      "Custom follow-up, reminder and operational workflows",
      "Custom integrations, databases or dashboards where required",
      "Scope, deployment and support defined around the client’s requirements",
    ],
    cta: "Build a Custom Plan",
    custom: true,
  },
];

export default function HomePage() {
  return (
    <main className="quantix-home">
      <PublicLeoConsultant />

      <section className="quantix-hero production-animated-hero outcome-first-hero">
        <div className="hero-stars" />
        <div className="violet-arc" />
        <div className="hero-haze" />
        <motion.div className="hero-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
          <div className="hero-pill" style={{ position: "relative", zIndex: 4, maxWidth: "min(100%, 520px)", justifyContent: "center", lineHeight: 1.25, background: "rgba(17,8,31,.88)", borderColor: "rgba(207,170,255,.3)", backdropFilter: "blur(14px)", boxShadow: "0 12px 34px rgba(19,5,42,.28), inset 0 1px rgba(255,255,255,.035)" }}><Sparkles size={13} /> AI automation that drives real business outcomes</div>
          <h1>Grow your organization <span>without growing the workload.</span></h1>
          <p>Fluxknight builds AI systems that handle customer conversations and the work that follows, from enquiry and support to follow-up, scheduling, CRM updates, and human handoff.</p>
          <div className="hero-buttons">
            <Link className="button-primary" href="/evaluation" data-cta="hero-evaluation">Evaluate My Business <ArrowRight size={17} /></Link>
            <Link className="button-secondary" href="#services" data-cta="hero-services">See What We Automate <ArrowRight size={16} /></Link>
          </div>
          <div className="hero-proof-row" aria-label="Fluxknight operating principles">
            <span><CheckCircle2 size={14} /> Works 24/7</span>
            <span><CheckCircle2 size={14} /> Built around your workflow</span>
            <span><CheckCircle2 size={14} /> Human handoff stays available</span>
          </div>
        </motion.div>
        <motion.div className="product-shot outcome-product-shot" initial={{ opacity: 0, y: 42, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .9, delay: .25 }}>
          <div className="outcome-dashboard-label"><span>Business impact, live</span><strong>Customer operations</strong></div>
          <img src="/flux-dashboard.svg" alt="Fluxknight customer operations dashboard showing conversations, leads, bookings and business activity" />
        </motion.div>
      </section>

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
            <h2>Basic. Plus. Business. Custom.</h2>
            <p>Choose the number of channels and automation depth your organization needs. Basic, Plus and Business have defined scopes and can continue to checkout. Custom is designed around the client’s specific requirements.</p>
          </div>
          <PricingCarousel plans={pricingPlans} compact showDurationSelector />
          <div className="hero-buttons production-pricing-route-link">
            <Link className="button-secondary" href="/pricing" data-cta="pricing-details">See full pricing &amp; package details <ArrowRight size={16} /></Link>
          </div>
          <p className="production-pricing-note">Basic supports one customer channel. Plus supports up to two channels with higher credits and follow-up automation. Business expands into connected customer operations. Custom is scoped entirely around the client.</p>
        </div>
      </section>

      <section className="brand-section evaluation-journey" id="evaluation-journey">
        <div className="brand-shell">
          <div className="evaluation-conversion-card">
            <div>
              <span className="brand-eyebrow">Not sure where your business fits?</span>
              <h3>Show us the workflow. We’ll identify the best place to automate first.</h3>
              <p>Tell us where enquiries get lost, where follow-up breaks down, or where your team spends too much time on repetitive work.</p>
            </div>
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
