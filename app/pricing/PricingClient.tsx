"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, MessageSquareText, Mic, Network, Rocket, ShieldCheck } from "lucide-react";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: .55, delay }}>{children}</motion.div>;
}

const plans = [
  {
    icon: MessageSquareText,
    name: "WhatsApp AI Starter",
    tag: "For businesses losing leads in WhatsApp conversations.",
    firstMonth: "₦100,000",
    ongoing: "₦50,000/month",
    features: ["24/7 WhatsApp AI receptionist", "Answers approved customer questions", "Lead qualification", "Customer detail capture", "Automated follow-up", "Human handoff when needed", "Basic dashboard access"],
    ideal: "Ideal for small businesses that need faster replies and consistent lead follow-up.",
    cta: "Start with WhatsApp",
  },
  {
    icon: Mic,
    name: "AI Call Receptionist",
    tag: "For businesses that cannot afford to leave inbound calls unanswered.",
    firstMonth: "₦200,000",
    ongoing: "₦100,000/month",
    features: ["24/7 inbound AI call answering", "Answers approved FAQs", "Caller and lead qualification", "Customer detail capture", "Appointment booking where configured", "Human transfer or escalation", "Call summaries", "Leads saved to dashboard"],
    ideal: "Ideal for service businesses, real estate teams, hotels, clinics, gyms and other call-heavy operations.",
    cta: "Deploy my call agent",
  },
  {
    icon: Network,
    name: "AI Front Desk Suite",
    tag: "One connected customer front desk across chat, calls and email.",
    firstMonth: "₦400,000",
    ongoing: "₦250,000/month",
    featured: true,
    features: ["WhatsApp AI receptionist", "Inbound AI call agent", "Email automation", "Lead qualification", "Automated follow-up", "Customer detail capture", "Booking support", "Human handoff", "Shared operations dashboard", "Basic reporting"],
    ideal: "Ideal for businesses ready to automate their major customer communication channels together.",
    cta: "Build my AI front desk",
  },
  {
    icon: Rocket,
    name: "Custom AI Operations",
    tag: "For organizations automating complete departments and operational processes.",
    firstMonth: "Custom",
    ongoing: "Custom",
    features: ["Multiple AI agents", "Multiple departments or branches", "Advanced workflow automation", "Voice, WhatsApp and email channels", "Custom business integrations", "Customer-management automation", "Advanced reporting and analytics", "Workflow monitoring", "Organization-wide automation", "Managed deployment and support"],
    ideal: "Ideal for established organizations that need an AI operating system designed around their own processes.",
    cta: "Request an evaluation",
  },
];

const faqs = [
  { q: "What does the first-month price cover?", a: "The first month covers setup, configuration, deployment and onboarding for the selected package. From the second month onward, the ongoing fee covers continued operation, monitoring and support within the package scope." },
  { q: "Are call minutes and third-party usage unlimited?", a: "No. Voice minutes, WhatsApp provider charges, email volume and other third-party platform costs can vary with usage. Any applicable usage allowance or external cost is confirmed during onboarding so there are no mysterious invoices wandering in later." },
  { q: "Can I upgrade after starting with WhatsApp or calls only?", a: "Yes. The starter packages are deliberately focused. A business can begin with one channel and move into the AI Front Desk Suite or a custom operations package as its automation needs grow." },
  { q: "Does AI Front Desk Suite include WhatsApp, calls and email?", a: "Yes. It combines a WhatsApp AI receptionist, inbound AI call agent and email automation with qualification, follow-up, customer capture, booking support and human handoff." },
  { q: "What is a custom package?", a: "Custom AI Operations is scoped around the organization. It can include multiple agents, departments, branches, advanced workflows, integrations, analytics and organization-wide automation beyond the fixed starter packages." },
];

