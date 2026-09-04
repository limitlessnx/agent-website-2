"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BellRing, CheckCircle2, Layers3, MessageSquareText, Network } from "@/components/admin/ServerIcons";
import { usePublicPricing } from "@/lib/use-public-pricing";

const plans = [
  {
    icon: MessageSquareText,
    name: "Basic",
    slug: "whatsapp-ai-starter",
    first: "₦100,000",
    ongoing: "₦50,000/month",
    bestFor: "Businesses that need reliable AI responses on WhatsApp or the web",
    outcome: "Faster replies and fewer enquiries waiting for staff",
    tag: "One AI customer-support channel for conversations, questions, enquiries and human handoff.",
    note: "Choose WhatsApp AI or Web AI support. Automated follow-ups and reminders start on Starter Business.",
    features: [
      "Choose WhatsApp AI or Web AI support",
      "24/7 questions and enquiries",
      "Approved product, service and FAQ responses",
      "Basic customer and lead detail capture",
      "Conversation history",
      "Human-agent handoff",
      "Basic dashboard access",
      "Base usage credits",
    ],
  },
  {
    icon: BellRing,
    name: "Starter Business",
    slug: "ai-call-receptionist",
    first: "₦200,000",
    ongoing: "₦100,000/month",
    bestFor: "Businesses that need enquiries to keep moving after the first conversation",
    outcome: "More consistent follow-up, fewer forgotten prospects and better customer continuity",
    tag: "Everything in Basic, plus automated follow-up and reminder workflows around the products or services customers enquire about.",
    note: "Starter Business adds follow-up and reminders to the selected customer-support channel.",
    features: [
      "Everything in Basic",
      "Automated customer follow-up",
      "Product or service-specific follow-up",
      "Reminder automation",
      "Follow-up timing rules",
      "Lead and customer status tracking",
      "Follow-up history",
      "Increased usage credits",
      "Human handoff with conversation context",
    ],
  },
  {
    icon: Network,
    name: "Business+",
    slug: "ai-front-desk-suite",
    first: "₦400,000",
    ongoing: "₦250,000/month",
    bestFor: "Growing businesses that need one connected customer automation system",
    outcome: "More channels working together, stronger qualification and better operational visibility",
    tag: "Everything in Starter Business, with higher limits and connected WhatsApp, web, email, CRM, scheduling and customer workflows.",
    note: "Business+ is the tier for connected systems such as the Maia real-estate automation model.",
    features: [
      "Everything in Starter Business",
      "Higher usage credits",
      "WhatsApp, Web and Email automation",
      "Automated email follow-up",
      "Multi-channel follow-up",
      "Lead qualification",
      "CRM and customer pipeline automation",
      "Scheduling and booking workflows",
      "Advanced reminders",
      "Shared dashboard and admin visibility",
      "Supported integrations",
      "Human escalation",
    ],
    featured: true,
  },
  {
    icon: Layers3,
    name: "Custom",
    slug: "custom-ai-operations",
    first: "Custom",
    ongoing: "Custom",
    bestFor: "Organizations that need automation designed around their own teams, data and operating processes",
    outcome: "A purpose-built AI operating layer across larger or more specialized operations",
    tag: "A custom AI operating system built around multiple agents, departments, databases, memberships, workflows and integrations.",
    note: "Custom scope is designed after a Business AI Evaluation.",
    features: [
      "Everything in Business+",
      "Multiple AI agents",
      "Multiple teams, departments or branches",
      "Custom databases",
      "Membership systems",
      "Customer or member portals",
      "Advanced workflow automation",
      "Custom CRM and operating workflows",
      "Custom integrations",
      "Advanced analytics",
      "Role-based staff access",
      "Workflow monitoring",
      "Managed deployment and support",
    ],
    custom: true,
  },
];

