"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Database,
  Dumbbell,
  Headphones,
  Hotel,
  MessageSquareText,
  Mic,
  Network,
  Rocket,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  UsersRound,
  Workflow,
  Wrench,
} from "lucide-react";
import ElevenLabsConsultant from "@/components/ElevenLabsConsultant";

const services = [
  { icon: Bot, title: "AI Sales Agents", text: "Qualify leads, answer objections, recommend next steps, and move opportunities into your pipeline." },
  { icon: Headphones, title: "Customer Support", text: "Resolve routine questions instantly and route sensitive requests to the correct human." },
  { icon: Mic, title: "Voice Automation", text: "Handle inbound and outbound calls for qualification, booking, reminders, and follow-up." },
  { icon: Workflow, title: "Workflow Intelligence", text: "Connect n8n, Trigger.dev, Supabase, and business tools through auditable workflows." },
  { icon: Database, title: "Lead Generation", text: "Collect, enrich, segment, and route high-intent leads into one controlled system." },
  { icon: Network, title: "Customer Management Automation", text: "Keep customer details, conversations, follow-ups, sales stages, and reporting organized in one shared system." },
];

const industries = [
  { icon: Building2, title: "Real Estate", text: "Property inquiries, qualification, follow-up, payment tracking, and human handoff." },
  { icon: ShoppingCart, title: "E-commerce", text: "Product support, abandoned-cart recovery, order updates, and repeat-purchase campaigns." },
  { icon: Stethoscope, title: "Clinics", text: "Patient intake, appointment booking, reminders, rescheduling, and staff escalation." },
];

