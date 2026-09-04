"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Briefcase, Building2, CheckCircle, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.55, delay }}>{children}</motion.div>;
}

const industries = [
  { slug: "hotels", icon: Building2, label: "Hotels", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80", headline: "Turn guest enquiries into bookings without making the front desk carry every conversation.", outcome: "Guest Q&A, reservation intake, booking reminders, staff handoff and deeper guest operations on higher plans." },
  { slug: "restaurants", icon: ShoppingCart, label: "Restaurants", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80", headline: "Handle reservations, WhatsApp or inbound-call orders, catering enquiries and customer questions.", outcome: "Menu support, structured order intake, reservations, reminders, catering qualification and staff fulfilment handoff." },
  { slug: "clinics", icon: Stethoscope, label: "Clinics", image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80", headline: "Reduce administrative booking friction without putting clinical decisions in an AI agent.", outcome: "Approved non-clinical Q&A, appointment intake, scheduling, reminders, rescheduling and staff escalation." },
  { slug: "sales-companies", icon: Briefcase, label: "Sales Companies", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80", headline: "Qualify demand earlier and keep every serious opportunity moving toward a closer.", outcome: "Sales intake, qualification, follow-up, intent visibility, management support and human closer handoff." },
  { slug: "real-estate", icon: Building2, label: "Real Estate", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80", headline: "Turn more property enquiries into inspections and qualified buyer conversations.", outcome: "Property Q&A, buyer qualification, matching, inspection workflow, reminders, cross-channel follow-up and human-agent handoff." },
  { slug: "gyms", icon: Briefcase, label: "Gyms", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80", headline: "Turn trial interest into memberships and reduce repetitive member communication.", outcome: "Membership Q&A, qualification, trial booking, reminders, renewal communication and the future Gym Membership System." },
  { slug: "service-businesses", icon: Briefcase, label: "Service Businesses", image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80", headline: "Turn vague service enquiries into qualified jobs before staff spend time chasing details.", outcome: "Job intake, qualification, quote and booking preparation, reminders, follow-up and staff handoff." },
  { slug: "auto-shops", icon: Truck, label: "Auto Shops", image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=900&q=80", headline: "Capture vehicle and repair requests cleanly before they reach the workshop team.", outcome: "Vehicle intake, service qualification, quote or booking workflow, reminders, updates and advisor handoff." },
  { slug: "ecommerce", icon: ShoppingCart, label: "E-commerce", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80", headline: "Keep buying intent alive from product question to the right next action.", outcome: "Product Q&A, buying-intent capture, order-support intake, unfinished-journey recovery and human escalation." },
  { slug: "professional-services", icon: Briefcase, label: "Professional Services", image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80", headline: "Turn enquiries into qualified consultations without burying professionals in repetitive intake.", outcome: "Qualification, discovery intake, consultation booking, proposal follow-up, onboarding support and professional handoff." },
];

const purple = "#a855f7";
const purpleSoft = "#c084fc";
const textPrimary = "#fbf8ff";
const textSecondary = "#aa9fbd";
const border = "rgba(168,85,247,.22)";

export default function IndustriesClient() {
  return (
    <div style={{ background: "#080311", color: textPrimary }}>
      <section style={{ padding: "140px 24px 82px", background: "radial-gradient(circle at 50% 0%, rgba(126,34,206,.22), transparent 42%), linear-gradient(180deg,#0c0618 0%,#080311 100%)", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <p style={{ margin: "0 0 16px", color: purpleSoft, fontSize: ".72rem", fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase" }}>Industries</p>
            <h1 style={{ fontSize: "clamp(2.3rem,5vw,4.3rem)", fontWeight: 900, letterSpacing: "-.05em", lineHeight: 1.04, marginBottom: 20 }}>One platform. <span style={{ background: "linear-gradient(135deg,#fff,#d8b4fe 45%,#9333ea)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Different operational journeys.</span></h1>
            <p style={{ fontSize: "1.05rem", color: textSecondary, lineHeight: 1.75 }}>Choose your industry to see the customer journey, Basic-to-Business+ progression, workflow examples and how pricing scope changes for that operation.</p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "78px 24px 108px", background: "linear-gradient(180deg,#080311 0%,#0b0517 50%,#080311 100%)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 22 }}>
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <FadeUp key={industry.slug} delay={index * 0.03}>
                <article style={{ height: "100%", overflow: "hidden", borderRadius: 22, background: "rgba(18,9,31,.92)", border: `1px solid ${border}`, boxShadow: "0 24px 70px rgba(0,0,0,.28)" }} className="industry-directory-card">
                  <div style={{ minHeight: 220, backgroundImage: `linear-gradient(180deg,rgba(20,6,40,.06),rgba(8,3,20,.86)),url(${industry.image})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                    <div style={{ position: "absolute", left: 20, bottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(126,34,206,.32)", border: "1px solid rgba(192,132,252,.38)", backdropFilter: "blur(10px)" }}><Icon size={20} color={purpleSoft} /></span>
                      <span style={{ fontSize: ".72rem", fontWeight: 850, letterSpacing: ".15em", textTransform: "uppercase" }}>{industry.label}</span>
                    </div>
                  </div>
                  <div style={{ padding: 26 }}>
                    <h2 style={{ margin: 0, fontSize: "clamp(1.35rem,2.5vw,1.85rem)", lineHeight: 1.24, letterSpacing: "-.035em" }}>{industry.headline}</h2>
                    <p style={{ margin: "15px 0 0", color: textSecondary, fontSize: ".92rem", lineHeight: 1.75 }}>{industry.outcome}</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18, color: textSecondary, fontSize: ".82rem" }}><CheckCircle size={15} color={purple} /> Plans, workflows and industry pricing scope</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                      <Link href={`/industries/${industry.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 17px", borderRadius: 999, textDecoration: "none", color: "#fff", fontWeight: 800, fontSize: ".84rem", background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>Explore {industry.label} <ArrowRight size={14} /></Link>
                      <Link href={`/evaluation?industry=${encodeURIComponent(industry.slug)}`} style={{ display: "inline-flex", alignItems: "center", padding: "10px 16px", borderRadius: 999, textDecoration: "none", color: textPrimary, fontWeight: 750, fontSize: ".82rem", border: `1px solid ${border}`, background: "rgba(255,255,255,.025)" }}>Evaluate</Link>
                    </div>
                  </div>
                </article>
              </FadeUp>
            );
          })}
        </div>
      </section>

      <style>{`
        .industry-directory-card { transition: transform .25s ease, border-color .25s ease; }
        .industry-directory-card:hover { transform: translateY(-3px); border-color: rgba(192,132,252,.46) !important; }
        @media (prefers-reduced-motion: reduce) { .industry-directory-card { transition: none; } }
      `}</style>
    </div>
  );
}
