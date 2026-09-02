"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Bot, Building2, CheckCircle2, Database, Dumbbell, Headphones, Hotel, MessageSquareText, Mic, Network, Rocket, ShieldCheck, Sparkles, Workflow, Wrench, Zap } from "@/components/admin/ServerIcons";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import IndustryCarousel from "@/components/IndustryCarousel";
import ClientReviews from "@/components/ClientReviews";
import PricingCarousel from "@/components/PricingCarousel";

const services = [
  { icon: Bot, title: "AI Sales Agents", text: "Qualify leads, answer objections, recommend next steps, and move opportunities into your pipeline." },
  { icon: Headphones, title: "AI Customer Support Agents", text: "Resolve routine questions instantly across connected channels and route sensitive requests to the correct human." },
  { icon: Mic, title: "AI Voice & Phone Agents", text: "Handle inbound and outbound calls for qualification, booking, reminders, and follow-up." },
  { icon: Workflow, title: "AI Workflow Automation", text: "Coordinate business processes, approvals, follow-ups, alerts, and data movement through reliable automated workflows." },
  { icon: Database, title: "AI Lead Generation", text: "Collect, enrich, segment, and route high-intent leads into one controlled system." },
  { icon: Network, title: "CRM & Customer Automation", text: "Keep customer details, conversations, follow-ups, sales stages, and reporting organized in one shared system." },
];

const useCases = [
  { icon: Building2, tag: "Real estate companies", title: "Turn every property inquiry into a guided sales journey.", summary: "An AI property assistant can speak with prospects immediately, understand their budget and preferred location, recommend suitable listings, explain payment plans, book inspections, and keep following up until a human agent needs to step in.", flow: "A buyer asks about land at 11:47 p.m. → AI answers instantly → collects budget and location → suggests matching properties → books an inspection → alerts the assigned agent.", outcome: "Faster replies, fewer forgotten leads, more inspections, and a sales team that spends its time closing instead of repeatedly answering the same questions.", visualTitle: "New property enquiry", visualMessage: "I need land around Benin Airport Road. My budget is ₦12M.", visualSteps: ["Budget captured", "3 properties matched", "Inspection booked"], visualMetric: "Lead sent to agent", visualStatus: "Qualified" },
  { icon: Hotel, tag: "Hotels and restaurants", title: "Give every guest a responsive digital concierge.", summary: "AI can answer room, menu, price, availability, location, and policy questions across your website, WhatsApp, or phone. It can take reservation details, confirm bookings, send reminders, collect guest preferences, and pass unusual requests to staff.", flow: "A guest asks for a room and airport pickup → AI checks the request → captures dates and guest details → confirms the reservation process → sends the information to reception.", outcome: "More bookings outside business hours, quicker guest service, fewer missed calls, and less pressure on reception and front-desk staff.", visualTitle: "Guest reservation request", visualMessage: "One deluxe room for Friday, plus airport pickup for two guests.", visualSteps: ["Dates confirmed", "Guest details saved", "Reception notified"], visualMetric: "Booking ready", visualStatus: "Confirmed" },
  { icon: Dumbbell, tag: "Gyms and fitness businesses", title: "Convert interest into memberships and keep members engaged.", summary: "An AI membership assistant can explain plans, recommend packages, schedule facility tours or training sessions, remind prospects to complete registration, and automatically check in with inactive members before they quietly disappear.", flow: "A prospect asks for the monthly fee → AI explains available plans → asks about fitness goals → recommends the right option → books a tour → follows up after the visit.", outcome: "More membership conversions, better attendance, stronger retention, and fewer staff hours lost to repetitive enquiries and manual reminders.", visualTitle: "New membership enquiry", visualMessage: "I want to lose weight and train after work. Which plan suits me?", visualSteps: ["Goal understood", "Plan recommended", "Tour scheduled"], visualMetric: "Follow-up active", visualStatus: "Warm lead" },
  { icon: Wrench, tag: "Service businesses", title: "Run bookings, customer updates, and follow-up without operational chaos.", summary: "For auto-repair shops, appliance installers, solar companies, cleaning teams, technicians, and maintenance businesses, AI can collect the customer’s problem, request photos or location details, schedule a visit, send updates, prepare estimates, and request feedback after the job.", flow: "A customer reports a faulty air conditioner → AI collects the issue and address → schedules a technician → sends reminders → updates the customer → requests a review after completion.", outcome: "Fewer missed appointments, clearer job information, faster response times, better customer trust, and a cleaner handoff between office staff and field teams.", visualTitle: "Service request received", visualMessage: "My air conditioner is leaking. I need a technician tomorrow morning.", visualSteps: ["Issue recorded", "Technician assigned", "Customer updated"], visualMetric: "Job card created", visualStatus: "Scheduled" },
];