export default function PricingOutcomeClient() {
  const { prices, currency } = usePublicPricing();

  return (
    <main className="quantix-home" style={{ background: "#080311", color: "#fbf8ff" }}>
      <section style={{ padding: "145px 24px 78px", background: "radial-gradient(circle at 50% 0%,rgba(139,92,246,.2),transparent 42%),linear-gradient(180deg,#10091a 0%,#080311 100%)", borderBottom: "1px solid rgba(168,85,247,.2)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <span style={{ color: "#c084fc", fontSize: ".74rem", fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase" }}>Fluxknight pricing</span>
          <h1 style={{ margin: "14px 0 18px", fontSize: "clamp(2.3rem,6vw,4.8rem)", lineHeight: 1.02, letterSpacing: "-.055em" }}>Choose how much of the customer journey you want Fluxknight to automate.</h1>
          <p style={{ maxWidth: 720, margin: "0 auto", color: "#aa9fbd", lineHeight: 1.75 }}>Start with AI conversations, add follow-up and reminders, connect multiple customer workflows, or build a custom operating system around the organization. The first month covers installation and deployment; ongoing pricing keeps the system operating, supported and monitored.</p>
          <p aria-live="polite" style={{ margin: "15px auto 0", color: "#826f94", fontSize: ".76rem" }}>{currency ? `Prices shown in ${currency} based on your billing region.` : "Local billing currency is confirmed automatically before checkout."}</p>
        </div>
      </section>

      <section style={{ padding: "76px 24px 100px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
          {plans.map(({ icon: Icon, name, slug, first, ongoing, bestFor, outcome, tag, note, features, featured, custom }, index) => {
            const detected = prices[slug];
            const displayFirst = detected?.first ?? first;
            const displayOngoing = detected?.ongoing ?? ongoing;
            return (
              <motion.article key={name} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .4, delay: index * .05 }} style={{ display: "flex", flexDirection: "column", padding: 26, borderRadius: 20, border: featured ? "1px solid rgba(192,132,252,.52)" : "1px solid rgba(168,85,247,.2)", background: featured ? "linear-gradient(155deg,rgba(52,28,84,.98),rgba(12,7,24,.99))" : "linear-gradient(155deg,rgba(24,14,43,.97),rgba(9,5,18,.99))", boxShadow: featured ? "0 24px 70px rgba(126,34,206,.14)" : "0 18px 50px rgba(0,0,0,.24)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 12, background: "linear-gradient(145deg,#a867ff,#6330d1)" }}><Icon size={20} /></span>
                  {featured ? <span style={{ padding: "6px 9px", borderRadius: 999, border: "1px solid rgba(192,132,252,.3)", color: "#d8b4fe", fontSize: ".64rem", fontWeight: 900, letterSpacing: ".07em", textTransform: "uppercase" }}>Most complete ready-made plan</span> : null}
                </div>
                <h2 style={{ margin: "20px 0 9px", fontSize: "1.45rem", letterSpacing: "-.03em" }}>{name}</h2>
                <p style={{ margin: 0, minHeight: 72, color: "#aa9fbd", lineHeight: 1.62, fontSize: ".9rem" }}>{tag}</p>
                <div style={{ display: "grid", gap: 10, margin: "20px 0", padding: 16, borderRadius: 14, border: "1px solid rgba(168,85,247,.14)", background: "rgba(255,255,255,.025)" }}>
                  <div><span style={{ display: "block", color: "#81758f", fontSize: ".65rem", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>First month · installation + deployment</span><strong style={{ display: "block", marginTop: 4, fontSize: "1.6rem" }}>{displayFirst}</strong></div>
                  <div><span style={{ display: "block", color: "#81758f", fontSize: ".65rem", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>Then</span><strong style={{ display: "block", marginTop: 4, fontSize: "1.05rem" }}>{displayOngoing}</strong></div>
                </div>
                <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
                  <div><strong style={{ color: "#d8b4fe", fontSize: ".76rem" }}>BEST FOR</strong><p style={{ margin: "4px 0 0", color: "#c8bdd6", fontSize: ".84rem", lineHeight: 1.5 }}>{bestFor}</p></div>
                  <div><strong style={{ color: "#d8b4fe", fontSize: ".76rem" }}>EXPECTED IMPROVEMENT</strong><p style={{ margin: "4px 0 0", color: "#c8bdd6", fontSize: ".84rem", lineHeight: 1.5 }}>{outcome}</p></div>
                </div>
                <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>{features.map((feature) => <span key={feature} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#c8bdd6", fontSize: ".82rem", lineHeight: 1.4 }}><CheckCircle2 size={15} color="#c084fc" style={{ flex: "0 0 auto", marginTop: 2 }} />{feature}</span>)}</div>
                <p style={{ margin: "0 0 22px", padding: "10px 12px", borderRadius: 10, background: "rgba(168,85,247,.07)", color: "#9d8cac", fontSize: ".75rem", lineHeight: 1.55 }}>{note}</p>
                <Link href={custom ? "/evaluation" : `/checkout?plan=${encodeURIComponent(slug)}`} data-cta={`pricing-${slug}`} style={{ marginTop: "auto", minHeight: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, color: "#fff", textDecoration: "none", fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#a855f7)" }}>{custom ? "Evaluate a custom system" : "Start with this plan"} <ArrowRight size={15} /></Link>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section style={{ padding: "0 24px 110px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "34px 28px", textAlign: "center", border: "1px solid rgba(168,85,247,.22)", borderRadius: 20, background: "linear-gradient(145deg,rgba(38,20,64,.88),rgba(10,6,19,.96))" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "clamp(1.65rem,4vw,2.6rem)", letterSpacing: "-.04em" }}>Not sure which plan is right?</h2>
          <p style={{ maxWidth: 650, margin: "0 auto 24px", color: "#aa9fbd", lineHeight: 1.7 }}>You do not need to choose based on feature lists. Describe the business problem first and we will map the most useful starting point.</p>
          <Link href="/evaluation" data-cta="pricing-evaluation" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 10, color: "#fff", textDecoration: "none", fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#a855f7)" }}>Evaluate My Business <ArrowRight size={16} /></Link>
          <p style={{ margin: "20px 0 0", color: "#756a83", fontSize: ".76rem", lineHeight: 1.55 }}>Messaging-provider charges, email volume, and third-party platform fees may vary by usage and are scoped during onboarding.</p>
        </div>
      </section>
    </main>
  );
}
