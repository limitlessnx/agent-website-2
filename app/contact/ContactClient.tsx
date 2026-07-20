"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle, AlertCircle, ArrowRight, MessageSquare, Clock, Zap } from "lucide-react";

type FormState = "idle" | "loading" | "success" | "error";

interface FormData {
  name: string;
  email: string;
  phone: string;
  businessType: string;
  automationGoal: string;
  budget: string;
}

const businessTypes = [
  "Hotel",
  "Restaurant",
  "Clinic",
  "Sales Company",
  "Real Estate",
  "Gym",
  "Service Business",
  "Auto Shop",
  "E-commerce",
  "Professional Services",
  "Other",
];

const budgetRanges = [
  "Under NGN 200,000",
  "NGN 200,000 - NGN 500,000",
  "NGN 500,000 - NGN 1,000,000",
  "NGN 1,000,000 - NGN 2,000,000",
  "NGN 2,000,000+",
  "Not sure yet",
];

export default function ContactClient() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    businessType: "",
    automationGoal: "",
    budget: "",
  });
  const [status, setStatus] = useState<FormState>("idle");
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validate = (): boolean => {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Valid email is required";
    if (!form.businessType) e.businessType = "Please select your business type";
    if (!form.automationGoal.trim() || form.automationGoal.length < 10)
      e.automationGoal = "Please describe what you want to automate (10+ chars)";
    if (!form.budget) e.budget = "Please select a budget range";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const inputStyle = (field: keyof FormData): React.CSSProperties => ({
    width: "100%",
    background: "#0d1117",
    border: `1px solid ${errors[field] ? "#ef4444" : "#1e2d3d"}`,
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "0.9rem",
    color: "#f0f6ff",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "#8ba3bd",
    marginBottom: "8px",
    textTransform: "uppercase",
  };

  const fieldWrap: React.CSSProperties = { marginBottom: "20px" };

  const errMsg = (field: keyof FormData) =>
    errors[field] ? (
      <p style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "6px" }}>
        {errors[field]}
      </p>
    ) : null;

  if (status === "success") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", maxWidth: "480px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle size={28} color="#00d4ff" />
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f0f6ff", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            Message received
          </h1>
          <p style={{ color: "#8ba3bd", lineHeight: 1.75, marginBottom: "32px" }}>
            We&apos;ll review your submission and reach out within 24 hours to schedule your free strategy call.
          </p>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", fontSize: "0.9rem", fontWeight: 700, color: "#06080f", background: "#00d4ff", borderRadius: "10px", textDecoration: "none" }}>
            Back to home <ArrowRight size={14} />
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: "140px 24px 80px", background: "linear-gradient(180deg,#0d1117 0%,#06080f 100%)", borderBottom: "1px solid #1e2d3d" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="section-label" style={{ marginBottom: "16px" }}>Contact</p>
            <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#f0f6ff", marginBottom: "20px" }}>
              Book a free <span className="gradient-text">strategy call</span>
            </h1>
            <p style={{ fontSize: "1.05rem", color: "#8ba3bd", lineHeight: 1.7 }}>
              Tell us about your business. We&apos;ll review it and set up a 30-minute call to map out the right AI system for you — no pitch, just clarity.
            </p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "64px 24px 100px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "64px", alignItems: "start" }} className="contact-grid">

          {/* Left: info */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {[
                { icon: Clock, title: "Response within 24 hours", desc: "We review every submission and get back within one business day." },
                { icon: MessageSquare, title: "No-pressure conversation", desc: "The strategy call is diagnostic, not a sales pitch. You leave with a clear plan regardless." },
                { icon: Zap, title: "Scoped in the call", desc: "By the end of the call you&apos;ll know exactly what to build, what it costs, and how long it takes." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color="#00d4ff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f0f6ff", marginBottom: "6px" }}>{title}</h3>
                    <p style={{ fontSize: "0.85rem", color: "#8ba3bd", lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Direct contact */}
            <div style={{ marginTop: "40px", padding: "24px", background: "#0f1620", border: "1px solid #1e2d3d", borderRadius: "12px" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4d6478", marginBottom: "12px" }}>Prefer to reach out directly?</p>
              <a href="mailto:hello@fluxknight.ai" style={{ fontSize: "0.9rem", color: "#00d4ff", textDecoration: "none", display: "block", marginBottom: "6px" }}>hello@fluxknight.ai</a>
              <p style={{ fontSize: "0.8rem", color: "#4d6478" }}>We also respond on WhatsApp and Telegram.</p>
            </div>
          </motion.div>

          {/* Right: form */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div style={{ background: "#0f1620", border: "1px solid #1e2d3d", borderRadius: "16px", padding: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f0f6ff", marginBottom: "28px" }}>Tell us about your business</h2>

              {/* Name */}
              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle("name")}
                  onFocus={e => (e.target.style.borderColor = "#00d4ff")}
                  onBlur={e => (e.target.style.borderColor = errors.name ? "#ef4444" : "#1e2d3d")}
                  aria-required="true"
                  aria-describedby="name-error"
                />
                {errMsg("name")}
              </div>

              {/* Email + Phone */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", ...fieldWrap }}>
                <div>
                  <label style={labelStyle} htmlFor="email">Email *</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={inputStyle("email")}
                    onFocus={e => (e.target.style.borderColor = "#00d4ff")}
                    onBlur={e => (e.target.style.borderColor = errors.email ? "#ef4444" : "#1e2d3d")}
                    aria-required="true"
                  />
                  {errMsg("email")}
                </div>
                <div>
                  <label style={labelStyle} htmlFor="phone">Phone / WhatsApp</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={inputStyle("phone")}
                    onFocus={e => (e.target.style.borderColor = "#00d4ff")}
                    onBlur={e => (e.target.style.borderColor = "#1e2d3d")}
                  />
                </div>
              </div>

              {/* Business Type */}
              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="businessType">Business Type *</label>
                <select
                  id="businessType"
                  value={form.businessType}
                  onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}
                  style={{ ...inputStyle("businessType"), cursor: "pointer" }}
                  aria-required="true"
                >
                  <option value="" disabled>Select your industry</option>
                  {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errMsg("businessType")}
              </div>

              {/* Automation goal */}
              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="automationGoal">What do you want to automate? *</label>
                <textarea
                  id="automationGoal"
                  placeholder="e.g. We get 50+ WhatsApp inquiries daily and can't respond fast enough. We want to automate lead qualification and viewing bookings."
                  value={form.automationGoal}
                  onChange={e => setForm(f => ({ ...f, automationGoal: e.target.value }))}
                  rows={4}
                  style={{ ...inputStyle("automationGoal"), resize: "vertical", lineHeight: 1.6 }}
                  onFocus={e => (e.target.style.borderColor = "#00d4ff")}
                  onBlur={e => (e.target.style.borderColor = errors.automationGoal ? "#ef4444" : "#1e2d3d")}
                  aria-required="true"
                />
                {errMsg("automationGoal")}
              </div>

              {/* Budget */}
              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="budget">Budget Range *</label>
                <select
                  id="budget"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  style={{ ...inputStyle("budget"), cursor: "pointer" }}
                  aria-required="true"
                >
                  <option value="" disabled>Select your budget range</option>
                  {budgetRanges.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {errMsg("budget")}
              </div>

              {/* Error banner */}
              {status === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px" }}>
                  <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: "0.85rem", color: "#ef4444" }}>Something went wrong. Please try again or email us directly.</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={status === "loading"}
                style={{ width: "100%", padding: "14px", fontSize: "0.95rem", fontWeight: 700, color: "#06080f", background: status === "loading" ? "rgba(0,212,255,0.5)" : "#00d4ff", border: "none", borderRadius: "10px", cursor: status === "loading" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "opacity 0.2s, box-shadow 0.2s", boxShadow: "0 0 20px rgba(0,212,255,0.2)" }}
                aria-label="Submit contact form"
              >
                {status === "loading" ? "Sending…" : (
                  <>Book a Free Strategy Call <ArrowRight size={16} /></>
                )}
              </button>

              <p style={{ fontSize: "0.75rem", color: "#4d6478", textAlign: "center", marginTop: "14px", lineHeight: 1.6 }}>
                We respond within 24 hours. No spam, ever.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
        select option { background: #0d1117; color: #f0f6ff; }
      `}</style>
    </div>
  );
}
