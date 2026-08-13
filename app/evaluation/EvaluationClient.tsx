"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle, Clock, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

type FormState = "idle" | "loading" | "success" | "error";

type EvaluationForm = {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  agentTypes: string[];
  mainGoal: string;
  currentTools: string;
  leadVolume: string;
  timeline: string;
  budget: string;
  preferredContactTime: string;
  consent: boolean;
};

const businessTypes = [
  "Real Estate",
  "Computer Sales & Repair",
  "E-commerce",
  "Clinic / Healthcare",
  "Logistics",
  "Professional Services",
  "Agency / Consulting",
  "Hospitality",
  "Construction",
  "Other",
];

const leadVolumes = ["Under 25 leads/month", "25-100 leads/month", "100-500 leads/month", "500+ leads/month", "Not sure yet"];
const timelines = ["Immediately", "This month", "1-3 months", "Just exploring"];
const budgetRanges = ["Under $1,000", "$1,000 - $3,000", "$3,000 - $6,000", "$6,000 - $10,000", "$10,000+", "Not sure yet"];

const initialForm: EvaluationForm = {
  name: "",
  email: "",
  phone: "",
  businessName: "",
  businessType: "",
  agentTypes: [],
  mainGoal: "",
  currentTools: "",
  leadVolume: "",
  timeline: "",
  budget: "",
  preferredContactTime: "",
  consent: false,
};

const palette = {
  page: "#090510",
  panel: "#10091a",
  panelSoft: "#140c20",
  border: "rgba(168,85,247,.28)",
  borderStrong: "rgba(168,85,247,.48)",
  text: "#f7f0ff",
  muted: "#b9a8c9",
  accent: "#a855f7",
  accent2: "#8b5cf6",
  danger: "#f87171",
};