const pricingPlans = [
  { icon: MessageSquareText, slug: "whatsapp-ai-starter", name: "WhatsApp AI Starter", firstMonth: "₦100,000", ongoing: "₦50,000/month", description: "A focused WhatsApp AI agent for businesses that want every enquiry answered, qualified, captured, and followed up.", features: ["24/7 WhatsApp AI receptionist", "Approved FAQ responses", "Lead qualification", "Customer detail capture", "Automated follow-up", "Human handoff", "Basic dashboard access"], cta: "Get started" },
  { icon: Mic, slug: "ai-call-receptionist", name: "AI Call Receptionist", firstMonth: "₦200,000", ongoing: "₦100,000/month", description: "An AI phone agent that answers customers, understands why they are calling, qualifies opportunities and routes the right calls.", features: ["24/7 inbound AI calls", "Approved FAQ responses", "Caller qualification", "Customer detail capture", "Appointment booking where configured", "Human escalation", "Call summaries", "Dashboard lead capture"], cta: "Get started" },
  { icon: Network, slug: "ai-front-desk-suite", name: "AI Front Desk Suite", firstMonth: "₦400,000", ongoing: "₦250,000/month", description: "A connected front desk across WhatsApp, inbound calls and email, keeping customer communication and follow-up in one operating process.", features: ["WhatsApp AI", "Inbound AI call agent", "Email automation", "Lead qualification", "Automated follow-up", "Customer detail capture", "Booking support", "Human handoff", "Shared dashboard", "Basic reporting"], cta: "Get started", featured: true },
  { icon: Rocket, slug: "custom-ai-operations", name: "Custom AI Operations", firstMonth: "Custom", ongoing: "Custom", description: "For organizations that need multiple AI agents, departments, branches, advanced workflows and custom integrations built around their operations.", features: ["Multiple AI agents", "Multiple departments or branches", "Advanced workflow automation", "Voice, WhatsApp and email", "Custom integrations", "Customer-management automation", "Advanced analytics", "Workflow monitoring", "Organization-wide automation", "Managed deployment and support"], cta: "Request an evaluation", custom: true },
];

