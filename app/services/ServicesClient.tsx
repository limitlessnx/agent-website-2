"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bot, Headphones, MessageSquare, Mic, Database, FileText,
  BarChart2, Calendar, ArrowRight, CheckCircle,
} from "lucide-react";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>
      {children}
    </motion.div>
  );
}

const allServices = [
  {
    id:"ai-sales-agent",
    icon:Bot,
    title:"AI Sales Agent",
    tagline:"Your best salesperson doesn't sleep.",
    desc:"A custom-trained conversational AI that qualifies leads, handles objections, answers pricing questions, and books meetings — around the clock, across every channel you use.",
    bullets:["Lead qualification and scoring","Objection handling scripts","Appointment booking via Calendly or Cal.com","CRM sync after every conversation","Human handoff triggers for hot leads"],
  },
  {
    id:"ai-customer-support",
    icon:Headphones,
    title:"AI Customer Support Agent",
    tagline:"Instant answers. Zero queue.",
    desc:"Deploy an AI agent that resolves FAQs, handles complaints, checks order status, and escalates edge cases — without a support team sitting on standby.",
    bullets:["24/7 multi-channel support (chat, WhatsApp, email)","Ticket creation and routing","Sentiment detection and escalation","Custom knowledge base training","Seamless human takeover"],
  },
  {
    id:"whatsapp",
    icon:MessageSquare,
    title:"WhatsApp AI Assistant",
    tagline:"Your business runs on WhatsApp. Your AI should too.",
    desc:"A fully automated WhatsApp agent that manages the entire customer journey — from first message to closed deal — using WhatsApp Business API.",
    bullets:["WhatsApp Business API integration","Lead intake and qualification flows","Product and service Q&A","Automated follow-up sequences","Media and document sharing"],
  },
  {
    id:"telegram",
    icon:MessageSquare,
    title:"Telegram AI Assistant",
    tagline:"Bots with actual intelligence.",
    desc:"AI-powered Telegram bots for customer engagement, admin dashboards, internal notifications, and lead handling — all within your existing Telegram workspace.",
    bullets:["Customer-facing chat agent","Admin notification bots","Internal team automation","Channel broadcast automation","Inline query handling"],
  },
  {
    id:"voice",
    icon:Mic,
    title:"AI Voice Agent",
    tagline:"Every call answered. Every lead captured.",
    desc:"An AI that picks up your phone, carries a natural conversation, books appointments, qualifies callers, and hands off warm leads — all without a receptionist.",
    bullets:["Inbound call handling","Outbound follow-up campaigns","Appointment scheduling","Lead qualification scripts","Post-call CRM logging"],
  },
  {
    id:"crm",
    icon:Database,
    title:"CRM Automation",
    tagline:"Your CRM should fill itself.",
    desc:"Connect your entire lead, sales, and customer pipeline to an automated CRM system that updates every field, triggers follow-ups, and shows you what's happening without manual entry.",
    bullets:["Lead capture from all channels","Automatic deal stage progression","Follow-up sequence triggers","Pipeline reporting dashboards","Integration with major CRMs"],
  },
  {
    id:"lead-capture",
    icon:BarChart2,
    title:"Lead Capture Systems",
    tagline:"Never lose a lead again.",
    desc:"Custom-built lead intake systems that capture, qualify, score, and route every inquiry from your website, ads, WhatsApp, and calls into one clean pipeline.",
    bullets:["Multi-channel lead aggregation","Instant lead notification","Automatic qualification flows","Lead scoring and tagging","Real-time dashboard view"],
  },
  {
    id:"calendar-email",
    icon:Calendar,
    title:"Calendar & Email Automation",
    tagline:"Outreach that runs itself.",
    desc:"Automated email sequences, appointment reminders, follow-up campaigns, and calendar booking flows — so your pipeline moves forward even when you're not working it.",
    bullets:["Multi-step email sequences","Appointment reminders","No-show re-engagement flows","Proposal follow-up automation","Calendar sync across tools"],
  },
  {
    id:"content",
    icon:FileText,
    title:"AI Content System",
    tagline:"Publish without the bottleneck.",
    desc:"An AI pipeline that generates listings, product descriptions, follow-up emails, social posts, and reports from structured inputs — cutting content production time by 80%.",
    bullets:["Property listing generation","Product description writing","Social media post creation","Email copywriting","SEO meta generation"],
  },
];

export default function ServicesClient() {
  return (
    <div>
      {/* Hero */}
      <section style={{ padding:"140px 24px 80px", background:"linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"760px", margin:"0 auto", textAlign:"center" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <p className="section-label" style={{ marginBottom:"16px" }}>Services</p>
            <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#f0f6ff", marginBottom:"20px" }}>
              Every AI system your business needs to <span className="gradient-text">stop leaking revenue</span>
            </h1>
            <p style={{ fontSize:"1.05rem", color:"#8ba3bd", lineHeight:1.7, maxWidth:"580px", margin:"0 auto" }}>
              We build, integrate, and optimize AI agents that work across WhatsApp, voice, web, CRM, and email — all connected to your existing tools.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services list */}
      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"32px" }}>
          {allServices.map((s,i)=>(
            <FadeUp key={s.id} delay={i*0.04}>
              <div id={s.id} style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"16px", padding:"40px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"48px", alignItems:"start" }}
                className="service-card">
                <div>
                  <div style={{ width:"48px", height:"48px", borderRadius:"12px", background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"20px" }}>
                    <s.icon size={22} color="#00d4ff" />
                  </div>
                  <p style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", color:"#00d4ff", marginBottom:"8px" }}>{s.tagline}</p>
                  <h2 style={{ fontSize:"1.5rem", fontWeight:800, color:"#f0f6ff", letterSpacing:"-0.02em", marginBottom:"16px" }}>{s.title}</h2>
                  <p style={{ fontSize:"0.95rem", color:"#8ba3bd", lineHeight:1.75 }}>{s.desc}</p>
                </div>
                <div>
                  <p style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4d6478", marginBottom:"16px" }}>What&apos;s included</p>
                  <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px" }}>
                    {s.bullets.map(b=>(
                      <li key={b} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"12px", fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.6 }}>
                        <CheckCircle size={15} color="#00d4ff" style={{ flexShrink:0, marginTop:"2px" }} />{b}
                      </li>
                    ))}
                  </ul>
                  <Link href="/contact" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"10px 22px", fontSize:"0.875rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"8px", textDecoration:"none" }}>
                    Get this system <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"80px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", textAlign:"center" }}>
        <FadeUp>
          <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, letterSpacing:"-0.03em", color:"#f0f6ff", marginBottom:"16px" }}>Not sure which system fits?</h2>
          <p style={{ color:"#8ba3bd", marginBottom:"32px", lineHeight:1.7 }}>Book a free strategy call. We&apos;ll audit your business and recommend exactly what to build first.</p>
          <Link href="/contact" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 32px", fontSize:"0.95rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"10px", textDecoration:"none", boxShadow:"0 0 30px rgba(0,212,255,0.25)" }}>
            Book a Free Strategy Call <ArrowRight size={16} />
          </Link>
        </FadeUp>
      </section>

      <style>{`
        @media (max-width:768px) {
          .service-card { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  );
}
