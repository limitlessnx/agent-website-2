"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Building2, ShoppingCart, Stethoscope, Truck, Briefcase, ArrowRight, CheckCircle } from "lucide-react";

function FadeUp({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:0.6,delay,ease:[0.16,1,0.3,1]}}>
      {children}
    </motion.div>
  );
}

const industries = [
  { id:"hotels", icon:Building2, label:"Hotels", image:"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80", headline:"Turn inquiries into bookings without waiting on the front desk.", desc:"Hotels lose revenue when guests wait for room availability, pricing, amenities, airport pickup details, or reservation changes. Fluxknight builds AI agents that answer guest questions instantly, qualify group booking requests, recover abandoned booking interest, and notify staff when a high-value guest needs human attention.", useCases:["Website and WhatsApp booking assistant","Room and amenities Q&A","Guest request triage","Group booking qualification","Review request automation","Hot lead alerts for reservations teams"] },
  { id:"restaurants", icon:ShoppingCart, label:"Restaurants", image:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80", headline:"Handle reservations, orders, catering leads, and repeat customers.", desc:"Restaurants need speed, accuracy, and repeat business. We build AI systems that answer menu questions, capture catering requests, take reservation inquiries, promote offers, and follow up with customers so your team can focus on service instead of repetitive messages.", useCases:["Reservation request automation","Menu and opening-hours Q&A","Catering lead qualification","Customer reactivation campaigns","Review and feedback collection","WhatsApp order support"] },
  { id:"clinics", icon:Stethoscope, label:"Clinics", image:"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80", headline:"Fill your schedule and reduce missed appointments.", desc:"Clinics lose revenue to missed calls, manual booking, and poor reminders. Fluxknight builds AI agents that answer patient inquiries, collect intake details, book appointments, send reminders, handle rescheduling, and route urgent cases to staff.", useCases:["24/7 appointment booking","Patient intake automation","No-show reminder sequences","Cancellation and reschedule flows","Treatment inquiry qualification","Post-appointment follow-up"] },
  { id:"sales-companies", icon:Briefcase, label:"Sales Companies", image:"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80", headline:"Find leads, qualify buyers, and follow up until the deal is ready.", desc:"Sales teams need consistent prospecting and disciplined follow-up. We build lead generation systems that find targeted public business data, enrich prospects, run outreach sequences, score replies as cold, warm, or hot, and alert your team when a prospect is ready for a closer.", useCases:["Targeted lead discovery","Outbound campaign automation","Warm and hot lead tagging","Follow-up sequence management","Lead scoring and routing","Sales rep notification workflows"] },
  { id:"real-estate", icon:Building2, label:"Real Estate", image:"https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80", headline:"Capture every buyer, seller, landlord, and tenant inquiry.", desc:"Real estate moves fast. We build AI systems that respond to property inquiries in seconds, qualify buyers by budget and urgency, send matching property details, book inspections, and continue follow-up until the lead is ready.", useCases:["Property inquiry assistant","Inspection booking automation","Buyer and tenant qualification","Listing recommendation flows","Customer record sync after every conversation","Long-term nurture for cold leads"] },
  { id:"gyms", icon:Briefcase, label:"Gyms", image:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80", headline:"Convert trial interest into memberships and keep members engaged.", desc:"Gyms grow when they respond quickly and follow up consistently. Fluxknight builds AI systems that answer membership questions, book trial sessions, recover old leads, remind members about renewals, and promote classes or personal training offers.", useCases:["Trial booking assistant","Membership Q&A","Lead reactivation campaigns","Renewal reminders","Class and trainer promotion","Feedback and review collection"] },
  { id:"services", icon:Briefcase, label:"Services", image:"https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80", headline:"Qualify service requests before they reach your team.", desc:"Service businesses waste time answering the same questions and chasing prospects who are not ready. We build AI agents that collect job details, estimate intent, recommend the next step, book consultations, and trigger follow-up based on urgency.", useCases:["Service request intake","Quote qualification","Consultation booking","Automated estimate follow-up","Customer support automation","Review request workflows"] },
  { id:"auto-shops", icon:Truck, label:"Auto Shops", image:"https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=900&q=80", headline:"Book repairs, answer service questions, and recover repeat customers.", desc:"Auto shops need fast intake and reliable reminders. We build AI systems that collect vehicle details, explain services, book repair slots, send maintenance reminders, and follow up with customers who asked for quotes but never came in.", useCases:["Repair booking assistant","Vehicle detail intake","Quote follow-up automation","Maintenance reminder campaigns","Parts and service Q&A","Customer status update flows"] },
  { id:"ecommerce", icon:ShoppingCart, label:"E-commerce", image:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80", headline:"Recover carts, support buyers, and grow repeat purchases.", desc:"E-commerce brands leak revenue through abandoned carts, slow support, and inconsistent post-purchase follow-up. Fluxknight builds AI agents that answer product questions, recover abandoned carts, recommend products, automate order support, and bring customers back with email or WhatsApp campaigns.", useCases:["Abandoned cart recovery","Product recommendation agent","Order status support","Return and exchange automation","Post-purchase upsells","Customer win-back sequences"] },
  { id:"professional-services", icon:Briefcase, label:"Professional Services", image:"https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80", headline:"Turn expertise into a cleaner, faster sales pipeline.", desc:"Professional firms need qualified consultations, clean follow-up, and a polished client experience. We build AI systems that pre-qualify prospects, book discovery calls, follow up on proposals, collect onboarding details, and keep every lead organized.", useCases:["Lead qualification agent","Discovery call booking","Proposal follow-up sequences","Client onboarding flows","Document request reminders","Testimonial and review requests"] },
];

const purple = "#a855f7";
const purpleSoft = "#c084fc";
const textPrimary = "#fbf8ff";
const textSecondary = "#aa9fbd";
const border = "rgba(168,85,247,.22)";

export default function IndustriesClient() {
  return (
    <div style={{ background:"#080311", color:textPrimary }}>
      <section style={{ padding:"140px 24px 86px", background:"radial-gradient(circle at 50% 0%, rgba(126,34,206,.22), transparent 42%), linear-gradient(180deg,#0c0618 0%,#080311 100%)", borderBottom:`1px solid ${border}` }}>
        <div style={{ maxWidth:"860px", margin:"0 auto", textAlign:"center" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <p style={{ margin:"0 0 16px", color:purpleSoft, fontSize:"0.72rem", fontWeight:800, letterSpacing:"0.2em", textTransform:"uppercase" }}>Industries</p>
            <h1 style={{ fontSize:"clamp(2.2rem,5vw,4rem)", fontWeight:900, letterSpacing:"-0.05em", lineHeight:1.05, color:textPrimary, marginBottom:"20px" }}>
              AI automation built around <span style={{ background:"linear-gradient(135deg,#fff 0%,#d8b4fe 38%,#9333ea 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>how your market actually buys</span>
            </h1>
            <p style={{ fontSize:"1.05rem", color:textSecondary, lineHeight:1.75 }}>
              Fluxknight designs each agent around the customer journey, objections, booking flow, and follow-up rhythm of your industry.
            </p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding:"82px 24px 110px", background:"linear-gradient(180deg,#080311 0%,#0b0517 50%,#080311 100%)" }}>
        <div style={{ maxWidth:"1160px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"34px" }}>
          {industries.map((ind,i)=>(
            <FadeUp key={ind.id} delay={i*0.035}>
              <div id={ind.id} style={{ background:"rgba(18,9,31,.9)", border:`1px solid ${border}`, borderRadius:"22px", overflow:"hidden", boxShadow:"0 26px 80px rgba(0,0,0,.3)" }} className="ind-card">
                <div style={{ display:"grid", gridTemplateColumns:"0.9fr 1.1fr", minHeight:"420px" }} className="ind-grid">
                  <div style={{ minHeight:"280px", backgroundImage:`linear-gradient(180deg, rgba(24,6,48,0.04), rgba(12,4,24,0.82)), url(${ind.image})`, backgroundSize:"cover", backgroundPosition:"center", position:"relative" }}>
                    <div style={{ position:"absolute", left:"24px", bottom:"24px", display:"flex", alignItems:"center", gap:"12px" }}>
                      <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"rgba(126,34,206,.3)", border:"1px solid rgba(192,132,252,.38)", backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <ind.icon size={22} color={purpleSoft} />
                      </div>
                      <span style={{ color:textPrimary, fontSize:"0.72rem", fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase" }}>{ind.label}</span>
                    </div>
                  </div>
                  <div style={{ padding:"42px" }}>
                    <h2 style={{ fontSize:"clamp(1.45rem,3vw,2rem)", fontWeight:850, color:textPrimary, letterSpacing:"-0.035em", marginBottom:"16px", lineHeight:1.25 }}>{ind.headline}</h2>
                    <p style={{ fontSize:"0.94rem", color:textSecondary, lineHeight:1.82, marginBottom:"26px" }}>{ind.desc}</p>
                    <p style={{ fontSize:"0.72rem", fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase", color:purpleSoft, marginBottom:"16px" }}>How it helps</p>
                    <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                      {ind.useCases.map(u=>(
                        <li key={u} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"10px", fontSize:"0.9rem", color:textSecondary, lineHeight:1.55 }}>
                          <CheckCircle size={15} color={purple} style={{ flexShrink:0, marginTop:"2px" }} />{u}
                        </li>
                      ))}
                    </ul>
                    <Link href="/evaluation" style={{ display:"inline-flex", alignItems:"center", gap:"8px", marginTop:"28px", padding:"11px 22px", fontSize:"0.875rem", fontWeight:800, color:"#fff", background:"linear-gradient(135deg,#a855f7,#7c3aed)", border:"1px solid rgba(216,180,254,.2)", borderRadius:"999px", textDecoration:"none", boxShadow:"0 12px 34px rgba(126,34,206,.24)" }}>
                      Build for {ind.label} <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      <style>{`
        html { scroll-padding-top: 110px; }
        .ind-card { scroll-margin-top: 110px; transition: border-color .25s ease, transform .25s ease; }
        .ind-card:hover { border-color: rgba(192,132,252,.48) !important; transform: translateY(-2px); }
        @media (max-width:768px) {
          .ind-grid { grid-template-columns:1fr !important; }
          .ind-grid > div:last-child { padding:30px 24px !important; }
        }
      `}</style>
    </div>
  );
}
