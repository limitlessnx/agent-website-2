"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Building2, Monitor, ShoppingCart, Stethoscope, Truck, Briefcase, ArrowRight, CheckCircle } from "lucide-react";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>
      {children}
    </motion.div>
  );
}

const industries = [
  {
    id:"real-estate",
    icon:Building2,
    label:"Real Estate",
    headline:"Capture every lead. Book every viewing.",
    desc:"Real estate runs on speed. The agent who responds first wins the listing. We build AI systems that respond to every inquiry in seconds, 24/7 — on WhatsApp, web, or phone — qualify buyers and sellers automatically, send matching property details instantly, and book viewings without agent involvement.",
    useCases:["WhatsApp AI assistant for property inquiries","AI voice agent for inbound calls","Automated follow-up for cold leads","CRM sync after every conversation","Lead scoring by budget and intent","Inspection booking automation"],
  },
  {
    id:"computer-sales",
    icon:Monitor,
    label:"Computer Sales & Repair",
    headline:"Answer every question. Close more sales.",
    desc:"Computer buyers ask dozens of technical questions before committing. We build AI agents that know your entire product catalog, answer compatibility and spec questions, check stock in real time, qualify buyers by budget and urgency, and pass hot leads to a human closer — all automatically.",
    useCases:["Product Q&A agent","Stock availability checker","Buyer qualification flows","WhatsApp sales agent","Repair status bot","After-hours lead capture"],
  },
  {
    id:"e-commerce",
    icon:ShoppingCart,
    label:"E-commerce",
    headline:"Recover carts. Increase order value. Reduce returns.",
    desc:"E-commerce brands bleed revenue through abandoned carts, slow support, and manual reorder follow-ups. We build AI systems that handle order support instantly, re-engage abandoned cart customers via WhatsApp, upsell on post-purchase flows, and automate returns and exchanges.",
    useCases:["Abandoned cart recovery via WhatsApp","Order status and tracking bot","AI customer support agent","Post-purchase upsell flows","Return and exchange automation","Review collection sequences"],
  },
  {
    id:"clinics",
    icon:Stethoscope,
    label:"Clinics",
    headline:"Fill your schedule. Reduce no-shows.",
    desc:"Clinics lose revenue to missed calls, no-shows, and manual appointment booking. We build AI agents that answer patient inquiries, book appointments 24/7, send reminders across WhatsApp and SMS, handle cancellations and rescheduling, and run pre-visit intake — all without front desk involvement.",
    useCases:["24/7 appointment booking agent","No-show reminder sequences","Patient intake automation","WhatsApp patient support","Cancellation and reschedule flows","Post-appointment follow-up"],
  },
  {
    id:"logistics",
    icon:Truck,
    label:"Logistics",
    headline:"Less manual tracking. More operational clarity.",
    desc:"Logistics teams spend hours on status updates, driver coordination, and customer calls that AI can handle instantly. We build systems that give customers real-time shipment visibility, automate driver notifications, escalate delivery exceptions, and surface operational data in a dashboard.",
    useCases:["Shipment tracking bot","Customer status update agent","Driver notification system","Delivery exception escalation","ETA update automation","Operations dashboard"],
  },
  {
    id:"professional-services",
    icon:Briefcase,
    label:"Professional Services",
    headline:"Qualify faster. Follow up smarter.",
    desc:"Service businesses waste time on unqualified consultations and manual follow-up. We build AI systems that pre-qualify prospects through a conversation, book discovery calls only with the right people, send proposal follow-ups automatically, and keep your pipeline moving without manual work.",
    useCases:["Lead qualification agent","Discovery call booking automation","Proposal follow-up sequences","Client onboarding flows","Testimonial and review requests","Contract signature reminders"],
  },
];

export default function IndustriesClient() {
  return (
    <div>
      <section style={{ padding:"140px 24px 80px", background:"linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"760px", margin:"0 auto", textAlign:"center" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <p className="section-label" style={{ marginBottom:"16px" }}>Industries</p>
            <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#f0f6ff", marginBottom:"20px" }}>
              We go <span className="gradient-text">vertical-deep</span>, not generic
            </h1>
            <p style={{ fontSize:"1.05rem", color:"#8ba3bd", lineHeight:1.7 }}>
              Every AI system is built around how your industry sells, supports, and operates — not a generic template reskined with your logo.
            </p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"32px" }}>
          {industries.map((ind,i)=>(
            <FadeUp key={ind.id} delay={i*0.04}>
              <div id={ind.id} style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"16px", padding:"40px" }} className="ind-card">
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"48px" }} className="ind-grid">
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
                      <div style={{ width:"44px", height:"44px", borderRadius:"10px", background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <ind.icon size={20} color="#00d4ff" />
                      </div>
                      <span className="section-label">{ind.label}</span>
                    </div>
                    <h2 style={{ fontSize:"1.4rem", fontWeight:800, color:"#f0f6ff", letterSpacing:"-0.02em", marginBottom:"16px", lineHeight:1.3 }}>{ind.headline}</h2>
                    <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.8 }}>{ind.desc}</p>
                    <Link href="/contact" style={{ display:"inline-flex", alignItems:"center", gap:"8px", marginTop:"24px", padding:"10px 22px", fontSize:"0.875rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"8px", textDecoration:"none" }}>
                      Build for {ind.label} <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div>
                    <p style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4d6478", marginBottom:"16px" }}>Use cases</p>
                    <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                      {ind.useCases.map(u=>(
                        <li key={u} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"12px", fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.6 }}>
                          <CheckCircle size={15} color="#00d4ff" style={{ flexShrink:0, marginTop:"2px" }} />{u}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width:768px) {
          .ind-grid { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  );
}