const useCases = [
  {
    icon: Building2,
    tag: "Real estate companies",
    title: "Turn every property inquiry into a guided sales journey.",
    summary: "An AI property assistant can speak with prospects immediately, understand their budget and preferred location, recommend suitable listings, explain payment plans, book inspections, and keep following up until a human agent needs to step in.",
    flow: "A buyer asks about land at 11:47 p.m. → AI answers instantly → collects budget and location → suggests matching properties → books an inspection → alerts the assigned agent.",
    outcome: "Faster replies, fewer forgotten leads, more inspections, and a sales team that spends its time closing instead of repeatedly answering the same questions.",
  },
  {
    icon: Hotel,
    tag: "Hotels and restaurants",
    title: "Give every guest a responsive digital concierge.",
    summary: "AI can answer room, menu, price, availability, location, and policy questions across your website, WhatsApp, or phone. It can take reservation details, confirm bookings, send reminders, collect guest preferences, and pass unusual requests to staff.",
    flow: "A guest asks for a room and airport pickup → AI checks the request → captures dates and guest details → confirms the reservation process → sends the information to reception.",
    outcome: "More bookings outside business hours, quicker guest service, fewer missed calls, and less pressure on reception and front-desk staff.",
  },
  {
    icon: Dumbbell,
    tag: "Gyms and fitness businesses",
    title: "Convert interest into memberships and keep members engaged.",
    summary: "An AI membership assistant can explain plans, recommend packages, schedule facility tours or training sessions, remind prospects to complete registration, and automatically check in with inactive members before they quietly disappear.",
    flow: "A prospect asks for the monthly fee → AI explains available plans → asks about fitness goals → recommends the right option → books a tour → follows up after the visit.",
    outcome: "More membership conversions, better attendance, stronger retention, and fewer staff hours lost to repetitive enquiries and manual reminders.",
  },
  {
    icon: Wrench,
    tag: "Service businesses",
    title: "Run bookings, customer updates, and follow-up without operational chaos.",
    summary: "For auto-repair shops, appliance installers, solar companies, cleaning teams, technicians, and maintenance businesses, AI can collect the customer’s problem, request photos or location details, schedule a visit, send updates, prepare estimates, and request feedback after the job.",
    flow: "A customer reports a faulty air conditioner → AI collects the issue and address → schedules a technician → sends reminders → updates the customer → requests a review after completion.",
    outcome: "Fewer missed appointments, clearer job information, faster response times, better customer trust, and a cleaner handoff between office staff and field teams.",
  },
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

      <section className="brand-section" id="use-cases">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">How AI grows a business</span>
            <h2>See exactly what Fluxknight can take off your team’s plate.</h2>
            <p>AI is not a mysterious robot employee floating in the cloud. It is a practical system that responds faster, remembers every lead, performs repetitive tasks, and brings a human into the conversation when judgment is required.</p>
          </div>
          <div className="brand-grid">
            {useCases.map(({ icon: Icon, tag, title, summary, flow, outcome }) => (
              <motion.article className="brand-card" key={tag} whileHover={{ y: -8 }} transition={{ duration: .22 }}>
                <span className="brand-icon"><Icon size={22} /></span>
                <span className="brand-eyebrow">{tag}</span>
                <h3>{title}</h3>
                <p>{summary}</p>
                <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <MessageSquareText size={18} style={{ flex: "0 0 auto", marginTop: "3px" }} />
                    <p><strong>How it works:</strong> {flow}</p>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <CalendarCheck2 size={18} style={{ flex: "0 0 auto", marginTop: "3px" }} />
                    <p><strong>Business result:</strong> {outcome}</p>
                  </div>
                </div>
                <Link href="/evaluation">Build this for my business <ArrowRight size={15}/></Link>
              </motion.article>
            ))}
          </div>
          <div style={{ marginTop: "34px", display: "grid", gap: "14px", textAlign: "center" }}>
            <span className="brand-icon" style={{ margin: "0 auto" }}><UsersRound size={22} /></span>
            <h3 style={{ margin: 0 }}>The goal is not to replace your team. It is to remove the work that slows them down.</h3>
            <p style={{ maxWidth: "760px", margin: "0 auto" }}>Fluxknight connects AI conversations, customer records, bookings, reminders, internal alerts, and human handoffs into one operating system built around the way your business already works.</p>
            <div className="hero-buttons" style={{ justifyContent: "center" }}><Link className="button-primary" href="/evaluation">Plan My AI System <ArrowRight size={17} /></Link></div>
          </div>
        </div>
      </section>

      <section className="brand-section" id="pricing"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">Pricing</span><h2>Start with the system your business needs now.</h2><p>Pricing is scoped around channels, integrations, workflow complexity, usage, and ongoing support rather than a decorative list of meaningless tiers.</p></div><div className="brand-grid"><article className="brand-card"><span className="brand-icon"><Rocket size={21}/></span><h3>Starter System</h3><p>One core agent, lead capture, basic workflow automation, and a controlled handoff process.</p><Link href="/pricing">View pricing <ArrowRight size={15}/></Link></article><article className="brand-card"><span className="brand-icon"><Network size={21}/></span><h3>Growth System</h3><p>Multiple channels, customer-management integration, follow-up automation, reporting, and workflow monitoring.</p><Link href="/pricing">View pricing <ArrowRight size={15}/></Link></article><article className="brand-card"><span className="brand-icon"><CheckCircle2 size={21}/></span><h3>Custom Operations</h3><p>Multi-agent systems, branches, advanced workflow orchestration, voice, and custom data integrations.</p><Link href="/evaluation">Request evaluation <ArrowRight size={15}/></Link></article></div></div></section>

      <section className="brand-section" id="about"><div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">About Fluxknight</span><h2>We build automation systems around business reality.</h2><p>Fluxknight combines AI agents, workflow automation, shared data, and human oversight so businesses can grow without turning their operations into a community of confusion.</p></div><div className="hero-buttons"><Link className="button-primary" href="/about">About Fluxknight <ArrowRight size={17}/></Link><Link className="button-secondary" href="/evaluation">Book a Demo</Link></div></div></section>
    </main>
  );
}
