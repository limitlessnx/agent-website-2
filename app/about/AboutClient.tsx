"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Zap, Target, Layers, Clock } from "lucide-react";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>
      {children}
    </motion.div>
  );
}

const values = [
  { icon:Target, title:"We build for outcomes, not outputs", desc:"We don't measure success by how complex the system is. We measure it by whether it actually sells, supports, or saves time at your business." },
  { icon:Layers, title:"Vertical depth over generic templates", desc:"Every industry has its own sales language and customer psychology. We go deep on your vertical so the AI sounds like it belongs there." },
  { icon:Clock, title:"Speed without cutting corners", desc:"Most builds are live in 7–14 days. We move fast because we've solved the same problems before — but every system is built specifically for you." },
  { icon:Zap, title:"We stay in the work after launch", desc:"Going live is the beginning, not the end. We monitor, optimize, and improve every system we build — because that's when the real data comes in." },
];

const stack = [
  { name:"n8n", role:"Automation backbone" },
  { name:"OpenAI GPT-4o", role:"AI conversation engine" },
  { name:"Supabase", role:"Database and backend" },
  { name:"Twilio / WhatsApp API", role:"Messaging infrastructure" },
  { name:"Vapi", role:"Voice agent platform" },
  { name:"Calendly / Cal.com", role:"Appointment scheduling" },
  { name:"Next.js", role:"Web interfaces and dashboards" },
  { name:"Vercel", role:"Deployment and hosting" },
];

export default function AboutClient() {
  return (
    <div>
      {/* Hero */}
      <section style={{ padding:"140px 24px 80px", background:"linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"800px", margin:"0 auto" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <p className="section-label" style={{ marginBottom:"16px" }}>About</p>
            <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#f0f6ff", marginBottom:"32px" }}>
              We build AI systems that do the work <span className="gradient-text">humans shouldn&apos;t have to do</span>
            </h1>
            <p style={{ fontSize:"1.1rem", color:"#8ba3bd", lineHeight:1.8, maxWidth:"620px" }}>
              Boundless Flux AI is an AI automation agency. We build custom AI agents and automation systems for businesses that are tired of losing leads to slow response times, burning money on repetitive manual work, and scaling headcount just to keep up with demand.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"800px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"64px", alignItems:"start" }} className="about-grid">
            <FadeUp>
              <div>
                <p className="section-label" style={{ marginBottom:"16px" }}>What We Do</p>
                <h2 style={{ fontSize:"1.5rem", fontWeight:800, color:"#f0f6ff", letterSpacing:"-0.02em", marginBottom:"20px", lineHeight:1.3 }}>We turn business processes into AI-powered systems</h2>
                <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.8, marginBottom:"16px" }}>
                  Most businesses have the same problem: too many leads to handle manually, too many repetitive conversations that eat time, and not enough budget to hire more people.
                </p>
                <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.8, marginBottom:"16px" }}>
                  We solve this by building AI agents that handle the repetitive, high-volume, time-sensitive parts of your sales and support operation — so your human team can focus on the work that actually requires judgment.
                </p>
                <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.8 }}>
                  We work across WhatsApp, Telegram, voice, web chat, email, and CRM — and we connect everything into one coherent system that your business can actually see and control.
                </p>
              </div>
            </FadeUp>
            <FadeUp delay={0.1}>
              <div>
                <p className="section-label" style={{ marginBottom:"16px" }}>Who We Work With</p>
                <h2 style={{ fontSize:"1.5rem", fontWeight:800, color:"#f0f6ff", letterSpacing:"-0.02em", marginBottom:"20px", lineHeight:1.3 }}>Growing businesses with real sales and service volume</h2>
                <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.8, marginBottom:"16px" }}>
                  Our clients are typically small to mid-size businesses that have outgrown manual processes but aren&apos;t ready — or willing — to hire large teams to keep up with demand.
                </p>
                <p style={{ fontSize:"0.9rem", color:"#8ba3bd", lineHeight:1.8 }}>
                  Real estate agencies, computer retailers, service businesses, clinics, e-commerce brands, logistics companies. What they share: sales driven by conversation, support driven by volume, and operations that still run on too many manual steps.
                </p>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding:"80px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <FadeUp>
            <p className="section-label" style={{ textAlign:"center", marginBottom:"16px" }}>How We Work</p>
            <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, letterSpacing:"-0.03em", textAlign:"center", color:"#f0f6ff", marginBottom:"56px" }}>Four things we never compromise on</h2>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"20px" }}>
            {values.map((v,i)=>(
              <FadeUp key={v.title} delay={i*0.07}>
                <div style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"14px", padding:"32px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"10px", background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"20px" }}>
                    <v.icon size={20} color="#00d4ff" />
                  </div>
                  <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#f0f6ff", marginBottom:"10px" }}>{v.title}</h3>
                  <p style={{ fontSize:"0.875rem", color:"#8ba3bd", lineHeight:1.75 }}>{v.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"800px", margin:"0 auto" }}>
          <FadeUp>
            <p className="section-label" style={{ textAlign:"center", marginBottom:"16px" }}>The Stack</p>
            <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, letterSpacing:"-0.03em", textAlign:"center", color:"#f0f6ff", marginBottom:"48px" }}>Built on tools that are production-ready, not experimental</h2>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"12px" }}>
            {stack.map((s,i)=>(
              <FadeUp key={s.name} delay={i*0.05}>
                <div style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"10px", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
                  <span style={{ fontSize:"0.9rem", fontWeight:700, color:"#f0f6ff" }}>{s.name}</span>
                  <span style={{ fontSize:"0.75rem", color:"#4d6478" }}>{s.role}</span>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"80px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", textAlign:"center" }}>
        <FadeUp>
          <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, color:"#f0f6ff", marginBottom:"16px" }}>Ready to work together?</h2>
          <p style={{ color:"#8ba3bd", marginBottom:"32px", lineHeight:1.7, maxWidth:"440px", margin:"0 auto 32px" }}>Book a free 30-minute strategy call and let&apos;s map out the highest-leverage automation for your business.</p>
          <Link href="/contact" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 32px", fontSize:"0.95rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"10px", textDecoration:"none", boxShadow:"0 0 30px rgba(0,212,255,0.25)" }}>
            Book a Free Strategy Call <ArrowRight size={16} />
          </Link>
        </FadeUp>
      </section>

      <style>{`@media (max-width:768px) { .about-grid { grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
