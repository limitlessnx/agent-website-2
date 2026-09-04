"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle, MessageSquare, Network, Zap } from "@/components/admin/ServerIcons";

type FormState = "idle" | "loading" | "success" | "error";

type FormData = {
  name: string;
  email: string;
  phone: string;
  businessType: string;
  automationGoal: string;
  budget: string;
};

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
  "Focused starter workflow",
  "Multi-channel automation",
  "Advanced or custom operation",
  "Multiple departments or branches",
  "Not sure yet",
];

const operatingPrinciples = [
  {
    icon: MessageSquare,
    title: "Start with the business problem",
    text: "Tell us what is slow, repetitive, being missed, or consuming staff time. You do not need to diagnose the technology first.",
  },
  {
    icon: Network,
    title: "Map the operating flow",
    text: "We look at channels, data, handoffs, follow-up, and the points where human judgement still needs to stay in control.",
  },
  {
    icon: Zap,
    title: "Leave with a useful next step",
    text: "The requirement is reviewed before we recommend a focused starting point, a deeper evaluation, or a custom system scope.",
  },
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

  const validate = () => {
    const nextErrors: Partial<FormData> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Valid email is required";
    if (!form.businessType) nextErrors.businessType = "Please select your business type";
    if (!form.automationGoal.trim() || form.automationGoal.trim().length < 10) nextErrors.automationGoal = "Please describe the business problem in a little more detail";
    if (!form.budget) nextErrors.budget = "Please choose the closest scope";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(response.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  const inputStyle = (field: keyof FormData): React.CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 15px",
    borderRadius: "11px",
    border: `1px solid ${errors[field] ? "rgba(239,68,68,.65)" : "rgba(194,145,255,.18)"}`,
    background: "rgba(11,6,20,.92)",
    color: "#f7f2ff",
    fontSize: ".9rem",
    outline: "none",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    color: "#9c8cab",
    fontSize: ".72rem",
    fontWeight: 800,
    letterSpacing: ".08em",
    textTransform: "uppercase",
  };

  const fieldWrap: React.CSSProperties = { marginBottom: "20px" };

  const errMsg = (field: keyof FormData) =>
    errors[field] ? <p className="contact-error-text">{errors[field]}</p> : null;

  if (status === "success") {
    return (
      <main className="contact-page contact-success-page">
        <motion.section className="contact-success" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <span className="contact-success-icon"><CheckCircle size={28} /></span>
          <span className="contact-eyebrow">Submission received</span>
          <h1>We have the requirement.</h1>
          <p>We&apos;ll review what you submitted and contact you using the details provided. If the requirement needs deeper scoping, the Business AI Evaluation will be the next step.</p>
          <div className="contact-actions">
            <Link className="contact-primary" href="/evaluation">Business AI Evaluation <ArrowRight size={16} /></Link>
            <Link className="contact-secondary" href="/">Back to homepage</Link>
          </div>
        </motion.section>
        <ContactStyles />
      </main>
    );
  }

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="contact-glow" />
        <motion.div className="contact-hero-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
          <span className="contact-eyebrow">Contact Fluxknight</span>
          <h1>Tell us where the operation is getting stuck.</h1>
          <p>Describe the customer journey, repetitive work, follow-up gap, or internal bottleneck you want to improve. We&apos;ll review the problem before recommending what should be automated.</p>
          <div className="contact-actions">
            <Link className="contact-primary" href="/evaluation">Start Business AI Evaluation <ArrowRight size={16} /></Link>
            <a className="contact-secondary" href="mailto:limitless@fluxknight.space">Email directly</a>
          </div>
        </motion.div>
      </section>

      <section className="contact-body">
        <div className="contact-shell contact-grid">
          <motion.aside initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55, delay: .08 }}>
            <span className="contact-eyebrow">How we approach it</span>
            <h2>Problem first. System second.</h2>
            <p className="contact-aside-intro">The contact route is for a concrete business requirement. If you are still deciding what to automate, the evaluation route is intentionally broader.</p>
            <div className="contact-principles">
              {operatingPrinciples.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span><Icon size={18} /></span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </article>
              ))}
            </div>
            <div className="contact-direct">
              <span>Direct email</span>
              <a href="mailto:limitless@fluxknight.space">limitless@fluxknight.space</a>
              <p>Use email when you already have a clear brief, integration question, or project requirement to share.</p>
            </div>
          </motion.aside>

          <motion.section className="contact-form-card" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55, delay: .12 }} aria-labelledby="contact-form-title">
            <div className="contact-form-heading">
              <span className="contact-eyebrow">Business requirement</span>
              <h2 id="contact-form-title">Tell us what needs to improve.</h2>
              <p>Give us enough context to understand the operation. The form still feeds the existing contact workflow.</p>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="name">Full name *</label>
              <input id="name" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} style={inputStyle("name")} placeholder="Your name" />
              {errMsg("name")}
            </div>

            <div className="contact-two-col" style={fieldWrap}>
              <div>
                <label style={labelStyle} htmlFor="email">Email *</label>
                <input id="email" type="email" value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value }))} style={inputStyle("email")} placeholder="you@company.com" />
                {errMsg("email")}
              </div>
              <div>
                <label style={labelStyle} htmlFor="phone">Phone / WhatsApp</label>
                <input id="phone" type="tel" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} style={inputStyle("phone")} placeholder="+234 ..." />
              </div>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="businessType">Business type *</label>
              <select id="businessType" value={form.businessType} onChange={e => setForm(current => ({ ...current, businessType: e.target.value }))} style={{ ...inputStyle("businessType"), cursor: "pointer" }}>
                <option value="" disabled>Select your industry</option>
                {businessTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              {errMsg("businessType")}
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="automationGoal">What needs to improve or be automated? *</label>
              <textarea id="automationGoal" value={form.automationGoal} onChange={e => setForm(current => ({ ...current, automationGoal: e.target.value }))} style={{ ...inputStyle("automationGoal"), resize: "vertical", lineHeight: 1.6 }} rows={5} placeholder="Example: Property leads arrive through WhatsApp but follow-up and inspection booking depend on agents remembering every conversation." />
              {errMsg("automationGoal")}
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="budget">Closest scope *</label>
              <select id="budget" value={form.budget} onChange={e => setForm(current => ({ ...current, budget: e.target.value }))} style={{ ...inputStyle("budget"), cursor: "pointer" }}>
                <option value="" disabled>Select the closest scope</option>
                {budgetRanges.map(range => <option key={range} value={range}>{range}</option>)}
              </select>
              {errMsg("budget")}
            </div>

            {status === "error" && (
              <div className="contact-error"><AlertCircle size={17} /><span>Something went wrong while sending the requirement. Please try again or use the direct email address.</span></div>
            )}

            <button className="contact-submit" type="button" onClick={handleSubmit} disabled={status === "loading"}>
              {status === "loading" ? "Sending…" : <>Send business requirement <ArrowRight size={16} /></>}
            </button>
            <p className="contact-form-note">Submitting this form does not commit you to a package or deployment.</p>
          </motion.section>
        </div>
      </section>
      <ContactStyles />
    </main>
  );
}

