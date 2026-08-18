"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bot, Headphones, MessageSquare, Mic, Database, FileText,
  BarChart2, Calendar, ArrowRight, CheckCircle,
} from "@/components/admin/ServerIcons";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>{children}</motion.div>;
}

const allServices = [
  { id:"ai-sales-agent", icon:Bot, title:"AI Sales Agent", tagline:"Your best salesperson doesn't sleep.", desc:"A conversational AI that qualifies leads, handles objections, answers approved buying questions and books meetings around the clock.", bullets:["Lead qualification and scoring","Objection handling","Appointment booking","CRM sync","Human handoff"] },
  { id:"ai-customer-support", icon:Headphones, title:"AI Customer Support Agent", tagline:"Instant answers. Zero queue.", desc:"Resolve FAQs, handle routine support requests and escalate edge cases across the channels your customers already use.", bullets:["24/7 support","Ticket routing","Escalation","Knowledge base","Human takeover"] },
  { id:"whatsapp", icon:MessageSquare, title:"WhatsApp AI Assistant", tagline:"Your business runs on WhatsApp. Your AI should too.", desc:"Automate WhatsApp conversations from first enquiry through qualification, support, booking and follow-up using the approved business API.", bullets:["WhatsApp Business API","Lead intake","Q&A","Follow-up","Media sharing"] },
  { id:"telegram", icon:MessageSquare, title:"Telegram AI Assistant", tagline:"Bots with actual intelligence.", desc:"AI-powered Telegram systems for customer engagement, lead handling, notifications and internal business workflows.", bullets:["Customer chat","Notifications","Lead handling","Internal automation","Broadcast workflows"] },
  { id:"voice", icon:Mic, title:"AI Voice Agent", tagline:"Every call answered. Every lead captured.", desc:"An AI that can handle configured inbound or outbound calls, qualify callers, book appointments and hand off important conversations.", bullets:["Inbound calls","Outbound calls","Scheduling","Qualification","Call summaries"] },
  { id:"crm", icon:Database, title:"CRM Automation", tagline:"Your CRM should fill itself.", desc:"Connect lead capture, conversations, qualification and follow-up so your CRM stays current without manual data entry.", bullets:["Lead capture","Stage updates","Follow-up triggers","Pipeline reporting","CRM integrations"] },
  { id:"lead-generation", icon:BarChart2, title:"Lead Generation Engine", tagline:"Prospecting and qualification on autopilot.", desc:"Discover relevant public business prospects, enrich records, qualify them and pass sales-ready leads into connected outreach workflows.", bullets:["Targeted prospecting","Enrichment","Deduplication","Lead scoring","Sales alerts"] },
  { id:"calendar-email", icon:Calendar, title:"Calendar & Email Automation", tagline:"Outreach that runs itself.", desc:"Automate email sequences, appointment reminders, booking flows and calendar-driven follow-up so opportunities keep moving.", bullets:["Email sequences","Reminders","No-show follow-up","Proposal follow-up","Calendar sync"] },
  { id:"email-follow-up", icon:FileText, title:"Email Follow-up Automation", tagline:"Every lead gets the right next message.", desc:"Give cold, warm and hot leads different follow-up paths based on behaviour, interest, timing and qualification state.", bullets:["Cold nurture","Warm follow-up","Hot lead prompts","Reply tracking","Reusable campaigns"] },
];

export default function ServicesClient() {
  return (
    <div style={{ background:"#090510", color:"#f7f0ff" }}>
      <section style={{ padding:"150px 20px 80px", background:"radial-gradient(circle at 50% 0%,rgba(168,85,247,.18),transparent 42%),linear-gradient(180deg,#10091a 0%,#090510 100%)", borderBottom:"1px solid rgba(168,85,247,.22)" }}>
        <div style={{ maxWidth:760, margin:"0 auto", textAlign:"center" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.6}}>
            <p style={{ marginBottom:16, color:"#c084fc", fontSize:".75rem", fontWeight:900, letterSpacing:".18em", textTransform:"uppercase" }}>Fluxknight services</p>
            <h1 style={{ fontSize:"clamp(2.2rem,7vw,4.6rem)", fontWeight:950, letterSpacing:"-.055em", lineHeight:1.02, marginBottom:20 }}>AI systems built around your business.</h1>
            <p style={{ fontSize:"1rem", color:"#b9a8c9", lineHeight:1.75, maxWidth:650, margin:"0 auto" }}>Explore what each system does, how it works, what your business gains and what the client dashboard can track. You can start with the service or let Fluxknight evaluate the right combination for you.</p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding:"70px 20px 100px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
          {allServices.map((s,i)=>(
            <FadeUp key={s.id} delay={i*.035}>
              <article id={s.id} style={{ background:"#10091a", border:"1px solid rgba(168,85,247,.24)", borderRadius:18, padding:"clamp(22px,4vw,38px)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:40, alignItems:"start" }} className="service-card">
                <div>
                  <div style={{ width:48, height:48, borderRadius:13, background:"rgba(168,85,247,.12)", border:"1px solid rgba(168,85,247,.3)", display:"grid", placeItems:"center", marginBottom:18 }}><s.icon size={22} color="#c084fc" /></div>
                  <p style={{ fontSize:".7rem", fontWeight:900, letterSpacing:".14em", textTransform:"uppercase", color:"#c084fc", marginBottom:8 }}>{s.tagline}</p>
                  <h2 style={{ fontSize:"1.55rem", fontWeight:900, letterSpacing:"-.025em", marginBottom:14 }}>{s.title}</h2>
                  <p style={{ fontSize:".94rem", color:"#b9a8c9", lineHeight:1.75, margin:0 }}>{s.desc}</p>
                </div>
                <div>
                  <p style={{ fontSize:".7rem", fontWeight:900, letterSpacing:".12em", textTransform:"uppercase", color:"#806e91", marginBottom:14 }}>What&apos;s included</p>
                  <ul style={{ listStyle:"none", padding:0, margin:"0 0 22px" }}>{s.bullets.map(b=><li key={b} style={{ display:"flex", gap:10, marginBottom:10, fontSize:".9rem", color:"#d5c9df", lineHeight:1.5 }}><CheckCircle size={15} color="#c084fc" style={{ flexShrink:0, marginTop:2 }} />{b}</li>)}</ul>
                  <Link href={`/services/${s.id}`} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 17px", fontSize:".86rem", fontWeight:900, color:"white", background:"linear-gradient(135deg,#a855f7,#8b5cf6)", borderRadius:9, textDecoration:"none" }}>
                    View how it works <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            </FadeUp>
          ))}
        </div>
      </section>

      <section style={{ padding:"70px 20px 110px", borderTop:"1px solid rgba(168,85,247,.18)", textAlign:"center" }}>
        <FadeUp>
          <h2 style={{ fontSize:"clamp(1.8rem,5vw,3rem)", fontWeight:900, letterSpacing:"-.04em", marginBottom:14 }}>Not sure which system fits?</h2>
          <p style={{ color:"#b9a8c9", maxWidth:620, margin:"0 auto 28px", lineHeight:1.7 }}>Do not choose a technology because it has the loudest sales copy. Describe the business problem and Fluxknight will evaluate the right architecture.</p>
          <Link href="/evaluation" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"13px 22px", fontWeight:900, color:"white", background:"linear-gradient(135deg,#a855f7,#8b5cf6)", borderRadius:10, textDecoration:"none" }}>Start Business AI Evaluation <ArrowRight size={16} /></Link>
        </FadeUp>
      </section>

      <style>{`@media(max-width:768px){.service-card{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
