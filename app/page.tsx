"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Database, MessageSquareText, Network, Workflow } from "@/components/admin/ServerIcons";
import ClientReviews from "@/components/ClientReviews";
import FluxProductVisuals from "@/components/home/FluxProductVisuals";
import IndustryCarousel from "@/components/IndustryCarousel";
import PricingCarousel from "@/components/PricingCarousel";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import styles from "./page.module.css";

const automationPillars = [
  { icon: MessageSquareText, title: "Customer conversations", heading: "One conversation system across every customer channel.", text: "Handle enquiries and support across customer-facing channels, answer approved questions, capture context, and hand the right conversations to your team.", detail: ["WhatsApp", "Web support", "Enquiry handling", "Support desk", "Human handoff", "Voice where applicable"], visual: "conversations" as const },
  { icon: Workflow, title: "Follow-up and customer journey", heading: "Keep every opportunity moving.", text: "Keep interested customers moving after the first conversation instead of relying on staff memory or manual chasing.", detail: ["Lead qualification", "Follow-up", "Reminders", "Scheduling", "Re-engagement", "Missed-lead recovery"], visual: "journey" as const },
  { icon: Database, title: "Connected business operations", heading: "Connect the conversation to the work that follows.", text: "Connect customer activity to the systems your team uses so information, next actions, and management visibility stay organized.", detail: ["CRM and databases", "Email automation", "Admin visibility", "Custom workflows", "Human escalation", "Content scheduling when relevant"], visual: "operations" as const },
];

const proofPoints = [
  { icon: MessageSquareText, title: "Faster response", text: "Help customers while intent is still high." },
  { icon: Workflow, title: "Stronger follow-up", text: "Keep next steps moving without memory gaps." },
  { icon: Network, title: "Connected operations", text: "Carry context from the conversation into the work." },
  { icon: Database, title: "More staff capacity", text: "Move routine coordination into the background." },
];

const processSteps = [
  ["Capture", "Receive enquiries, requests, and customer context across the channels your business uses."],
  ["Understand", "Apply approved information and business rules to identify what the customer needs."],
  ["Act", "Reply, qualify, schedule, follow up, or trigger the next agreed workflow."],
  ["Coordinate", "Update the right record and bring in the right person when a human is needed."],
  ["Improve", "Give your team clearer visibility into the journeys that need attention."],
];

