"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle, ArrowRight, X } from "lucide-react";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>
      {children}
    </motion.div>
  );
}

const plans = [
  {
    name:"Starter AI System",
    tag:"One focused automation, deployed fast.",
    price:"Starting at NGN 200,000",
    period:"one-time build fee",
    monthly:"Optional monthly support available",
    highlighted:false,
    features:[
      { text:"1 AI agent (sales, support, or WhatsApp)", included:true },
      { text:"WhatsApp or web chat integration", included:true },
      { text:"Basic lead capture and CRM handoff", included:true },
      { text:"30-day post-launch support", included:true },
      { text:"Conversation flow design", included:true },
      { text:"Multi-channel deployment", included:false },
      { text:"CRM automation and sync", included:false },
      { text:"Analytics dashboard", included:false },
      { text:"Monthly optimization retainer", included:false },
    ],
    cta:"Get Started",
    ideal:"Best for: businesses testing AI automation for the first time",
  },
  {
    name:"Growth Automation System",
    tag:"Full AI-powered sales and support stack.",
    price:"Starting from NGN 500,000",
    period:"one-time build fee",
    monthly:"Includes 60 days of optimization support",
    highlighted:true,
    features:[
      { text:"Up to 3 AI agents (mix and match)", included:true },
      { text:"WhatsApp + Telegram + voice integration", included:true },
      { text:"CRM sync and lead management", included:true },
      { text:"Lead generation and follow-up automation", included:true },
      { text:"Lead scoring and routing", included:true },
      { text:"Multi-channel deployment", included:true },
      { text:"Analytics dashboard", included:true },
      { text:"60-day post-launch support", included:true },
      { text:"Monthly optimization retainer", included:false },
    ],
    cta:"Book a Strategy Call",
    ideal:"Best for: growing businesses ready to automate their full sales and support pipeline",
  },
  {
    name:"Full AI Business OS",
    tag:"End-to-end automation across your whole business.",
    price:"Custom Quote",
    period:"scoped per project",
    monthly:"Includes dedicated monthly retainer",
    highlighted:false,
    features:[
      { text:"Unlimited AI agents", included:true },
      { text:"Full pipeline automation", included:true },
      { text:"Custom CRM and tool integrations", included:true },
      { text:"Voice + chat + email + social", included:true },
      { text:"Lead scoring and routing", included:true },
      { text:"Multi-channel deployment", included:true },
      { text:"Analytics dashboard", included:true },
      { text:"Priority support and SLA", included:true },
      { text:"Monthly optimization retainer", included:true },
    ],
    cta:"Let's Talk",
    ideal:"Best for: established businesses replacing manual processes at scale",
  },
];

const addons = [
  { name:"AI Voice Agent Add-on", price:"From NGN 250,000", desc:"Add inbound or outbound voice calling to any package." },
  { name:"Analytics Dashboard", price:"From NGN 150,000", desc:"Custom reporting dashboard showing leads, conversations, and conversion rates." },
  { name:"Monthly Optimization Retainer", price:"From NGN 100,000/mo", desc:"Ongoing monitoring, A/B testing, and system improvement." },
  { name:"CRM Integration", price:"From NGN 150,000", desc:"Connect your existing CRM (HubSpot, Pipedrive, custom) to the AI system." },
  { name:"Multi-Language Agent", price:"From NGN 200,000", desc:"Train your AI agent to handle conversations in multiple languages." },
  { name:"Content Generation System", price:"From NGN 250,000", desc:"AI pipeline for listings, product pages, emails, and social posts." },
];

const faqs = [
  { q:"Is this a monthly subscription or a one-time build?", a:"The build is a one-time project fee. Monthly support and optimization are optional but recommended — they're how the system keeps improving after launch." },
  { q:"What happens after the build is complete?", a:"You get a fully deployed, tested system and a handoff session showing you how everything works. The optional monthly retainer covers monitoring, optimizations, and new conversation flows as your business evolves." },
  { q:"Can I start with one agent and add more later?", a:"Yes. Most clients start with the Starter package to validate the approach, then expand to Growth once they see results. Systems are built to scale." },
  { q:"Do I need a WhatsApp Business account?", a:"Yes. We help you get set up on the WhatsApp Business API if you don't already have it. This is a requirement for all WhatsApp integrations." },
  { q:"What if my business needs something not listed here?", a:"Book a strategy call. We scope custom systems regularly — the packages are starting points, not limits." },
];

