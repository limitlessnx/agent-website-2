"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>
      {children}
    </motion.div>
  );
}

const cases = [
  {
    industry:"Real Estate",
    title:"AI Property Assistant That Books Viewings on Autopilot",
    client:"Mid-size real estate agency covering 3 states",
    challenge:"The agency was losing leads to faster competitors. Agents couldn't respond to WhatsApp inquiries after hours, leading to significant lost viewing bookings and cold lead drop-off.",
    solution:"We built a WhatsApp AI assistant trained on the agency's entire property portfolio. The agent qualifies buyers by budget and location preference, sends matching listings with photos and details, and books inspection appointments directly into the calendar.",
    stack:["WhatsApp Business API","n8n automation workflows","OpenAI GPT-4o","Supabase (lead database)","Calendly (appointment booking)","Google Sheets (property listings sync)"],
    results:["Responds to every WhatsApp inquiry within 3 seconds, 24/7","Qualifies buyer intent and budget before booking a viewing","Sends up to 5 matching listings per inquiry automatically","Books inspection appointments without agent involvement","Follows up with unresponsive leads on days 2, 5, 10, and 21","Syncs every lead and interaction to the CRM automatically"],
    metrics:[{n:"3×",label:"More booked viewings in 60 days"},{n:"<3s",label:"Average response time"},{n:"100%",label:"Leads captured and logged"},{n:"21-day",label:"Automated follow-up sequence"}],
  },
  {
    industry:"Computer Sales & Repair",
    title:"AI Sales Agent for a Computer Store That Closes While You Sleep",
    client:"Multi-branch computer retail and repair business",
    challenge:"The store received dozens of product questions daily via WhatsApp and their website. Staff couldn't respond to after-hours inquiries, and valuable warm leads went cold by morning.",
    solution:"We built a WhatsApp and web chat AI sales agent trained on the store's full product catalog. The agent answers technical questions, checks stock availability via API, qualifies buyers by budget and use case, and passes hot leads with full conversation context to a human closer.",
    stack:["WhatsApp Business API","Web chat widget (custom)","n8n automation","OpenAI GPT-4o","Supabase (product + lead database)","Custom stock API integration"],
    results:["Handles all product Q&A across WhatsApp and website","Checks real-time stock levels before confirming availability","Qualifies buyers with budget and intended use questions","Scores leads and routes high-intent buyers to human closers","Sends follow-up message if buyer goes quiet mid-conversation","Logs every inquiry into CRM with qualification notes"],
    metrics:[{n:"67%",label:"After-hours inquiries converted"},{n:"0min",label:"Average response time"},{n:"4hrs",label:"Saved per day in manual Q&A"},{n:"40%",label:"Increase in qualified leads"}],
  },
];

export default function CaseStudiesClient() {
  return (
    <div>
      <section style={{ padding:"140px 24px 80px", background:"linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"760px", margin:"0 auto", textAlign:"center" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <p className="section-label" style={{ marginBottom:"16px" }}>Case Studies</p>
            <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#f0f6ff", marginBottom:"20px" }}>
              The <span className="gradient-text">systems we&apos;ve built</span> and what they actually did
            </h1>
            <p style={{ fontSize:"1.05rem", color:"#8ba3bd", lineHeight:1.7 }}>No vague testimonials. Real systems, real stacks, real numbers.</p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"1000px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"56px" }}>
          {cases.map((c,i)=>(
            <FadeUp key={c.title} delay={i*0.05}>
              <article style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"20px", overflow:"hidden" }}>
                {/* Header */}
                <div style={{ padding:"36px 40px", borderBottom:"1px solid #1e2d3d" }}>
                  <span className="section-label" style={{ display:"block", marginBottom:"12px" }}>{c.industry}</span>
                  <h2 style={{ fontSize:"clamp(1.25rem,2.5vw,1.75rem)", fontWeight:800, color:"#f0f6ff", letterSpacing:"-0.02em", lineHeight:1.3, marginBottom:"8px" }}>{c.title}</h2>
                  <p style={{ fontSize:"0.85rem", color:"#4d6478" }}>{c.client}</p>
                </div>

                {/* Metrics */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", borderBottom:"1px solid #1e2d3d" }}>
                  {c.metrics.map((m,mi)=>(
                    <div key={m.label} style={{ padding:"24px 28px", borderRight:mi<c.metrics.length-1?"1px solid #1e2d3d":"none" }}>
                      <p style={{ fontSize:"1.6rem", fontWeight:800, color:"#00d4ff", letterSpacing:"-0.02em", lineHeight:1, marginBottom:"6px" }}>{m.n}</p>
                      <p style={{ fontSize:"0.78rem", color:"#4d6478", lineHeight:1.4 }}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div style={{ padding:"40px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"40px" }} className="cs-grid">
                  <div style={{ display:"flex", flexDirection:"column", gap:"28px" }}>
                    <div>
                      <p style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4d6478", marginBottom:"10px" }}>The Challenge</p>
                      <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.75 }}>{c.challenge}</p>
                    </div>
                    <div>
                      <p style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4d6478", marginBottom:"10px" }}>The Solution</p>
                      <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.75 }}>{c.solution}</p>
                    </div>
                    <div>
                      <p style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4d6478", marginBottom:"10px" }}>Tech Stack</p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                        {c.stack.map(s=>(
                          <span key={s} style={{ fontSize:"0.75rem", color:"#8ba3bd", border:"1px solid #1e2d3d", borderRadius:"6px", padding:"4px 10px" }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4d6478", marginBottom:"16px" }}>What the System Does</p>
                    <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                      {c.results.map(r=>(
                        <li key={r} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"12px", fontSize:"0.875rem", color:"#8ba3bd", lineHeight:1.65 }}>
                          <CheckCircle size={15} color="#00d4ff" style={{ flexShrink:0, marginTop:"2px" }} />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </FadeUp>
          ))}
        </div>
      </section>

      <section style={{ padding:"80px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", textAlign:"center" }}>
        <FadeUp>
          <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, color:"#f0f6ff", marginBottom:"16px" }}>Want results like these?</h2>
          <p style={{ color:"#8ba3bd", marginBottom:"32px", lineHeight:1.7 }}>Book a free strategy call and we&apos;ll scope the right system for your business.</p>
          <Link href="/contact" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 32px", fontSize:"0.95rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"10px", textDecoration:"none", boxShadow:"0 0 30px rgba(0,212,255,0.25)" }}>
            Book a Free Strategy Call <ArrowRight size={16} />
          </Link>
        </FadeUp>
      </section>

      <style>{`@media (max-width:768px) { .cs-grid { grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
