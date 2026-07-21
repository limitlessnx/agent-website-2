"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bot, Headphones, MessageSquare, Mic, Database, FileText,
  ArrowRight, CheckCircle, Building2, Monitor, ShoppingCart,
  Stethoscope, Truck, Briefcase, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import ElevenLabsConsultant from "@/components/ElevenLabsConsultant";

function NeuralGrid() {
  return (
    <svg aria-hidden="true" style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.4,pointerEvents:"none" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="fade" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#06080f" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,212,255,0.07)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#fade)" />
      {[120,240,360,480,600,720].map(x=>[120,240,360,480].map(y=>(
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="rgba(0,212,255,0.18)" />
      )))}
      <line x1="120" y1="120" x2="240" y2="240" stroke="rgba(0,212,255,0.06)" strokeWidth="1"/>
      <line x1="360" y1="120" x2="480" y2="240" stroke="rgba(0,212,255,0.06)" strokeWidth="1"/>
      <line x1="240" y1="240" x2="360" y2="360" stroke="rgba(0,212,255,0.05)" strokeWidth="1"/>
      <line x1="480" y1="120" x2="600" y2="240" stroke="rgba(0,212,255,0.06)" strokeWidth="1"/>
    </svg>
  );
}

function FadeUp({ children, delay=0, style={} }: { children:React.ReactNode; delay?:number; style?:React.CSSProperties }) {
  return (
    <motion.div initial={{opacity:0,y:28}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.65,delay,ease:[0.16,1,0.3,1]}} style={style}>
      {children}
    </motion.div>
  );
}

const services = [
  { icon:Bot, title:"AI Sales Agent", desc:"Qualifies leads, answers objections, and books meetings 24/7 without a salesperson in the loop." },
  { icon:Headphones, title:"AI Customer Support", desc:"Handles FAQs, complaints, and status checks instantly across chat and voice." },
  { icon:MessageSquare, title:"WhatsApp AI Assistant", desc:"Runs your entire customer conversation flow on WhatsApp from first message to closed deal." },
  { icon:Mic, title:"AI Voice Agent", desc:"Answers calls, books appointments, qualifies callers, and escalates when it matters." },
  { icon:Database, title:"CRM Automation", desc:"Syncs every lead, conversation, and deal stage automatically so your CRM updates itself." },
  { icon:FileText, title:"Lead Generation Engine", desc:"Scrapes targeted public business data, launches email follow-up, and scores cold, warm, and hot leads." },
];

const steps = [
  { label:"Discovery Call", desc:"We learn how your business sells and operates today." },
  { label:"Business Audit", desc:"We map the gaps, bottlenecks, and highest-leverage automation points." },
  { label:"AI Strategy", desc:"We design the exact system architecture for your business." },
  { label:"Build & Integrate", desc:"We build and connect everything to your existing tools." },
  { label:"Test & Launch", desc:"We run the system through its paces before you go live." },
  { label:"Optimize Monthly", desc:"We monitor, improve, and expand your AI stack over time." },
];