export default function EvaluationClient() {
  const [form, setForm] = useState<EvaluationForm>(initialForm);
  const [status, setStatus] = useState<FormState>("idle");
  const [errors, setErrors] = useState<Partial<Record<keyof EvaluationForm, string>>>({});

  const update = <K extends keyof EvaluationForm>(key: K, value: EvaluationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof EvaluationForm, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Valid email is required";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required";
    if (!form.businessName.trim()) nextErrors.businessName = "Business name is required";
    if (!form.businessType) nextErrors.businessType = "Select your business type";
    if (form.mainGoal.trim().length < 20) nextErrors.mainGoal = "Tell us a little more about the problem or outcome you want";
    if (!form.leadVolume) nextErrors.leadVolume = "Select your monthly lead volume";
    if (!form.timeline) nextErrors.timeline = "Select your timeline";
    if (!form.budget) nextErrors.budget = "Select a budget range";
    if (!form.consent) nextErrors.consent = "Consent is required before our evaluation system can contact you";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(response.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  const inputStyle = (field: keyof EvaluationForm): React.CSSProperties => ({
    width: "100%",
    background: palette.page,
    border: `1px solid ${errors[field] ? palette.danger : palette.border}`,
    borderRadius: 12,
    padding: "13px 15px",
    fontSize: ".94rem",
    color: palette.text,
    outline: "none",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: ".75rem",
    fontWeight: 800,
    letterSpacing: ".08em",
    color: palette.muted,
    marginBottom: 8,
    textTransform: "uppercase",
  };

  const errorMessage = (field: keyof EvaluationForm) => errors[field] ? <p style={{ color: palette.danger, fontSize: ".75rem", marginTop: 6 }}>{errors[field]}</p> : null;

  if (status === "success") {
    return (
      <main style={{ minHeight: "100vh", background: palette.page, display: "grid", placeItems: "center", padding: "120px 24px" }}>
        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(168,85,247,.12)", border: `1px solid ${palette.borderStrong}`, display: "grid", placeItems: "center", margin: "0 auto 24px" }}><CheckCircle size={30} color={palette.accent} /></div>
          <h1 style={{ fontSize: "2.1rem", fontWeight: 900, color: palette.text, letterSpacing: "-.03em", marginBottom: 14 }}>Evaluation request received</h1>
          <p style={{ color: palette.muted, lineHeight: 1.75, marginBottom: 30 }}>We have your business context. Fluxknight can now evaluate the problem first and recommend the right combination of agents, channels and workflows afterward.</p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", background: `linear-gradient(135deg,${palette.accent},${palette.accent2})`, color: "white", borderRadius: 10, fontWeight: 800, textDecoration: "none" }}>Back to home <ArrowRight size={15} /></Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: palette.page, color: palette.text }}>
      <section style={{ padding: "144px 24px 82px", background: "radial-gradient(circle at 50% 0%,rgba(168,85,247,.16),transparent 42%),linear-gradient(180deg,#10091a 0%,#090510 100%)", borderBottom: `1px solid ${palette.border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
            <p style={{ color: "#c084fc", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", fontSize: ".78rem", marginBottom: 16 }}>Business AI Evaluation</p>
            <h1 style={{ fontSize: "clamp(2.25rem,5vw,4.35rem)", lineHeight: 1.04, letterSpacing: "-.045em", fontWeight: 950, marginBottom: 20 }}>Tell us what your business needs. <span style={{ color: "#c084fc" }}>We&apos;ll design the right AI system.</span></h1>
            <p style={{ maxWidth: 720, margin: "0 auto", color: palette.muted, fontSize: "1.04rem", lineHeight: 1.75 }}>You do not need to know which agent, workflow or channel to choose. Describe the problem, bottleneck or outcome you want. We evaluate the request and recommend the system that fits your operation.</p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "64px 24px 110px" }}>
        <div className="evaluation-grid" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: ".78fr 1.5fr", gap: 48, alignItems: "start" }}>
          <motion.aside initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45 }}>
            <div style={{ position: "sticky", top: 110, display: "grid", gap: 18 }}>
              {[
                { icon: Search, title: "Problem first", desc: "Tell us what is slow, repetitive, expensive or being missed. You do not have to diagnose the technology yourself." },
                { icon: Sparkles, title: "System recommendation", desc: "We evaluate whether the solution needs one agent, several agents, workflow automation, or a mix of channels." },
                { icon: ShieldCheck, title: "Human-reviewed setup", desc: "Your request becomes a practical implementation brief before anything is deployed." },
                { icon: Clock, title: "Clear next step", desc: "We use the evaluation to determine scope, integrations, timeline and the most useful starting point." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: 14, padding: 18, borderRadius: 14, background: palette.panel, border: `1px solid ${palette.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(168,85,247,.12)", border: `1px solid ${palette.border}`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={18} color="#c084fc" /></div>
                  <div><h2 style={{ fontSize: ".96rem", marginBottom: 5 }}>{title}</h2><p style={{ color: palette.muted, fontSize: ".86rem", lineHeight: 1.62 }}>{desc}</p></div>
                </div>
              ))}
            </div>
          </motion.aside>

          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45, delay: .08 }}>
            <div style={{ background: palette.panelSoft, border: `1px solid ${palette.borderStrong}`, borderRadius: 18, padding: "clamp(22px,4vw,40px)", boxShadow: "0 24px 80px rgba(0,0,0,.24)" }}>
              <h2 style={{ fontSize: "1.35rem", marginBottom: 8 }}>Describe your business and what you want to improve</h2>
              <p style={{ color: palette.muted, lineHeight: 1.65, marginBottom: 28 }}>We&apos;ll decide which AI agents, channels and workflows suit the request after reviewing this information.</p>

              <div className="evaluation-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div><label style={labelStyle} htmlFor="name">Full name *</label><input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your name" style={inputStyle("name")} />{errorMessage("name")}</div>
                <div><label style={labelStyle} htmlFor="businessName">Business name *</label><input id="businessName" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="Company or brand" style={inputStyle("businessName")} />{errorMessage("businessName")}</div>
              </div>

              <div className="evaluation-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div><label style={labelStyle} htmlFor="email">Email *</label><input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" style={inputStyle("email")} />{errorMessage("email")}</div>
                <div><label style={labelStyle} htmlFor="phone">Phone / WhatsApp *</label><input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+234... / +1..." style={inputStyle("phone")} />{errorMessage("phone")}</div>
              </div>

              <div style={{ marginBottom: 20 }}><label style={labelStyle} htmlFor="businessType">Business type *</label><select id="businessType" value={form.businessType} onChange={(e) => update("businessType", e.target.value)} style={{ ...inputStyle("businessType"), cursor: "pointer" }}><option value="" disabled>Select your industry</option>{businessTypes.map((item) => <option key={item}>{item}</option>)}</select>{errorMessage("businessType")}</div>

              <div style={{ marginBottom: 20 }}><label style={labelStyle} htmlFor="mainGoal">What do you want to improve, automate or solve? *</label><textarea id="mainGoal" rows={7} value={form.mainGoal} onChange={(e) => update("mainGoal", e.target.value)} placeholder="Example: We receive enquiries from WhatsApp and Instagram, but leads are replied to late and follow-up is inconsistent. I want faster responses, automatic qualification, booking and a clear handoff to my team." style={{ ...inputStyle("mainGoal"), resize: "vertical", lineHeight: 1.6 }} />{errorMessage("mainGoal")}</div>

              <div style={{ marginBottom: 20 }}><label style={labelStyle} htmlFor="currentTools">How do you currently handle this?</label><textarea id="currentTools" rows={4} value={form.currentTools} onChange={(e) => update("currentTools", e.target.value)} placeholder="Tell us about WhatsApp, email, calls, spreadsheets, CRM, staff process, existing tools or anything else involved." style={{ ...inputStyle("currentTools"), resize: "vertical", lineHeight: 1.6 }} /></div>

              <div className="evaluation-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div><label style={labelStyle}>Lead / enquiry volume *</label><select value={form.leadVolume} onChange={(e) => update("leadVolume", e.target.value)} style={{ ...inputStyle("leadVolume"), cursor: "pointer" }}><option value="" disabled>Select volume</option>{leadVolumes.map((item) => <option key={item}>{item}</option>)}</select>{errorMessage("leadVolume")}</div>
                <div><label style={labelStyle}>Timeline *</label><select value={form.timeline} onChange={(e) => update("timeline", e.target.value)} style={{ ...inputStyle("timeline"), cursor: "pointer" }}><option value="" disabled>Select timeline</option>{timelines.map((item) => <option key={item}>{item}</option>)}</select>{errorMessage("timeline")}</div>
              </div>

              <div className="evaluation-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
                <div><label style={labelStyle}>Budget range *</label><select value={form.budget} onChange={(e) => update("budget", e.target.value)} style={{ ...inputStyle("budget"), cursor: "pointer" }}><option value="" disabled>Select budget</option>{budgetRanges.map((item) => <option key={item}>{item}</option>)}</select>{errorMessage("budget")}</div>
                <div><label style={labelStyle} htmlFor="preferredContactTime">Preferred contact time</label><input id="preferredContactTime" value={form.preferredContactTime} onChange={(e) => update("preferredContactTime", e.target.value)} placeholder="e.g. Weekdays after 2pm" style={inputStyle("preferredContactTime")} /></div>
              </div>

              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 16, border: `1px solid ${errors.consent ? palette.danger : palette.border}`, borderRadius: 12, background: "rgba(168,85,247,.06)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} style={{ marginTop: 4 }} />
                <span style={{ color: palette.muted, lineHeight: 1.55, fontSize: ".9rem" }}>I agree to be contacted about this request, including by an AI evaluation call agent at the phone number provided. Consent is not required to purchase.</span>
              </label>
              {errorMessage("consent")}

              {status === "error" ? <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18, padding: 14, borderRadius: 10, border: "1px solid rgba(248,113,113,.35)", background: "rgba(248,113,113,.08)", color: "#fca5a5" }}><AlertCircle size={17} />The evaluation request could not be sent. Please try again.</div> : null}

              <button type="button" onClick={submit} disabled={status === "loading"} style={{ width: "100%", marginTop: 22, border: 0, borderRadius: 12, padding: "15px 20px", fontWeight: 900, fontSize: "1rem", color: "white", background: `linear-gradient(135deg,${palette.accent},${palette.accent2})`, cursor: status === "loading" ? "wait" : "pointer", opacity: status === "loading" ? .7 : 1 }}>
                {status === "loading" ? "Submitting evaluation..." : "Request AI Evaluation"} <ArrowRight size={16} style={{ display: "inline", verticalAlign: "middle", marginLeft: 6 }} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
