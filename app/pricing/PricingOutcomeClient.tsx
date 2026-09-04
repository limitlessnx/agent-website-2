"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, MessageSquareText, Mic, Network, Rocket } from "@/components/admin/ServerIcons";
import { usePublicPricing } from "@/lib/use-public-pricing";

const plans = [
  { icon: MessageSquareText, name: "WhatsApp AI Starter", slug: "whatsapp-ai-starter", first: "₦100,000", ongoing: "₦50,000/month", bestFor: "Businesses that rely heavily on WhatsApp enquiries", outcome: "Faster replies, better qualification, fewer forgotten leads", tag: "A focused WhatsApp AI agent for enquiries, qualification, follow-up and human handoff.", features: ["24/7 WhatsApp AI receptionist","Approved FAQ responses","Lead qualification","Customer detail capture","Automated follow-up","Human handoff","Basic dashboard access"] },
  { icon: Mic, name: "AI Call Receptionist", slug: "ai-call-receptionist", first: "₦200,000", ongoing: "₦100,000/month", bestFor: "Businesses that cannot afford to miss inbound calls", outcome: "More calls answered, better routing, less front-desk pressure", tag: "An AI phone receptionist for answering, qualification, booking and escalation.", features: ["24/7 inbound AI calls","Approved FAQ responses","Caller qualification","Customer detail capture","Appointment booking where configured","Human escalation","Call summaries","Dashboard lead capture"] },
  { icon: Network, name: "AI Front Desk Suite", slug: "ai-front-desk-suite", first: "₦400,000", ongoing: "₦250,000/month", bestFor: "Businesses handling customers across several channels", outcome: "One connected front desk instead of fragmented conversations", tag: "WhatsApp, inbound calls and email working together as one customer operating process.", features: ["WhatsApp AI","Inbound AI call agent","Email automation","Lead qualification","Automated follow-up","Customer detail capture","Booking support","Human handoff","Shared dashboard","Basic reporting"], featured: true },
  { icon: Rocket, name: "Custom AI Operations", slug: "custom-ai-operations", first: "Custom", ongoing: "Custom", bestFor: "Organizations with multiple teams, branches or advanced workflows", outcome: "More capacity and visibility across a larger operation", tag: "A custom operating system built around multiple agents, departments, channels and integrations.", features: ["Multiple AI agents","Multiple departments or branches","Advanced workflow automation","Voice, WhatsApp and email","Custom integrations","Customer-management automation","Advanced analytics","Workflow monitoring","Managed deployment and support"], custom: true },
];

export default function PricingOutcomeClient() {
  const { prices, currency } = usePublicPricing();

  return (
    <main className="quantix-home" style={{ background: "#080311", color: "#fbf8ff" }}>
      <section style={{ padding: "145px 24px 78px", background: "radial-gradient(circle at 50% 0%,rgba(139,92,246,.2),transparent 42%),linear-gradient(180deg,#10091a 0%,#080311 100%)", borderBottom: "1px solid rgba(168,85,247,.2)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <span style={{ color: "#c084fc", fontSize: ".74rem", fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase" }}>Fluxknight pricing</span>
          <h1 style={{ margin: "14px 0 18px", fontSize: "clamp(2.3rem,6vw,4.8rem)", lineHeight: 1.02, letterSpacing: "-.055em" }}>Start with the part of your operation that needs the most leverage.</h1>
          <p style={{ maxWidth: 720, margin: "0 auto", color: "#aa9fbd", lineHeight: 1.75 }}>Choose a focused starting point or use the business evaluation if you are not sure which package fits. The first month covers installation and deployment. Ongoing pricing keeps the system operating, supported and monitored.</p>
          <p aria-live="polite" style={{ margin: "15px auto 0", color: "#826f94", fontSize: ".76rem" }}>{currency ? `Prices shown in ${currency} based on your billing region.` : "Local billing currency is confirmed automatically before checkout."}</p>
        </div>
      </section>

      <section style={{ padding: "76px 24px 100px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
          {plans.map(({ icon: Icon, name, slug, first, ongoing, bestFor, outcome, tag, features, featured, custom }, index) => {
            const detected = prices[slug];
            const displayFirst = detected?.first ?? first;
            const displayOngoing = detected?.ongoing ?? ongoing;
            return (
              <motion.article key={name} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .4, delay: index * .05 }} style={{ display: "flex", flexDirection: "column", padding: 26, borderRadius: 20, border: featured ? "1px solid rgba(192,132,252,.52)" : "1px solid rgba(168,85,247,.2)", background: featured ? "linear-gradient(155deg,rgba(52,28,84,.98),rgba(12,7,24,.99))" : "linear-gradient(155deg,rgba(24,14,43,.97),rgba(9,5,18,.99))", boxShadow: featured ? "0 24px 70px rgba(126,34,206,.14)" : "0 18px 50px rgba(0,0,0,.24)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 12, background: "linear-gradient(145deg,#a867ff,#6330d1)" }}><Icon size={20} /></span>
                  {featured ? <span style={{ padding: "6px 9px", borderRadius: 999, border: "1px solid rgba(192,132,252,.3)", color: "#d8b4fe", fontSize: ".64rem", fontWeight: 900, letterSpacing: ".07em", textTransform: "uppercase" }}>Most complete starter</span> : null}
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
                <div style={{ display: "grid", gap: 8, marginBottom: 22 }}>{features.map((feature) => <span key={feature} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#c8bdd6", fontSize: ".82rem", lineHeight: 1.4 }}><CheckCircle2 size={15} color="#c084fc" style={{ flex: "0 0 auto", marginTop: 2 }} />{feature}</span>)}</div>
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
          <p style={{ margin: "20px 0 0", color: "#756a83", fontSize: ".76rem", lineHeight: 1.55 }}>Voice usage, messaging-provider charges, email volume, and third-party platform fees may vary by usage and are scoped during onboarding.</p>
        </div>
      </section>
    </main>
  );
}