const industries = [
  { id:"hotels", icon:Building2, label:"Hotels", image:"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=700&q=80", desc:"Booking inquiries, guest requests, review follow-up, and reservation handoff." },
  { id:"restaurants", icon:ShoppingCart, label:"Restaurants", image:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80", desc:"Reservations, catering leads, menu questions, offers, and repeat-customer campaigns." },
  { id:"clinics", icon:Stethoscope, label:"Clinics", image:"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80", desc:"Appointment booking, patient intake, no-show reminders, and treatment inquiry triage." },
  { id:"sales-companies", icon:Briefcase, label:"Sales Companies", image:"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=700&q=80", desc:"Web-scraped lead lists, cold email follow-up, reply scoring, and closer alerts." },
  { id:"real-estate", icon:Building2, label:"Real Estate", image:"https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=700&q=80", desc:"Buyer qualification, listing recommendations, inspection bookings, and lead nurture." },
  { id:"gyms", icon:Briefcase, label:"Gyms", image:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80", desc:"Trial bookings, membership questions, renewals, class promotions, and lead reactivation." },
  { id:"services", icon:Briefcase, label:"Services", image:"https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=700&q=80", desc:"Service intake, quote qualification, consultation booking, and follow-up automation." },
  { id:"auto-shops", icon:Truck, label:"Auto Shops", image:"https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=700&q=80", desc:"Repair booking, vehicle intake, quote follow-up, and maintenance reminder campaigns." },
  { id:"ecommerce", icon:ShoppingCart, label:"E-commerce", image:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=700&q=80", desc:"Cart recovery, product Q&A, order support, upsells, and customer win-back flows." },
  { id:"professional-services", icon:Briefcase, label:"Professional Services", image:"https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=700&q=80", desc:"Lead qualification, discovery calls, proposal follow-up, onboarding, and reminders." },
];

const caseStudies = [
  {
    industry:"Real Estate",
    title:"AI Assistant That Books Property Viewings on Autopilot",
    results:["Captures leads from WhatsApp and web chat 24/7","Sends matching property details in seconds","Books inspection appointments without agent involvement","Follows up with unsold leads over 21 days automatically"],
    metric:"3× more booked viewings",
    metricSub:"in the first 60 days",
  },
  {
    industry:"Sales Companies",
    title:"Lead Generation Engine That Warms Prospects While You Work",
    results:["Scrapes targeted public business leads","Runs cold email follow-up automatically","Tags replies as cold, warm, or hot","Alerts your team when a prospect is ready for a closer"],
    metric:"40% more qualified leads",
    metricSub:"with automated prospecting and follow-up",
  },
];

const pricingPlans = [
  {
    name:"Starter AI System",
    tag:"One automation, deployed fast.",
    price:"Starting at NGN 200,000",
    period:"one-time build",
    features:["1 AI agent (sales, support, or WhatsApp)","WhatsApp or web chat integration","Basic lead capture and handoff","30-day post-launch support"],
    cta:"Get Started",
    highlighted:false,
  },
  {
    name:"Growth Automation System",
    tag:"Full AI-powered sales and support stack.",
    price:"Starting from NGN 500,000",
    period:"one-time build",
    features:["Up to 3 AI agents","WhatsApp + Telegram + voice integration","Lead generation and follow-up automation","Lead scoring and routing","Analytics dashboard","60-day post-launch support"],
    cta:"Book a Strategy Call",
    highlighted:true,
  },
  {
    name:"Full AI Business OS",
    tag:"End-to-end automation for your whole business.",
    price:"Custom Quote",
    period:"scoped per project",
    features:["Unlimited AI agents","Full pipeline automation","Custom integrations and CRMs","Voice + chat + email + social","Monthly optimization retainer","Priority support and SLA"],
    cta:"Let's Talk",
    highlighted:false,
  },
];

const faqs = [
  { q:"Can you integrate with WhatsApp?", a:"Yes. We connect your AI agent to WhatsApp Business API. The agent handles entire conversations — from first message to booking or sale." },
  { q:"What about Telegram?", a:"Telegram bots are fully supported. We build AI-powered Telegram agents for lead capture, support, notifications, and admin dashboards." },
  { q:"Can the AI make and receive voice calls?", a:"Yes. We build AI voice agents that handle inbound and outbound calls with human-like conversation, appointment booking, and lead qualification." },
  { q:"Does it connect to my existing CRM?", a:"We integrate with most major CRMs — and build custom integrations if yours is proprietary. Every lead and conversation syncs automatically." },
  { q:"How long does setup take?", a:"Most systems are live within 7–14 days. Enterprise builds with custom integrations take 3–5 weeks." },
  { q:"Do you offer ongoing support after launch?", a:"Every project includes post-launch support. Growth and OS plans include ongoing monthly optimization to improve performance over time." },
  { q:"Can you build completely custom systems?", a:"Yes. We design custom AI systems from scratch using n8n, OpenAI, Supabase, and your tool stack." },
];

const demos = [
  { title:"Real Estate AI Assistant", tag:"WhatsApp + CRM", status:"Live Demo" },
  { title:"Computer Store Sales Agent", tag:"Chat + Stock Check", status:"Preview" },
  { title:"Lead Qualification Bot", tag:"WhatsApp Intake", status:"Preview" },
  { title:"AI Voice Receptionist", tag:"Inbound Calls", status:"Live Demo" },
];

function FAQItem({ q, a }: { q:string; a:string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom:"1px solid #1e2d3d", padding:"20px 0" }}>
      <button onClick={()=>setOpen(!open)} aria-expanded={open}
        style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:"none", border:"none", cursor:"pointer", color:"#f0f6ff", fontSize:"1rem", fontWeight:600, textAlign:"left", gap:"16px", padding:0, lineHeight:1.4 }}>
        <span>{q}</span>
        {open ? <ChevronUp size={18} color="#00d4ff" style={{flexShrink:0}} /> : <ChevronDown size={18} color="#8ba3bd" style={{flexShrink:0}} />}
      </button>
      {open && (
        <motion.p initial={{opacity:0}} animate={{opacity:1}} style={{ marginTop:"12px", fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.75 }}>
          {a}
        </motion.p>
      )}
    </div>
  );
}