export default function PricingClient() {
  return (
    <div>
      {/* Hero */}
      <section style={{ padding:"140px 24px 80px", background:"linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"680px", margin:"0 auto", textAlign:"center" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <p className="section-label" style={{ marginBottom:"16px" }}>Pricing</p>
            <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#f0f6ff", marginBottom:"20px" }}>
              Transparent pricing. <span className="gradient-text">Custom systems.</span>
            </h1>
            <p style={{ fontSize:"1.05rem", color:"#8ba3bd", lineHeight:1.7 }}>
              Every build is scoped to your exact workflow. Prices below are starting points — book a call and we&apos;ll give you an exact number within 24 hours.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plans */}
      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:"20px", alignItems:"start" }}>
            {plans.map((plan,i)=>(
              <FadeUp key={plan.name} delay={i*0.08}>
                <div style={{ background:plan.highlighted?"rgba(0,212,255,0.04)":"#0f1620", border:plan.highlighted?"1px solid rgba(0,212,255,0.45)":"1px solid #1e2d3d", borderRadius:"18px", overflow:"hidden", position:"relative", boxShadow:plan.highlighted?"0 0 50px rgba(0,212,255,0.07)":"none" }}>
                  {plan.highlighted && (
                    <div style={{ background:"#00d4ff", padding:"8px 24px", textAlign:"center" }}>
                      <span style={{ fontSize:"0.68rem", fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:"#06080f" }}>Most Popular</span>
                    </div>
                  )}
                  <div style={{ padding:"32px" }}>
                    <p style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4d6478", marginBottom:"6px" }}>{plan.tag}</p>
                    <h2 style={{ fontSize:"1.2rem", fontWeight:800, color:"#f0f6ff", marginBottom:"24px" }}>{plan.name}</h2>
                    <div style={{ marginBottom:"8px" }}>
                      <p style={{ fontSize:"1.75rem", fontWeight:900, color:plan.highlighted?"#00d4ff":"#f0f6ff", letterSpacing:"-0.03em", lineHeight:1 }}>{plan.price}</p>
                      <p style={{ fontSize:"0.78rem", color:"#4d6478", marginTop:"4px" }}>{plan.period}</p>
                    </div>
                    <p style={{ fontSize:"0.78rem", color:"#4d6478", marginBottom:"28px", paddingBottom:"28px", borderBottom:"1px solid #1e2d3d" }}>{plan.monthly}</p>

                    <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px" }}>
                      {plan.features.map(f=>(
                        <li key={f.text} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"10px", fontSize:"0.85rem", color:f.included?"#8ba3bd":"#2a3f55", lineHeight:1.55 }}>
                          {f.included
                            ? <CheckCircle size={14} color="#00d4ff" style={{ flexShrink:0, marginTop:"2px" }} />
                            : <X size={14} color="#2a3f55" style={{ flexShrink:0, marginTop:"2px" }} />
                          }
                          {f.text}
                        </li>
                      ))}
                    </ul>

                    <Link href="/contact" style={{ display:"block", textAlign:"center", padding:"13px", fontSize:"0.9rem", fontWeight:700, borderRadius:"10px", textDecoration:"none", transition:"all 0.2s", background:plan.highlighted?"#00d4ff":"transparent", color:plan.highlighted?"#06080f":"#f0f6ff", border:plan.highlighted?"1px solid #00d4ff":"1px solid #1e2d3d", marginBottom:"16px" }}
                      onMouseEnter={e=>{if(!plan.highlighted){(e.currentTarget as HTMLElement).style.borderColor="rgba(0,212,255,0.4)";(e.currentTarget as HTMLElement).style.color="#00d4ff"}}}
                      onMouseLeave={e=>{if(!plan.highlighted){(e.currentTarget as HTMLElement).style.borderColor="#1e2d3d";(e.currentTarget as HTMLElement).style.color="#f0f6ff"}}}>
                      {plan.cta}
                    </Link>
                    <p style={{ fontSize:"0.75rem", color:"#4d6478", textAlign:"center", lineHeight:1.5 }}>{plan.ideal}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section style={{ padding:"80px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", borderBottom:"1px solid #1e2d3d" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <FadeUp>
            <p className="section-label" style={{ textAlign:"center", marginBottom:"16px" }}>Add-ons</p>
            <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, letterSpacing:"-0.03em", textAlign:"center", color:"#f0f6ff", marginBottom:"48px" }}>Extend any package</h2>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:"16px" }}>
            {addons.map((a,i)=>(
              <FadeUp key={a.name} delay={i*0.06}>
                <div style={{ background:"#0f1620", border:"1px solid #1e2d3d", borderRadius:"12px", padding:"24px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"16px" }}>
                  <div>
                    <h3 style={{ fontSize:"0.95rem", fontWeight:700, color:"#f0f6ff", marginBottom:"6px" }}>{a.name}</h3>
                    <p style={{ fontSize:"0.82rem", color:"#8ba3bd", lineHeight:1.6 }}>{a.desc}</p>
                  </div>
                  <span style={{ fontSize:"0.85rem", fontWeight:700, color:"#00d4ff", whiteSpace:"nowrap" }}>{a.price}</span>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding:"80px 24px" }}>
        <div style={{ maxWidth:"700px", margin:"0 auto" }}>
          <FadeUp>
            <p className="section-label" style={{ textAlign:"center", marginBottom:"16px" }}>FAQ</p>
            <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, letterSpacing:"-0.03em", textAlign:"center", color:"#f0f6ff", marginBottom:"48px" }}>Pricing questions answered</h2>
          </FadeUp>
          {faqs.map((f,i)=>(
            <FadeUp key={i} delay={i*0.05}>
              <div style={{ borderBottom:"1px solid #1e2d3d", padding:"24px 0" }}>
                <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#f0f6ff", marginBottom:"10px" }}>{f.q}</h3>
                <p style={{ fontSize:"0.875rem", color:"#8ba3bd", lineHeight:1.75 }}>{f.a}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"80px 24px", background:"#0d1117", borderTop:"1px solid #1e2d3d", textAlign:"center" }}>
        <FadeUp>
          <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.25rem)", fontWeight:800, color:"#f0f6ff", marginBottom:"16px" }}>Get an exact quote for your business</h2>
          <p style={{ color:"#8ba3bd", marginBottom:"32px", lineHeight:1.7, maxWidth:"440px", margin:"0 auto 32px" }}>30-minute call. We scope the system, confirm the price, and you decide — zero pressure.</p>
          <Link href="/contact" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 32px", fontSize:"0.95rem", fontWeight:700, color:"#06080f", background:"#00d4ff", borderRadius:"10px", textDecoration:"none", boxShadow:"0 0 30px rgba(0,212,255,0.25)" }}>
            Book a Free Strategy Call <ArrowRight size={16} />
          </Link>
        </FadeUp>
      </section>
    </div>
  );
}
