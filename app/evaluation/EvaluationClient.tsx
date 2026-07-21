"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle,
  Clock,
  Headphones,
  Mail,
  MessageCircle,
  PhoneCall,
  PhoneOutgoing,
  Repeat,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

type FormState = "idle" | "loading" | "success" | "error";

interface EvaluationForm {
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
}

const agentOptions = [
  {
    value: "Outbound Call Agent",
    label: "Outbound Call Agent",
    desc: "Calls leads, qualifies interest, and books appointments.",
    icon: PhoneOutgoing,
  },
  {
    value: "Email Automation",
    label: "Email Automation",
    desc: "Sends nurture, reply, and sales sequences automatically.",
    icon: Mail,
  },
  {
    value: "Follow-up Agent",
    label: "Follow-up Agent",
    desc: "Re-engages leads across call, email, WhatsApp, or CRM.",
    icon: Repeat,
  },
  {
    value: "WhatsApp Agent",
    label: "WhatsApp Agent",
    desc: "Handles WhatsApp inquiries, FAQs, and bookings.",
    icon: MessageCircle,
  },
  {
    value: "Customer Support Agent",
    label: "Support Agent",
    desc: "Answers customer questions and escalates urgent issues.",
    icon: Headphones,
  },
  {
    value: "Custom AI Agent",
    label: "Custom AI Agent",
    desc: "A tailored agent for your exact workflow.",
    icon: Bot,
  },
];

const businessTypes = [
  "Real Estate",
  "Computer Sales & Repair",
  "E-commerce",
  "Clinic / Healthcare",
  "Logistics",
  "Professional Services",
  "Agency / Consulting",
  "Other",
];

const leadVolumes = [
  "Under 25 leads/month",
  "25-100 leads/month",
  "100-500 leads/month",
  "500+ leads/month",
  "Not sure yet",
];

const timelines = [
  "Immediately",
  "This month",
  "1-3 months",
  "Just exploring",
];

const budgetRanges = [
  "Under $1,000",
  "$1,000 - $3,000",
  "$3,000 - $6,000",
  "$6,000 - $10,000",
  "$10,000+",
  "Not sure yet",
];

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