const S = { maxWidth:"1200px", margin:"0 auto" };
const centered = { textAlign:"center" as const };

export default function HomePage() {
  return (
    <div>
      <ElevenLabsConsultant />
      {/* HERO */}
      <section style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", padding:"120px 24px 80px" }}>
        <NeuralGrid />
        <div aria-hidden="true" style={{ position:"absolute", top:"35%", left:"50%", transform:"translate(-50%,-50%)", width:"700px", height:"500px", background:"radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"relative", zIndex:1, maxWidth:"900px", margin:"0 auto", ...centered }}>
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:"8px", fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase", color:"#00d4ff", border:"1px solid rgba(0,212,255,0.25)", borderRadius:"100px", padding:"5px 14px", marginBottom:"28px" }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00d4ff", boxShadow:"0 0 8px #00d4ff", display:"inline-block" }} />
              AI Automation Agency
            </span>
          </motion.div>

          <motion.h1 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.7,delay:0.1,ease:[0.16,1,0.3,1]}}
            style={{ fontSize:"clamp(2.2rem,6vw,4.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.08, color:"#f0f6ff", marginBottom:"24px" }}>
            AI Employees That Help Your Business{" "}
            <span className="gradient-text">Sell, Support, and Scale</span>{" "}
            Automatically
          </motion.h1>

          <motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6,delay:0.25}}
            style={{ fontSize:"clamp(1rem,2vw,1.2rem)", color:"#8ba3bd", lineHeight:1.75, maxWidth:"640px", margin:"0 auto 40px" }}>
            We build AI sales agents, customer support systems, WhatsApp automation, voice agents, lead generation engines, CRM workflows, and custom AI systems for growing businesses.
          </motion.p>

          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.5,delay:0.4}}
            style={{ display:"flex", gap:"16px", justifyContent:"center", flexWrap:"wrap" }}>
            <Link href="/evaluation" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 32px", fontSize:"0.95rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"10px", textDecoration:"none", boxShadow:"0 0 30px rgba(0,212,255,0.3)", transition:"box-shadow 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 0 50px rgba(0,212,255,0.5)")}
              onMouseLeave={e=>(e.currentTarget.style.boxShadow="0 0 30px rgba(0,212,255,0.3)")}>
              Book a Free Strategy Call <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <Link href="/services" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 32px", fontSize:"0.95rem", fontWeight:600, color:"#f0f6ff", background:"rgba(255,255,255,0.05)", border:"1px solid #1e2d3d", borderRadius:"10px", textDecoration:"none", transition:"border-color 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(0,212,255,0.4)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="#1e2d3d")}>
              See What We Build
            </Link>
          </motion.div>

          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7}}
            style={{ marginTop:"64px", display:"flex", flexWrap:"wrap", gap:"40px", justifyContent:"center" }}>
            {[{n:"24/7",label:"Always-on agents"},{n:"48hr",label:"Fastest go-live"},{n:"6+",label:"AI system types"},{n:"100%",label:"Custom-built"}].map(({n,label})=>(
              <div key={n} style={centered}>
                <p style={{ fontSize:"1.5rem", fontWeight:800, color:"#00d4ff", letterSpacing:"-0.02em", lineHeight:1, marginBottom:"4px" }}>{n}</p>
                <p style={{ fontSize:"0.78rem", color:"#4d6478" }}>{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SERVICES */}
      <section style={{ padding:"100px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", borderBottom:"1px solid #1e2d3d" }}>
        <div style={S}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>What We Build</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.75rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"12px" }}>Core AI systems. One automation partner.</h2>
            <p style={{ ...centered, color:"#8ba3bd", maxWidth:"520px", margin:"0 auto 56px", lineHeight:1.7 }}>Every system we build is connected, conversational, and specific to your business workflow, including lead generation and follow-up.</p>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:"20px" }}>
            {services.map((s,i)=>(
              <FadeUp key={s.title} delay={i*0.07}>
                <div className="card-surface" style={{ padding:"28px", borderRadius:"12px", transition:"all 0.25s", height:"100%" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,212,255,0.3)";e.currentTarget.style.transform="translateY(-3px)"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#1e2d3d";e.currentTarget.style.transform="translateY(0)"}}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"10px", background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"16px" }}>
                    <s.icon size={20} color="#00d4ff" />
                  </div>
                  <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#f0f6ff", marginBottom:"10px" }}>{s.title}</h3>
                  <p style={{ fontSize:"0.875rem", color:"#8ba3bd", lineHeight:1.7 }}>{s.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <div style={{ ...centered, marginTop:"40px" }}>
            <FadeUp>
              <Link href="/services" style={{ display:"inline-flex", alignItems:"center", gap:"8px", color:"#00d4ff", fontSize:"0.9rem", fontWeight:600, textDecoration:"none" }}>
                View all services <ArrowRight size={15} />
              </Link>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding:"100px 24px" }}>
        <div style={S}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>The Process</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.75rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"56px" }}>From first call to live system in weeks</h2>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"2px", background:"#1e2d3d", borderRadius:"16px", overflow:"hidden" }}>
            {steps.map((step,i)=>(
              <FadeUp key={step.label} delay={i*0.08}>
                <div style={{ background:"#06080f", padding:"32px 28px", height:"100%" }}>
                  <div style={{ fontSize:"0.65rem", fontWeight:800, letterSpacing:"0.15em", color:"#00d4ff", marginBottom:"12px" }}>STEP {String(i+1).padStart(2,"0")}</div>
                  <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#f0f6ff", marginBottom:"8px" }}>{step.label}</h3>
                  <p style={{ fontSize:"0.875rem", color:"#8ba3bd", lineHeight:1.65 }}>{step.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section style={{ padding:"100px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", borderBottom:"1px solid #1e2d3d" }}>
        <div style={S}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>Industries</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.75rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"12px" }}>Built for businesses that run on sales and service</h2>
            <p style={{ ...centered, color:"#8ba3bd", maxWidth:"520px", margin:"0 auto 56px", lineHeight:1.7 }}>We go deep on your vertical so the AI understands your customers, objections, buying triggers, and follow-up process.</p>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"20px" }}>
            {industries.map((ind,i)=>(
              <FadeUp key={ind.label} delay={i*0.06}>
                <Link href={`/industries#${ind.id}`} style={{ textDecoration:"none" }}>
                  <div className="card-surface" style={{ padding:0, borderRadius:"12px", overflow:"hidden", transition:"all 0.25s", height:"100%" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,212,255,0.3)";e.currentTarget.style.transform="translateY(-2px)"}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="#1e2d3d";e.currentTarget.style.transform="translateY(0)"}}>
                    <div style={{ height:"140px", backgroundImage:`linear-gradient(180deg, rgba(6,8,15,0.05), rgba(6,8,15,0.72)), url(${ind.image})`, backgroundSize:"cover", backgroundPosition:"center" }} />
                    <div style={{ padding:"22px 24px", display:"flex", alignItems:"flex-start", gap:"14px" }}>
                      <div style={{ width:"40px", height:"40px", borderRadius:"9px", background:"rgba(0,212,255,0.08)", border:"1px solid rgba(0,212,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <ind.icon size={18} color="#00d4ff" />
                      </div>
                      <div>
                        <h3 style={{ fontSize:"0.95rem", fontWeight:700, color:"#f0f6ff", marginBottom:"6px" }}>{ind.label}</h3>
                        <p style={{ fontSize:"0.82rem", color:"#8ba3bd", lineHeight:1.6 }}>{ind.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* DEMOS */}
      <section style={{ padding:"100px 24px" }}>
        <div style={S}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>Showcase</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.75rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"56px" }}>See the systems in action</h2>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"20px" }}>
            {demos.map((demo,i)=>(
              <FadeUp key={demo.title} delay={i*0.07}>
                <div style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"12px", overflow:"hidden", transition:"border-color 0.25s" }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(0,212,255,0.3)")}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor="#1e2d3d")}>
                  <div style={{ height:"160px", background:"linear-gradient(135deg,#0d1421,#111c2a)", borderBottom:"1px solid #1e2d3d", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                    <div aria-hidden="true" style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)", backgroundSize:"30px 30px" }} />
                    <div style={{ width:"48px", height:"48px", borderRadius:"50%", background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Bot size={22} color="#00d4ff" />
                    </div>
                  </div>
                  <div style={{ padding:"20px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
                      <span style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.1em", color:demo.status==="Live Demo"?"#00d4ff":"#4d6478", textTransform:"uppercase" }}>{demo.status}</span>
                      <span style={{ fontSize:"0.7rem", color:"#4d6478", border:"1px solid #1e2d3d", borderRadius:"100px", padding:"2px 10px" }}>{demo.tag}</span>
                    </div>
                    <h3 style={{ fontSize:"0.95rem", fontWeight:700, color:"#f0f6ff" }}>{demo.title}</h3>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section style={{ padding:"100px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", borderBottom:"1px solid #1e2d3d" }}>
        <div style={S}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>Results</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.75rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"56px" }}>Real systems. Measurable outcomes.</h2>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))", gap:"24px" }}>
            {caseStudies.map((cs,i)=>(
              <FadeUp key={cs.title} delay={i*0.1}>
                <div style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"16px", padding:"36px", height:"100%", display:"flex", flexDirection:"column", gap:"24px" }}>
                  <div>
                    <span style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#00d4ff", display:"block", marginBottom:"12px" }}>{cs.industry}</span>
                    <h3 style={{ fontSize:"1.15rem", fontWeight:700, color:"#f0f6ff", lineHeight:1.4 }}>{cs.title}</h3>
                  </div>
                  <ul style={{ listStyle:"none", padding:0, margin:0, flex:1 }}>
                    {cs.results.map(r=>(
                      <li key={r} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"10px", fontSize:"0.875rem", color:"#8ba3bd", lineHeight:1.6 }}>
                        <CheckCircle size={15} color="#00d4ff" style={{ flexShrink:0, marginTop:"2px" }} />{r}
                      </li>
                    ))}
                  </ul>
                  <div style={{ borderTop:"1px solid #1e2d3d", paddingTop:"20px" }}>
                    <p style={{ fontSize:"1.4rem", fontWeight:800, color:"#00d4ff", letterSpacing:"-0.02em", lineHeight:1.2, marginBottom:"4px" }}>{cs.metric}</p>
                    <p style={{ fontSize:"0.8rem", color:"#4d6478" }}>{cs.metricSub}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
          <div style={{ ...centered, marginTop:"40px" }}>
            <FadeUp><Link href="/case-studies" style={{ display:"inline-flex", alignItems:"center", gap:"8px", color:"#00d4ff", fontSize:"0.9rem", fontWeight:600, textDecoration:"none" }}>View all case studies <ArrowRight size={15} /></Link></FadeUp>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding:"100px 24px" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>Pricing</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.75rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"12px" }}>Clear packages. No ambiguity.</h2>
            <p style={{ ...centered, color:"#8ba3bd", maxWidth:"480px", margin:"0 auto 56px", lineHeight:1.7 }}>Every build is scoped to your exact business. Book a call and we&apos;ll confirm the right package.</p>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"20px", alignItems:"start" }}>
            {pricingPlans.map((plan,i)=>(
              <FadeUp key={plan.name} delay={i*0.08}>
                <div style={{ background:plan.highlighted?"rgba(0,212,255,0.05)":"#0f1620", border:plan.highlighted?"1px solid rgba(0,212,255,0.4)":"1px solid #1e2d3d", borderRadius:"16px", padding:"32px", position:"relative", boxShadow:plan.highlighted?"0 0 40px rgba(0,212,255,0.08)":"none" }}>
                  {plan.highlighted && (
                    <div style={{ position:"absolute", top:"-12px", left:"50%", transform:"translateX(-50%)", background:"#00d4ff", color:"#06080f", fontSize:"0.65rem", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", padding:"4px 16px", borderRadius:"100px", whiteSpace:"nowrap" }}>Most Popular</div>
                  )}
                  <p style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4d6478", marginBottom:"8px" }}>{plan.tag}</p>
                  <h3 style={{ fontSize:"1.15rem", fontWeight:800, color:"#f0f6ff", marginBottom:"20px" }}>{plan.name}</h3>
                  <div style={{ marginBottom:"24px" }}>
                    <p style={{ fontSize:"1.6rem", fontWeight:800, color:plan.highlighted?"#00d4ff":"#f0f6ff", letterSpacing:"-0.02em", lineHeight:1, marginBottom:"4px" }}>{plan.price}</p>
                    <p style={{ fontSize:"0.78rem", color:"#4d6478" }}>{plan.period}</p>
                  </div>
                  <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px" }}>
                    {plan.features.map(f=>(
                      <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"10px", fontSize:"0.85rem", color:"#8ba3bd", lineHeight:1.55 }}>
                        <CheckCircle size={14} color={plan.highlighted?"#00d4ff":"#4d6478"} style={{ flexShrink:0, marginTop:"2px" }} />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/evaluation" style={{ display:"block", textAlign:"center", padding:"12px", fontSize:"0.9rem", fontWeight:700, borderRadius:"9px", textDecoration:"none", transition:"all 0.2s", background:plan.highlighted?"#00d4ff":"transparent", color:plan.highlighted?"#06080f":"#f0f6ff", border:plan.highlighted?"1px solid #00d4ff":"1px solid #1e2d3d" }}
                    onMouseEnter={e=>{if(!plan.highlighted){(e.currentTarget as HTMLElement).style.borderColor="rgba(0,212,255,0.4)";(e.currentTarget as HTMLElement).style.color="#00d4ff"}}}
                    onMouseLeave={e=>{if(!plan.highlighted){(e.currentTarget as HTMLElement).style.borderColor="#1e2d3d";(e.currentTarget as HTMLElement).style.color="#f0f6ff"}}}>
                    {plan.cta}
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding:"100px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"760px", margin:"0 auto" }}>
          <FadeUp>
            <p className="section-label" style={{ ...centered, marginBottom:"16px" }}>FAQ</p>
            <h2 style={{ fontSize:"clamp(1.75rem,4vw,2.5rem)", fontWeight:800, letterSpacing:"-0.03em", ...centered, color:"#f0f6ff", marginBottom:"56px" }}>Questions we hear every week</h2>
          </FadeUp>
          {faqs.map((faq,i)=>(
            <FadeUp key={i} delay={i*0.04}><FAQItem q={faq.q} a={faq.a} /></FadeUp>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding:"120px 24px", ...centered, position:"relative", overflow:"hidden" }}>
        <div aria-hidden="true" style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"700px", height:"400px", background:"radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)", pointerEvents:"none" }} />
        <FadeUp>
          <p className="section-label" style={{ marginBottom:"20px" }}>Get Started</p>
          <h2 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#f0f6ff", marginBottom:"20px" }}>
            Ready to hire your first <span className="gradient-text">AI employee?</span>
          </h2>
          <p style={{ color:"#8ba3bd", fontSize:"1.05rem", maxWidth:"460px", margin:"0 auto 40px", lineHeight:1.7 }}>
            Book a free 30-minute strategy call. We&apos;ll map out the highest-leverage automation for your business — no pitch, just clarity.
          </p>
          <Link href="/evaluation" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"16px 40px", fontSize:"1rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"12px", textDecoration:"none", boxShadow:"0 0 40px rgba(0,212,255,0.3)", transition:"box-shadow 0.2s" }}
            onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 0 60px rgba(0,212,255,0.5)")}
            onMouseLeave={e=>(e.currentTarget.style.boxShadow="0 0 40px rgba(0,212,255,0.3)")}>
            Book a Free Strategy Call <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
        </FadeUp>
      </section>
    </div>
  );
}
