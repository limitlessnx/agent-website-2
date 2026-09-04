"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Network, ShieldCheck, Sparkles, UsersRound, Workflow, Zap } from "@/components/admin/ServerIcons";

const principles = [
  { icon: Zap, title: "Business outcomes first", text: "We start with what needs to improve: response time, conversion, follow-up, staff capacity, customer experience, or operational visibility." },
  { icon: UsersRound, title: "AI works alongside people", text: "Automation handles repetitive and time-sensitive work while important conversations can still move to the right person." },
  { icon: Network, title: "Connected, not fragmented", text: "Customer conversations, lead details, follow-up and next actions should stay connected instead of living in isolated tools." },
  { icon: ShieldCheck, title: "Controlled deployment", text: "Systems are configured around approved knowledge, business rules, escalation points and the operation your team already understands." },
];

const approach = [
  "Map the business problem before choosing technology",
  "Design around the customer journey and internal workflow",
  "Keep human handoff available where judgement matters",
  "Connect useful context instead of creating another information silo",
  "Improve the system after launch using real operating feedback",
];

export default function AboutOutcomeClient() {
  return (
    <main className="quantix-home" style={{ background: "#080311", color: "#fbf8ff" }}>
      <section style={{ padding: "145px 24px 92px", background: "radial-gradient(circle at 50% 0%,rgba(139,92,246,.22),transparent 42%),linear-gradient(180deg,#10091a 0%,#080311 100%)", borderBottom: "1px solid rgba(168,85,247,.22)" }}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", color: "#c084fc", fontSize: ".74rem", fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase" }}>About Fluxknight</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2.35rem,6vw,4.8rem)", lineHeight: 1.02, letterSpacing: "-.055em", fontWeight: 950 }}>
            We build organizations that can <span style={{ color: "#c084fc" }}>handle more without creating more chaos.</span>
          </h1>
          <p style={{ maxWidth: 720, margin: "24px auto 0", color: "#b9a8c9", fontSize: "1.04rem", lineHeight: 1.78 }}>
            Fluxknight designs AI communication and automation systems that help businesses respond faster, convert more opportunities, reduce repetitive work, and keep customer operations moving with better visibility.
          </p>
        </motion.div>
      </section>

      <section style={{ padding: "86px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ maxWidth: 760, marginBottom: 42 }}>
            <span style={{ color: "#c084fc", fontSize: ".72rem", fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase" }}>How we think</span>
            <h2 style={{ margin: "12px 0 14px", fontSize: "clamp(1.9rem,4vw,3.2rem)", letterSpacing: "-.04em" }}>Automation should remove friction, not remove control.</h2>
            <p style={{ color: "#aa9fbd", lineHeight: 1.75 }}>The point is not to make a business look more technical. The point is to make it easier for customers to get help, easier for staff to focus, and easier for management to see what is happening.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
            {principles.map(({ icon: Icon, title, text }, i) => (
              <motion.article key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .42, delay: i * .05 }} style={{ padding: 26, border: "1px solid rgba(168,85,247,.22)", borderRadius: 18, background: "linear-gradient(155deg,rgba(24,14,43,.96),rgba(9,5,18,.98))" }}>
                <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 12, color: "#fff", background: "linear-gradient(145deg,#a867ff,#6330d1)", marginBottom: 18 }}><Icon size={20} /></span>
                <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>{title}</h3>
                <p style={{ margin: 0, color: "#aa9fbd", lineHeight: 1.7, fontSize: ".9rem" }}>{text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "82px 24px", borderTop: "1px solid rgba(168,85,247,.18)", borderBottom: "1px solid rgba(168,85,247,.18)", background: "rgba(16,9,26,.72)" }}>
        <div className="about-outcome-grid" style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: ".9fr 1.1fr", gap: 64, alignItems: "start" }}>
          <div>
            <span style={{ color: "#c084fc", fontSize: ".72rem", fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase" }}>What we build around</span>
            <h2 style={{ margin: "12px 0 16px", fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-.04em" }}>Your operation comes before the tool stack.</h2>
            <p style={{ color: "#aa9fbd", lineHeight: 1.75 }}>WhatsApp, voice, email, CRM, dashboards and workflow automation are useful only when they fit the way customers enter the business and the way your team actually works.</p>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {approach.map((item) => <div key={item} style={{ display: "flex", gap: 12, padding: "14px 16px", border: "1px solid rgba(168,85,247,.18)", borderRadius: 13, background: "rgba(255,255,255,.025)", color: "#d8cce5" }}><CheckCircle2 size={18} color="#c084fc" style={{ flex: "0 0 auto", marginTop: 2 }} /><span style={{ lineHeight: 1.55 }}>{item}</span></div>)}
          </div>
        </div>
      </section>

      <section style={{ padding: "90px 24px 110px", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <span style={{ width: 48, height: 48, margin: "0 auto 18px", display: "grid", placeItems: "center", borderRadius: 14, background: "rgba(168,85,247,.14)", border: "1px solid rgba(192,132,252,.3)" }}><Workflow size={21} /></span>
          <h2 style={{ margin: "0 0 14px", fontSize: "clamp(1.9rem,4vw,3.2rem)", letterSpacing: "-.04em" }}>Start with the business problem.</h2>
          <p style={{ margin: "0 auto 28px", color: "#aa9fbd", lineHeight: 1.75 }}>You do not need to choose an AI product first. Tell us where the organization is losing time, opportunities, or visibility, and the evaluation will map the right starting point.</p>
          <Link href="/evaluation" data-cta="about-evaluation" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "14px 24px", borderRadius: 11, color: "#fff", textDecoration: "none", fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#a855f7)", boxShadow: "0 12px 34px rgba(126,34,206,.24)" }}>Evaluate My Business <ArrowRight size={16} /></Link>
        </div>
      </section>

      <style>{`@media(max-width:760px){.about-outcome-grid{grid-template-columns:1fr!important;gap:30px!important}}`}</style>
    </main>
  );
}