function ContactStyles() {
  return <style>{`
    .contact-page{min-height:100vh;background:#07030f;color:#fff;overflow-x:hidden}.contact-hero{position:relative;overflow:hidden;padding:132px 24px 84px;text-align:center;background:linear-gradient(180deg,#0b0515 0%,#090411 62%,#07030f 100%);border-bottom:1px solid rgba(190,145,255,.12)}.contact-glow{position:absolute;left:50%;top:-80px;width:min(900px,90vw);height:520px;transform:translateX(-50%);background:radial-gradient(ellipse,rgba(135,65,245,.2),transparent 68%);filter:blur(24px)}.contact-hero-copy{position:relative;z-index:1;max-width:820px;margin:0 auto}.contact-eyebrow{display:inline-block;color:#c18cff;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.contact-hero h1,.contact-success h1{margin:14px auto 0;color:#fff;font-size:clamp(2.6rem,6vw,5.3rem);line-height:.96;letter-spacing:-.055em}.contact-hero p,.contact-success p{max-width:720px;margin:22px auto 0;color:#a99bb7;font-size:1rem;line-height:1.72}.contact-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:11px;margin-top:28px}.contact-primary,.contact-secondary{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;border-radius:999px;font-size:.84rem;font-weight:800;text-decoration:none}.contact-primary{color:#fff;background:linear-gradient(135deg,#8f4dff,#6f32d9);box-shadow:0 12px 34px rgba(111,50,217,.28)}.contact-secondary{color:#d7c8e8;border:1px solid rgba(195,148,255,.22);background:rgba(20,11,35,.72)}.contact-body{padding:76px 24px 110px}.contact-shell{width:min(1080px,100%);margin:0 auto}.contact-grid{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:54px;align-items:start}.contact-grid aside>h2{margin:12px 0 12px;font-size:clamp(2rem,4vw,3.25rem);line-height:1;letter-spacing:-.045em}.contact-aside-intro{margin:0;color:#9789a5;font-size:.9rem;line-height:1.68}.contact-principles{display:grid;gap:18px;margin-top:30px}.contact-principles article{display:grid;grid-template-columns:auto 1fr;gap:13px;align-items:start}.contact-principles article>span{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(194,145,255,.16);border-radius:12px;background:rgba(132,62,236,.13);color:#c895ff}.contact-principles h3{margin:0;color:#f5f0fb;font-size:.9rem}.contact-principles p{margin:6px 0 0;color:#8e809c;font-size:.8rem;line-height:1.56}.contact-direct{margin-top:34px;padding:20px;border:1px solid rgba(190,145,255,.14);border-radius:16px;background:rgba(20,11,35,.72)}.contact-direct>span{display:block;color:#7f718c;font-size:.64rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.contact-direct a{display:inline-block;margin-top:7px;color:#c895ff;font-size:.86rem;font-weight:800;text-decoration:none}.contact-direct p{margin:8px 0 0;color:#766a82;font-size:.74rem;line-height:1.5}.contact-form-card{padding:30px;border:1px solid rgba(194,145,255,.16);border-radius:22px;background:linear-gradient(145deg,rgba(26,13,46,.9),rgba(10,6,18,.97));box-shadow:0 24px 70px rgba(0,0,0,.28)}.contact-form-heading{margin-bottom:26px}.contact-form-heading h2{margin:9px 0 8px;color:#fff;font-size:1.5rem;letter-spacing:-.035em}.contact-form-heading p{margin:0;color:#85778f;font-size:.78rem;line-height:1.55}.contact-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}.contact-error-text{margin:6px 0 0;color:#ef7777;font-size:.72rem}.contact-error{display:flex;align-items:flex-start;gap:9px;margin:0 0 18px;padding:12px 14px;border:1px solid rgba(239,68,68,.3);border-radius:10px;background:rgba(239,68,68,.08);color:#ef9292;font-size:.78rem;line-height:1.45}.contact-submit{width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;color:#fff;background:linear-gradient(135deg,#8f4dff,#6f32d9);font-size:.88rem;font-weight:900;cursor:pointer;box-shadow:0 12px 32px rgba(111,50,217,.24)}.contact-submit:disabled{opacity:.55;cursor:not-allowed}.contact-form-note{margin:11px 0 0;color:#6f6379;font-size:.69rem;text-align:center}.contact-success-page{display:flex;align-items:center;justify-content:center;padding:110px 24px}.contact-success{width:min(620px,100%);text-align:center;padding:36px;border:1px solid rgba(194,145,255,.16);border-radius:24px;background:linear-gradient(145deg,rgba(26,13,46,.9),rgba(10,6,18,.97))}.contact-success-icon{width:58px;height:58px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;border-radius:18px;color:#d7b7ff;background:rgba(139,92,246,.18);border:1px solid rgba(194,145,255,.18)}.contact-success h1{font-size:clamp(2.2rem,6vw,4rem)}select option{background:#0d0717;color:#f7f2ff}@media(max-width:820px){.contact-grid{grid-template-columns:1fr;gap:40px}}@media(max-width:640px){.contact-hero{padding:104px 18px 66px}.contact-hero h1{font-size:clamp(2.35rem,12vw,3.6rem)}.contact-hero p{font-size:.9rem;line-height:1.62}.contact-actions{display:grid}.contact-primary,.contact-secondary{width:100%;box-sizing:border-box}.contact-body{padding:58px 18px 84px}.contact-two-col{grid-template-columns:1fr}.contact-form-card{padding:20px;border-radius:18px}.contact-success-page{padding:88px 18px}.contact-success{padding:26px 20px}}
  `}</style>;
}