const pricingPlans = [
  { icon: MessageSquareText, slug: "basic", name: "Basic", firstMonth: "\u20A6150,000", ongoing: "\u20A650,000/month", description: "One AI customer-service channel for businesses that need instant answers, enquiry handling, qualification and clean human handoff without automated follow-up.", features: ["2,500 monthly Flux Credits", "Choose 1 channel: Website AI, WhatsApp AI, or Voice Agent", "24/7 questions, enquiries and support", "Approved FAQ, product and service knowledge", "Lead or customer detail capture", "Basic qualification and intent capture", "Up to 2 human handoff recipients", "Conversation history and basic dashboard visibility", "No automated follow-up or reminder sequences"], cta: "Choose Basic" },
  { icon: Workflow, slug: "plus", name: "Plus", firstMonth: "\u20A6300,000", ongoing: "\u20A6100,000/month", description: "Everything in Basic, with higher credits, up to two customer channels, plus automated follow-up and reminder workflows that keep enquiries moving.", features: ["5,000 monthly Flux Credits", "Everything in Basic", "Use up to 2 customer channels", "Examples: WhatsApp + Voice, Website + WhatsApp, or Website + Voice", "Automated customer follow-up", "Product or service-specific follow-up", "Appointment, booking, quote, inspection, payment or renewal reminders where relevant", "Missed-lead recovery", "Scheduled nurture and re-engagement sequences", "Human handoff across the selected channels"], cta: "Choose Plus" },
  { icon: Network, slug: "business", name: "Business", firstMonth: "\u20A6750,000", ongoing: "\u20A6250,000/month", description: "A broader customer-operations system for teams that need higher usage, multiple connected channels, admin controls, cross-channel context and deeper automation.", features: ["12,000 monthly Flux Credits", "Everything in Plus", "Multi-channel customer operations", "Website, WhatsApp, Voice and Email workflows where applicable", "Admin workspace and team access", "Cross-channel customer context", "CRM and workflow visibility", "Reporting and operational oversight", "Expanded human escalation controls", "Leo Admin Assistance"], cta: "Choose Business", featured: true },
  { icon: Database, slug: "business-plus", name: "Business+", firstMonth: "\u20A62,000,000", ongoing: "\u20A6500,000/month", description: "Everything in Business, plus the deeper operational layer needed when customer conversations must connect to structured business data, advanced workflows and integrations.", features: ["25,000+ configurable monthly Flux Credits", "Everything in Business", "Industry-specific customer or operations database", "Custom client, member or operational records", "Advanced workflow automation", "Deeper record history and lifecycle visibility", "Advanced reporting and segmentation", "Custom integrations where required", "Custom dashboards where required", "Managed deployment and support"], cta: "Choose Business+" },
  { icon: Workflow, slug: "custom", name: "Custom", firstMonth: "Custom", ongoing: "Custom", description: "Anything the client needs automated, integrated or set up. The system is scoped around the client’s exact goals, workflows, channels, data, integrations and expected usage.", features: ["Custom automation scope", "Custom Flux Credit allocation", "Any required combination of customer channels", "Custom AI agents where required", "Custom follow-up, reminder and operational workflows", "Custom integrations, databases and dashboards where required", "Custom internal tools or process automation", "Deployment, onboarding and support defined around the client"], cta: "Build a Custom Plan", custom: true },
];

const reveal = { initial: { opacity: 0, y: 22 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.22 }, transition: { duration: 0.65, ease: "easeOut" } } as const;