export default function HomePage() {
  const [activeFeature, setActiveFeature] = useState(2);
  const moveFeature = (direction: number) => setActiveFeature((current) => (current + direction + services.length) % services.length);

  return (
    <main className="quantix-home">
      <PublicLeoConsultant />

      <section className="quantix-hero reference-hero">
        <div className="hero-stars" />
        <div className="violet-arc" />
        <div className="hero-haze" />
        <motion.div
          className="hero-content"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="hero-pill"><Sparkles size={13} /> AI-powered business operations</div>
          <h1>Automate. Optimize. <span>Scale Limitlessly.</span></h1>
          <p>Fluxknight builds AI-powered automation systems that save time, reduce costs, and grow your business.</p>
          <div className="hero-buttons">
            <Link className="button-primary" href="/evaluation">Book a Free Strategy Call <ArrowRight size={17} /></Link>
          </div>
        </motion.div>

        <motion.div
          className="hero-energy-field"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: [0.72, 1, 0.72], scale: [0.985, 1.015, 0.985], x: "-50%" }}
          transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <Image src="/fluxknight-orbital-network.png" alt="" fill priority sizes="100vw" />
        </motion.div>

        <motion.div
          className="product-shot"
          initial={false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
        >
          <Image
            src="/flux-dashboard.svg"
            alt="Fluxknight AI agents and business automation dashboard"
            width={1600}
            height={900}
            priority
          />
        </motion.div>
      </section>

      <section className="reference-trust" aria-label="Trusted businesses">
        <span>Trusted by innovative businesses</span>
        <div><strong>K1 DEVICE</strong><strong>Limitless Realty</strong><strong>XPOSURE</strong><strong>GENCOUV</strong><strong>Landsmith</strong></div>
      </section>

      <section className="brand-section services-constellation reference-needs" id="services">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Why choose us</span>
            <h2>Premier Choice for<br />Your Automation Needs</h2>
          </div>
          <div className="needs-network">
            <div className="needs-core"><span><ShieldCheck size={24} /></span></div>
            <article className="need-card need-left"><span className="brand-icon"><Zap size={22} /></span><h3>Smart Automations</h3><p>AI-powered workflows and agents that handle repetitive tasks, qualify leads, and drive results while you focus on growth.</p></article>
            <article className="need-card need-center"><span className="brand-icon"><ShieldCheck size={22} /></span><h3>Enterprise Security</h3><p>Role-based security, data encryption, and controlled human oversight keep your business and customer data safe.</p></article>
            <article className="need-card need-right"><span className="brand-icon"><Headphones size={22} /></span><h3>24/7 Expert Support</h3><p>Our team and AI agents work around the clock to support your business and keep operations running smoothly.</p></article>
            <div className="needs-horizon"><Image src="/fluxknight-orbital-network.png" alt="" fill sizes="100vw" /></div>
          </div>
          <div className="service-chip-row">{services.map(({icon:Icon,title})=><Link href="/services" key={title}><Icon size={16}/>{title}</Link>)}</div>
        </div>
      </section>

      <section className="brand-section reference-features" id="use-cases">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Powerful & intelligent</span>
            <h2>Discover the Powerful Features<br />of Fluxknight</h2>
          </div>
          <div className="feature-stage" onKeyDown={(event)=>{if(event.key==="ArrowLeft")moveFeature(-1);if(event.key==="ArrowRight")moveFeature(1)}} tabIndex={0} aria-label="Fluxknight feature carousel">
            <button className="feature-arrow feature-prev" onClick={()=>moveFeature(-1)} aria-label="Previous feature"><ArrowLeft size={20}/></button>
            {services.map(({icon:Icon,title,text},index)=>{
              let offset=index-activeFeature;
              if(offset>services.length/2)offset-=services.length;
              if(offset<-services.length/2)offset+=services.length;
              return <article key={title} className={`feature-card ${offset===0?"is-active":""}`} style={{transform:`translateX(${offset*54}%) scale(${offset===0 ? 1 : Math.abs(offset)===1 ? .84 : .7}) rotateY(${offset*-7}deg)`,opacity:Math.abs(offset)>2 ? 0 : offset===0 ? 1 : Math.abs(offset)===1 ? .55 : .22,zIndex:10-Math.abs(offset)}} aria-hidden={Math.abs(offset)>2} onClick={()=>setActiveFeature(index)}><span className="brand-icon"><Icon size={offset===0?32:22}/></span><h3>{title}</h3><p>{text}</p>{offset===0&&<Link href="/services">Explore this feature <ArrowRight size={15}/></Link>}</article>;
            })}
            <button className="feature-arrow feature-next" onClick={()=>moveFeature(1)} aria-label="Next feature"><ArrowRight size={20}/></button>
          </div>
          <div className="feature-dots" role="tablist" aria-label="Choose a feature">{services.map((service,index)=><button key={service.title} aria-label={`Show ${service.title}`} role="tab" aria-selected={index===activeFeature} onClick={()=>setActiveFeature(index)}/>)}</div>
          <div className="use-case-ribbon">
            {useCases.map(({icon:Icon,tag,title,summary,visualSteps})=><article key={tag}><div><span className="brand-icon"><Icon size={19}/></span><small>{tag}</small></div><h3>{title}</h3><p>{summary}</p><div>{visualSteps.map(step=><span key={step}><CheckCircle2 size={14}/>{step}</span>)}</div><Link href="/evaluation">Build this system <ArrowRight size={14}/></Link></article>)}
          </div>
          <div className="hero-buttons"><Link className="button-primary" href="/services">Explore All Features <ArrowRight size={16}/></Link></div>
        </div>
      </section>

      <section className="brand-section pricing-orbit-section" id="pricing">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Pricing</span>
            <h2>Start small. Automate what matters. Expand when the business is ready.</h2>
            <p>Your first month covers setup, configuration, deployment and onboarding. From the second month onward, you pay the ongoing service fee for monitoring, support and continued operation.</p>
          </div>
          <PricingCarousel plans={pricingPlans} compact />
          <div className="hero-buttons pricing-route-link"><Link className="button-secondary" href="/pricing">See full pricing &amp; package details <ArrowRight size={16} /></Link></div>
          <p className="pricing-usage-note">Voice usage, messaging-provider charges, email volume, and third-party platform fees may vary by usage and are scoped during onboarding.</p>
        </div>
      </section>

      <section className="brand-section compact-about" id="about">
        <div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">About Fluxknight</span><h2>AI automation built around business reality.</h2><p>Fluxknight combines specialized AI agents, connected workflows, shared data, and human oversight into one secure operating platform.</p><div className="hero-buttons"><Link className="button-secondary" href="/about">About Fluxknight <ArrowRight size={16}/></Link></div></div></div>
      </section>

      <IndustryCarousel />

      <ClientReviews />
    </main>
  );
}