export default function EvaluationClient() {
  const [form, setForm] = useState<EvaluationForm>(initialForm);
  const [status, setStatus] = useState<FormState>("idle");
  const [errors, setErrors] = useState<Partial<Record<keyof EvaluationForm, string>>>({});

  const update = <K extends keyof EvaluationForm>(key: K, value: EvaluationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleAgentType = (agentType: string) => {
    update(
      "agentTypes",
      form.agentTypes.includes(agentType)
        ? form.agentTypes.filter((item) => item !== agentType)
        : [...form.agentTypes, agentType]
    );
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof EvaluationForm, string>> = {};

    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Valid email is required";
    }
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required for the AI call";
    if (!form.businessName.trim()) nextErrors.businessName = "Business name is required";
    if (!form.businessType) nextErrors.businessType = "Select your business type";
    if (form.agentTypes.length === 0) nextErrors.agentTypes = "Choose at least one agent type";
    if (form.mainGoal.trim().length < 15) {
      nextErrors.mainGoal = "Describe the outcome you want in at least 15 characters";
    }
    if (!form.leadVolume) nextErrors.leadVolume = "Select your monthly lead volume";
    if (!form.timeline) nextErrors.timeline = "Select your timeline";
    if (!form.budget) nextErrors.budget = "Select a budget range";
    if (!form.consent) nextErrors.consent = "Consent is required before the AI call agent can contact you";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  const inputStyle = (field: keyof EvaluationForm): React.CSSProperties => ({
    width: "100%",
    background: "#0d1117",
    border: `1px solid ${errors[field] ? "#ef4444" : "#1e2d3d"}`,
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "0.9rem",
    color: "#f0f6ff",
    outline: "none",
    transition: "border-color 0.2s",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.76rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "#8ba3bd",
    marginBottom: "8px",
    textTransform: "uppercase",
  };

  const fieldWrap: React.CSSProperties = { marginBottom: "20px" };

  const errorMessage = (field: keyof EvaluationForm) =>
    errors[field] ? (
      <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "6px" }}>
        {errors[field]}
      </p>
    ) : null;

  if (status === "success") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px" }}>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: "520px", textAlign: "center" }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle size={30} color="#00d4ff" />
          </div>
          <h1 style={{ fontSize: "2.1rem", fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: "14px" }}>
            Evaluation request received
          </h1>
          <p style={{ color: "#8ba3bd", lineHeight: 1.75, marginBottom: "30px" }}>
            Your details were submitted. Our AI evaluation system will qualify the request and route the summary to our team for next steps.
          </p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", background: "#00d4ff", color: "#06080f", borderRadius: "10px", fontSize: "0.9rem", fontWeight: 700, textDecoration: "none" }}>
            Back to home <ArrowRight size={15} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <section style={{ padding: "140px 24px 76px", background: "linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom: "1px solid #1e2d3d" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <p className="section-label" style={{ marginBottom: "16px" }}>AI Evaluation Call</p>
            <h1 style={{ fontSize: "clamp(2.1rem,5vw,4.1rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#f0f6ff", marginBottom: "20px" }}>
              Get matched with the right <span className="gradient-text">AI agent system</span>
            </h1>
            <p style={{ maxWidth: "660px", margin: "0 auto", color: "#8ba3bd", fontSize: "1.05rem", lineHeight: 1.75 }}>
              Share what you want built. The evaluation flow captures the details our team needs to scope your outbound calling, email, follow-up, WhatsApp, support, or custom AI agent.
            </p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "64px 24px 100px" }}>
        <div className="evaluation-grid" style={{ maxWidth: "1120px", margin: "0 auto", display: "grid", gridTemplateColumns: "0.82fr 1.5fr", gap: "56px", alignItems: "start" }}>
          <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
            <div style={{ display: "grid", gap: "22px" }}>
              {[
                {
                  icon: PhoneCall,
                  title: "Call-ready intake",
                  desc: "We collect phone, consent, goals, and agent type before any AI call is triggered.",
                },
                {
                  icon: Sparkles,
                  title: "Qualified requirements",
                  desc: "The system turns every request into a clear build brief instead of a vague contact form.",
                },
                {
                  icon: ShieldCheck,
                  title: "Consent first",
                  desc: "Clients must agree to be contacted before an AI call agent reaches out.",
                },
                {
                  icon: Clock,
                  title: "Fast routing",
                  desc: "Submissions can be sent to Supabase, n8n, Telegram, email, and your sales workflow.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color="#00d4ff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "0.96rem", fontWeight: 700, color: "#f0f6ff", marginBottom: "6px" }}>{title}</h2>
                    <p style={{ fontSize: "0.86rem", color: "#8ba3bd", lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
            <div style={{ background: "#0f1620", border: "1px solid #1e2d3d", borderRadius: "16px", padding: "38px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f0f6ff", marginBottom: "28px" }}>
                Tell us what you want built
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", ...fieldWrap }} className="evaluation-two-col">
                <div>
                  <label style={labelStyle} htmlFor="name">Full Name *</label>
                  <input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your name" style={inputStyle("name")} />
                  {errorMessage("name")}
                </div>
                <div>
                  <label style={labelStyle} htmlFor="businessName">Business Name *</label>
                  <input id="businessName" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="Company or brand" style={inputStyle("businessName")} />
                  {errorMessage("businessName")}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", ...fieldWrap }} className="evaluation-two-col">
                <div>
                  <label style={labelStyle} htmlFor="email">Email *</label>
                  <input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" style={inputStyle("email")} />
                  {errorMessage("email")}
                </div>
                <div>
                  <label style={labelStyle} htmlFor="phone">Phone / WhatsApp *</label>
                  <input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 234 567 8900" style={inputStyle("phone")} />
                  {errorMessage("phone")}
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="businessType">Business Type *</label>
                <select id="businessType" value={form.businessType} onChange={(e) => update("businessType", e.target.value)} style={{ ...inputStyle("businessType"), cursor: "pointer" }}>
                  <option value="" disabled>Select your industry</option>
                  {businessTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                {errorMessage("businessType")}
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>What kind of agent do you want? *</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px" }} className="agent-type-grid">
                  {agentOptions.map(({ value, label, desc, icon: Icon }) => {
                    const selected = form.agentTypes.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleAgentType(value)}
                        style={{
                          textAlign: "left",
                          background: selected ? "rgba(0,212,255,0.1)" : "#0d1117",
                          border: selected ? "1px solid rgba(0,212,255,0.55)" : "1px solid #1e2d3d",
                          borderRadius: "12px",
                          padding: "16px",
                          color: "#f0f6ff",
                          cursor: "pointer",
                          minHeight: "126px",
                        }}
                        aria-pressed={selected}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          <Icon size={18} color="#00d4ff" />
                          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{label}</span>
                        </div>
                        <p style={{ color: "#8ba3bd", fontSize: "0.8rem", lineHeight: 1.55 }}>{desc}</p>
                      </button>
                    );
                  })}
                </div>
                {errorMessage("agentTypes")}
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="mainGoal">Main Goal *</label>
                <textarea
                  id="mainGoal"
                  value={form.mainGoal}
                  onChange={(e) => update("mainGoal", e.target.value)}
                  placeholder="Example: We want an outbound agent to call old real estate leads, qualify buyers, and book viewing appointments."
                  rows={4}
                  style={{ ...inputStyle("mainGoal"), resize: "vertical", lineHeight: 1.6 }}
                />
                {errorMessage("mainGoal")}
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="currentTools">Current Tools</label>
                <input id="currentTools" value={form.currentTools} onChange={(e) => update("currentTools", e.target.value)} placeholder="CRM, email platform, calendar, WhatsApp, spreadsheets..." style={inputStyle("currentTools")} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", ...fieldWrap }} className="evaluation-two-col">
                <div>
                  <label style={labelStyle} htmlFor="leadVolume">Lead Volume *</label>
                  <select id="leadVolume" value={form.leadVolume} onChange={(e) => update("leadVolume", e.target.value)} style={{ ...inputStyle("leadVolume"), cursor: "pointer" }}>
                    <option value="" disabled>Select monthly volume</option>
                    {leadVolumes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  {errorMessage("leadVolume")}
                </div>
                <div>
                  <label style={labelStyle} htmlFor="timeline">Timeline *</label>
                  <select id="timeline" value={form.timeline} onChange={(e) => update("timeline", e.target.value)} style={{ ...inputStyle("timeline"), cursor: "pointer" }}>
                    <option value="" disabled>Select timeline</option>
                    {timelines.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  {errorMessage("timeline")}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", ...fieldWrap }} className="evaluation-two-col">
                <div>
                  <label style={labelStyle} htmlFor="budget">Budget *</label>
                  <select id="budget" value={form.budget} onChange={(e) => update("budget", e.target.value)} style={{ ...inputStyle("budget"), cursor: "pointer" }}>
                    <option value="" disabled>Select budget range</option>
                    {budgetRanges.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  {errorMessage("budget")}
                </div>
                <div>
                  <label style={labelStyle} htmlFor="preferredContactTime">Best Time To Call</label>
                  <input id="preferredContactTime" value={form.preferredContactTime} onChange={(e) => update("preferredContactTime", e.target.value)} placeholder="Example: Weekdays after 2pm" style={inputStyle("preferredContactTime")} />
                </div>
              </div>

              <div style={{ ...fieldWrap, padding: "16px", background: "rgba(0,212,255,0.06)", border: `1px solid ${errors.consent ? "#ef4444" : "rgba(0,212,255,0.18)"}`, borderRadius: "12px" }}>
                <label style={{ display: "flex", gap: "12px", alignItems: "flex-start", color: "#8ba3bd", fontSize: "0.82rem", lineHeight: 1.6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => update("consent", e.target.checked)}
                    style={{ marginTop: "4px", accentColor: "#00d4ff" }}
                  />
                  <span>
                    I agree to be contacted about this request, including by an AI evaluation call agent at the phone number provided. Consent is not required to purchase.
                  </span>
                </label>
                {errorMessage("consent")}
              </div>

              {status === "error" && (
                <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 14px", marginBottom: "20px" }}>
                  <AlertCircle size={17} color="#ef4444" />
                  <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>The evaluation request could not be sent. Please try again.</p>
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={status === "loading"}
                style={{ width: "100%", padding: "15px", border: "none", borderRadius: "10px", background: status === "loading" ? "rgba(0,212,255,0.45)" : "#00d4ff", color: "#06080f", fontSize: "0.96rem", fontWeight: 800, cursor: status === "loading" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 0 24px rgba(0,212,255,0.2)" }}
              >
                {status === "loading" ? "Submitting..." : <>Start AI Evaluation <ArrowRight size={16} /></>}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .evaluation-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .evaluation-two-col, .agent-type-grid { grid-template-columns: 1fr !important; }
        }
        select option { background: #0d1117; color: #f0f6ff; }
      `}</style>
    </div>
  );
}
