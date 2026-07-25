"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Building2, CheckCircle2, Database, Headphones, Mic, Network, Rocket, ShoppingCart, Sparkles, Stethoscope, Workflow } from "lucide-react";
import ElevenLabsConsultant from "@/components/ElevenLabsConsultant";

const services = [
  { icon: Bot, title: "AI Sales Agents", text: "Qualify leads, answer objections, recommend next steps, and move opportunities into your pipeline." },
  { icon: Headphones, title: "Customer Support", text: "Resolve routine questions instantly and route sensitive requests to the correct human." },
  { icon: Mic, title: "Voice Automation", text: "Handle inbound and outbound calls for qualification, booking, reminders, and follow-up." },
  { icon: Workflow, title: "Workflow Intelligence", text: "Connect n8n, Trigger.dev, Supabase, and business tools through auditable workflows." },
  { icon: Database, title: "Lead Generation", text: "Collect, enrich, segment, and route high-intent leads into one controlled system." },
  { icon: Network, title: "CRM Automation", text: "Keep conversations, customer records, follow-ups, and reporting synchronized." },
];

const industries = [
  { icon: Building2, title: "Real Estate", text: "Property inquiries, qualification, follow-up, payment tracking, and human handoff." },
  { icon: ShoppingCart, title: "E-commerce", text: "Product support, abandoned-cart recovery, order updates, and repeat-purchase campaigns." },
  { icon: Stethoscope, title: "Clinics", text: "Patient intake, appointment booking, reminders, rescheduling, and staff escalation." },
];

const cases = [
  { tag: "Real estate", title: "Maia AI property assistant", text: "A connected assistant for property discovery, lead qualification, follow-up, installment tracking, and agent handoff." },
  { tag: "Sales operations", title: "Automated lead engine", text: "Lead collection, enrichment, segmentation, outbound sequences, reply tracking, and sales-ready notifications." },
  { tag: "Customer service", title: "Omnichannel support layer", text: "One knowledge base powering web, WhatsApp, voice, and human escalation without fragmenting customer data." },
];

export default function HomePage() {
  return (
    <main className="quantix-home">
      <ElevenLabsConsultant />
      <section className="quantix-hero">
        <div className="hero-stars" /><div className="violet-arc" /><div className="hero-haze" />
        <motion.div className="hero-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
          <div className="hero-pill"><Sparkles size={13} /> Coordinate your AI workforce</div>
          <h1>Build a business that runs through <span>connected AI automation.</span></h1>
          <p>Deploy intelligent sales, support, voice, lead-generation, and workflow agents through one secure operating system built around your actual business.</p>
          <div className="hero-buttons"><Link className="button-primary" href="/evaluation">Book a Demo <ArrowRight size={17} /></Link><Link className="button-secondary" href="/services">Explore Services <ArrowRight size={16} /></Link></div>
        </motion.div>
        <motion.div className="product-shot" initial={{ opacity: 0, y: 42, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .9, delay: .25 }}><img src="/flux-dashboard.svg" alt="Fluxknight AI operations dashboard" /></motion.div>
      </section>

      <section className="integration-strip"><p>Built to connect with the tools your business already uses</p><div><span>n8n</span><span>Supabase</span><span>ElevenLabs</span><span>WhatsApp</span><span>Trigger.dev</span><span>OpenAI</span></div></section>

      <section className="brand-section" id="services"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">Services</span><h2>Every major automation capability in one coherent system.</h2><p>Separate agents can work independently while sharing permissions, data, workflow monitoring, and human escalation rules.</p></div><div className="brand-grid">{services.map(({icon:Icon,title,text})=><article className="brand-card" key={title}><span className="brand-icon"><Icon size={21}/></span><h3>{title}</h3><p>{text}</p><Link href="/services">View service <ArrowRight size={15}/></Link></article>)}</div></div></section>

      <section className="brand-section" id="industries"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">Industries</span><h2>Automation designed around how each business actually operates.</h2><p>No generic chatbot theatre. Each system is shaped around the lead journey, staff responsibilities, customer channels, and data already inside the business.</p></div><div className="brand-grid">{industries.map(({icon:Icon,title,text})=><article className="brand-card" key={title}><span className="brand-icon"><Icon size={21}/></span><h3>{title}</h3><p>{text}</p><Link href="/industries">Explore industry <ArrowRight size={15}/></Link></article>)}</div></div></section>

      <section className="brand-section" id="case-studies"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">Case studies</span><h2>Systems built to produce measurable operational outcomes.</h2><p>These examples show how Fluxknight combines AI agents, workflows, shared data, and human control instead of scattering tools across five dashboards and a prayer.</p></div><div className="brand-grid">{cases.map((item)=><article className="brand-card" key={item.title}><span className="brand-eyebrow">{item.tag}</span><h3>{item.title}</h3><p>{item.text}</p><Link href="/case-studies">Read case study <ArrowRight size={15}/></Link></article>)}</div></div></section>

      <section className="brand-section" id="pricing"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">Pricing</span><h2>Start with the system your business needs now.</h2><p>Pricing is scoped around channels, integrations, workflow complexity, usage, and ongoing support rather than a decorative list of meaningless tiers.</p></div><div className="brand-grid"><article className="brand-card"><span className="brand-icon"><Rocket size={21}/></span><h3>Starter System</h3><p>One core agent, lead capture, basic workflow automation, and a controlled handoff process.</p><Link href="/pricing">View pricing <ArrowRight size={15}/></Link></article><article className="brand-card"><span className="brand-icon"><Network size={21}/></span><h3>Growth System</h3><p>Multiple channels, CRM integration, follow-up automation, reporting, and workflow monitoring.</p><Link href="/pricing">View pricing <ArrowRight size={15}/></Link></article><article className="brand-card"><span className="brand-icon"><CheckCircle2 size={21}/></span><h3>Custom Operations</h3><p>Multi-agent systems, branches, advanced workflow orchestration, voice, and custom data integrations.</p><Link href="/evaluation">Request evaluation <ArrowRight size={15}/></Link></article></div></div></section>

      <section className="brand-section" id="about"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">About Fluxknight</span><h2>We build automation systems around business reality.</h2><p>Fluxknight combines AI agents, workflow automation, shared data, and human oversight so businesses can grow without turning their operations into a community of confusion.</p></div><div className="hero-buttons"><Link className="button-primary" href="/about">About Fluxknight <ArrowRight size={17}/></Link><Link className="button-secondary" href="/evaluation">Book a Demo</Link></div></div></section>
    </main>
  );
}