export default function PricingClient() {
  return (
    <main className="quantix-home">
      <section className="brand-section" style={{ paddingTop: 150 }}>
        <div className="brand-shell">
          <motion.div className="brand-heading" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
            <span className="brand-eyebrow">Fluxknight pricing</span>
            <h1 style={{ fontSize: "clamp(2.5rem,6vw,5rem)", lineHeight: 1, letterSpacing: "-.05em", margin: "14px 0 20px" }}>Start with one problem. <span className="gradient-text">Build toward an AI-powered business.</span></h1>
            <p>Choose the level of automation your business needs today. Every fixed plan has a clear first-month deployment price and a clear ongoing service fee.</p>
          </motion.div>
        </div>
      </section>

      <section className="brand-section" style={{ paddingTop: 20 }}>
        <div className="brand-shell">
          <div className="brand-grid">
            {plans.map((plan, index) => {
              const Icon = plan.icon;
              return <FadeUp key={plan.name} delay={index * .06}>
                <article className={`brand-card ${plan.featured ? "pricing-featured" : ""}`} style={{ height: "100%" }}>
                  <span className="brand-icon"><Icon size={22} /></span>
                  {plan.featured && <span className="brand-eyebrow">Most complete starter</span>}
                  <h2 style={{ fontSize: "1.35rem", marginBottom: 8 }}>{plan.name}</h2>
                  <p>{plan.tag}</p>
                  <div style={{ display: "grid", gap: 14, margin: "24px 0", padding: "20px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                    <div><span style={{ display: "block", fontSize: 11, opacity: .65, textTransform: "uppercase", letterSpacing: ".1em" }}>First month · installation + deployment</span><strong style={{ display: "block", fontSize: 30, marginTop: 5 }}>{plan.firstMonth}</strong></div>
                    <div><span style={{ display: "block", fontSize: 11, opacity: .65, textTransform: "uppercase", letterSpacing: ".1em" }}>Consecutively</span><strong style={{ display: "block", fontSize: 19, marginTop: 5 }}>{plan.ongoing}</strong></div>
                  </div>
                  <h3 style={{ fontSize: 14, marginBottom: 12 }}>What&apos;s included</h3>
                  <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
                    {plan.features.map(feature => <span key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, lineHeight: 1.5 }}><CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />{feature}</span>)}
                  </div>
                  <p style={{ fontSize: 13, opacity: .72, marginBottom: 18 }}>{plan.ideal}</p>
                  <Link href="/evaluation">{plan.cta} <ArrowRight size={15} /></Link>
                </article>
              </FadeUp>;
            })}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-heading"><span className="brand-eyebrow">How the packages grow</span><h2>You are buying business capability, not a pile of disconnected bots.</h2><p>The packages expand from one focused communication channel into a connected front desk and, finally, organization-wide AI operations.</p></div>
          <div className="brand-grid">
            <article className="brand-card"><span className="brand-icon"><MessageSquareText size={21}/></span><h3>WhatsApp</h3><p>Answer, qualify, capture and follow up with customers where many businesses already receive enquiries.</p></article>
            <article className="brand-card"><span className="brand-icon"><Mic size={21}/></span><h3>Inbound voice</h3><p>Attend incoming calls, understand intent, capture details, summarize conversations and escalate when a human is needed.</p></article>
            <article className="brand-card"><span className="brand-icon"><Mail size={21}/></span><h3>Email</h3><p>Connect customer communication and follow-up to the same operating process instead of leaving email isolated from the rest of the customer journey.</p></article>
            <article className="brand-card"><span className="brand-icon"><ShieldCheck size={21}/></span><h3>Custom operations</h3><p>Connect agents, departments, workflows, business systems, analytics and human approvals around the way the organization actually operates.</p></article>
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell" style={{ maxWidth: 850 }}>
          <div className="brand-heading"><span className="brand-eyebrow">Pricing FAQ</span><h2>The parts worth knowing before deployment.</h2></div>
          <div style={{ display: "grid", gap: 12 }}>
            {faqs.map((faq, index) => <FadeUp key={faq.q} delay={index * .04}><article className="brand-card"><h3>{faq.q}</h3><p>{faq.a}</p></article></FadeUp>)}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="use-case-closing">
            <span className="brand-icon"><Rocket size={22}/></span>
            <h2>Not sure which level fits the business?</h2>
            <p>We map the customer journey, identify the repetitive work worth automating, and recommend the smallest system that can produce a meaningful result.</p>
            <div className="hero-buttons"><Link className="button-primary" href="/evaluation">Book a Demo <ArrowRight size={17}/></Link><Link className="button-secondary" href="/services">Explore Services</Link></div>
          </div>
          <p style={{ marginTop: 24, opacity: .65, fontSize: 13 }}>Voice usage, messaging-provider charges, email volume and third-party platform fees may vary by usage and are confirmed during onboarding.</p>
        </div>
      </section>
    </main>
  );
}