export default function HomePage() {
  return (
    <main className={styles.home}>
      <PublicLeoConsultant />
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <motion.div className={styles.heroCopy} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
            <p className={styles.eyebrow}>AI customer operations for growing organizations</p>
            <h1 id="home-title">Grow your organization without growing the workload.</h1>
            <p>Fluxknight builds AI systems that handle customer conversations and the work that follows, including enquiry handling, support, qualification, follow-up, scheduling, CRM updates, and human handoff.</p>
            <div className={styles.heroActions}><Link className={styles.primary} href="/evaluation" data-cta="hero-evaluation">Evaluate My Business <ArrowRight size={17} /></Link><Link className={styles.secondary} href="#services" data-cta="hero-services">See What We Automate <ArrowRight size={16} /></Link></div>
            <div className={styles.proofRow} aria-label="Fluxknight operating principles"><span><CheckCircle2 size={14} /> Works 24/7</span><span><CheckCircle2 size={14} /> Built around your workflow</span><span><CheckCircle2 size={14} /> Human handoff stays available</span></div>
          </motion.div>
          <motion.div className={styles.heroVisual} initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.85, delay: 0.18, ease: "easeOut" }}><FluxProductVisuals kind="hero" /></motion.div>
        </div>
      </section>
      <section className={`${styles.section} ${styles.valueSection}`} aria-label="Why Fluxknight"><div className={`${styles.shell} ${styles.valueGrid}`}>{proofPoints.map(({ icon: Icon, title, text }) => <article className={styles.valueItem} key={title}><Icon size={19} /><h2>{title}</h2><p>{text}</p></article>)}</div></section>
      <ProductSection pillar={automationPillars[0]} headingId="conversations-title" />
      <ProductSection pillar={automationPillars[1]} headingId="journey-title" reverse />
      <ProductSection pillar={automationPillars[2]} headingId="operations-title" />
      <section className={`${styles.section} ${styles.caseStudy}`} id="maia-case-study" aria-labelledby="maia-title"><div className={`${styles.shell} ${styles.caseGrid}`}><motion.div className={styles.caseCopy} {...reveal}><p className={styles.eyebrow}>Case study: Maia</p><h2 id="maia-title">See Fluxknight in practice.</h2><p>Maia is a real estate AI system connecting enquiry, qualification, follow-up, scheduling, support, CRM updates, admin visibility and human handoff in one working customer journey.</p><Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">Explore the Maia case study <ArrowRight size={17} /></Link></motion.div><motion.div className={styles.featureVisual} {...reveal}><FluxProductVisuals kind="maia" /></motion.div></div></section>
      <section className={`${styles.section} ${styles.process}`} aria-labelledby="process-title"><div className={`${styles.shell} ${styles.processGrid}`}><motion.div {...reveal}><p className={styles.eyebrow}>How Fluxknight works</p><h2 id="process-title">One system, from the first signal to the next right action.</h2><p>Every implementation is built around the customer journey and the operational work your team needs to see.</p></motion.div><motion.div {...reveal}><FluxProductVisuals kind="process" /><ol className={styles.capabilities}>{processSteps.map(([title, text]) => <li key={title}><CheckCircle2 size={15} /><span><strong>{title}</strong>: {text}</span></li>)}</ol></motion.div></div></section>
      <div className={styles.industryWrap}><IndustryCarousel /></div>
      <section className={`${styles.section} ${styles.proof}`} aria-label="Proof and client perspectives"><div className={styles.shell}><ClientReviews /></div></section>
      <section className={`${styles.section} ${styles.pricing}`} id="pricing" aria-labelledby="pricing-title"><div className={styles.shell}><div className={styles.pricingIntro}><div><p className={styles.eyebrow}>Pricing</p><h2 id="pricing-title">Choose the level of customer operations you need.</h2></div><p>Compare channel limits, Flux Credits and automation depth. Custom is built around the exact work your business needs connected.</p></div><PricingCarousel plans={pricingPlans} showDurationSelector /><div className={styles.pricingLink}><Link className={styles.secondary} href="/pricing" data-cta="pricing-details">See full pricing and package details <ArrowRight size={16} /></Link></div><p className={styles.pricingNote}>Basic supports one channel and up to two human handoff recipients. Plus adds a second channel, higher credits, follow-ups and reminders. Business expands into multi-channel operations. Business+ adds the advanced operational data layer. Custom is defined entirely around your requirements.</p></div></section>
      <section className={styles.finalCta} aria-labelledby="evaluation-title"><div className={styles.shell}><div><p className={styles.eyebrow}>Business AI evaluation</p><h2 id="evaluation-title">Ready to find what your business should automate first?</h2><p>Show us where enquiries get lost, follow-up breaks down, or repetitive work consumes your team.</p></div><Link className={styles.primary} href="/evaluation" data-cta="evaluation-final">Evaluate My Business <ArrowRight size={17} /></Link></div></section>
    </main>
  );
}

function ProductSection({ pillar, headingId, reverse = false }: { pillar: typeof automationPillars[number]; headingId: string; reverse?: boolean }) {
  return <section className={`${styles.section} ${styles.feature} ${reverse ? styles.featureRight : styles.featureLeft}`} id={pillar.title === "Customer conversations" ? "services" : undefined} aria-labelledby={headingId}><div className={`${styles.shell} ${styles.featureGrid} ${reverse ? styles.featureReverse : ""}`}><motion.div className={styles.featureCopy} {...reveal}><p className={styles.eyebrow}>{pillar.title}</p><h2 id={headingId}>{pillar.heading}</h2><p>{pillar.text}</p><CapabilityList items={pillar.detail} /><Link href="/services" className={styles.featureLink}>Explore {pillar.title.toLowerCase()} <ArrowRight size={15} /></Link></motion.div><motion.div className={styles.featureVisual} {...reveal}><FluxProductVisuals kind={pillar.visual} /></motion.div></div></section>;
}

function CapabilityList({ items }: { items: string[] }) {
  return <ul className={styles.capabilities}>{items.map((item) => <li key={item}><CheckCircle2 size={15} />{item}</li>)}</ul>;
}
