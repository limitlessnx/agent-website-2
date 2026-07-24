"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import type { ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

const agentOptions = [
  ["ai_sales_agent", "AI Sales Agent"],
  ["customer_support_agent", "Customer Support Agent"],
  ["whatsapp_agent", "WhatsApp Agent"],
  ["voice_agent", "Voice Agent"],
  ["lead_generation_agent", "Lead Generation Agent"],
  ["email_automation", "Email Automation"],
  ["crm_automation", "CRM Automation"],
  ["custom_workflow", "Custom Workflow"],
];

const goalOptions = [
  ["generate_leads", "Generate leads"],
  ["qualify_prospects", "Qualify prospects"],
  ["book_appointments", "Book appointments"],
  ["answer_questions", "Answer customer questions"],
  ["follow_up_leads", "Follow up leads"],
  ["send_reminders", "Send reminders"],
  ["make_outbound_calls", "Make outbound calls"],
  ["manage_customer_records", "Manage customer records"],
];

const channelOptions = ["Website chat", "WhatsApp", "Telegram", "Email", "Phone calls", "Instagram/Facebook", "Internal dashboard"];
const toolOptions = ["Supabase", "Google Sheets", "Gmail", "Google Calendar", "HubSpot", "Airtable", "n8n", "ElevenLabs", "Vapi", "Other CRM"];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function OnboardingForm({ initialProfile }: { initialProfile: ClientOnboardingProfile }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialProfile.current_step || 1, 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    business_name: initialProfile.business_name || "",
    industry: initialProfile.industry || "",
    website: initialProfile.website || "",
    country: initialProfile.country || "Nigeria",
    timezone: initialProfile.timezone || "Africa/Lagos",
    business_email: initialProfile.business_email || "",
    phone: initialProfile.phone || "",
    staff_size: initialProfile.staff_size || "",
    requested_agents: initialProfile.requested_agents || [],
    business_goals: initialProfile.business_goals || [],
    channels: initialProfile.channels || [],
    existing_tools: initialProfile.existing_tools || [],
    human_contact_name: initialProfile.human_contact_name || "",
    human_contact_email: initialProfile.human_contact_email || "",
    notes: initialProfile.notes || "",
  });

  const progress = useMemo(() => `${Math.round((step / 5) * 100)}%`, [step]);

  async function save(nextStep = step) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/client-onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, current_step: nextStep }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save onboarding progress.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save onboarding progress.");
      throw cause;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (step === 1 && (!form.business_name.trim() || !form.industry.trim())) return setError("Business name and industry are required.");
    if (step === 2 && !form.requested_agents.length) return setError("Select at least one AI agent.");
    if (step === 3 && !form.business_goals.length) return setError("Select at least one business goal.");
    const nextStep = Math.min(5, step + 1);
    await save(nextStep);
    setStep(nextStep);
  }

  async function complete() {
    if (!form.human_contact_email.trim()) return setError("A human contact email is required for escalation.");
    setSaving(true);
    setError("");
    try {
      await save(5);
      const response = await fetch("/api/client-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to complete onboarding.");
      router.push("/portal");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete onboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-progress"><span style={{ width: progress }} /></div>
      <div className="onboarding-heading">
        <div className="small-label"><Sparkles size={13} /> Workspace setup</div>
        <p>Step {step} of 5</p>
      </div>

      {step === 1 && (
        <section>
          <h1>Tell us about your business.</h1>
          <p>This creates the operating context your first AI employee will use.</p>
          <div className="form-grid two">
            <label>Business name<input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></label>
            <label>Industry<input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Real estate, retail, hospitality..." /></label>
            <label>Website<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></label>
            <label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
            <label>Time zone<input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label>
            <label>Staff size<select value={form.staff_size} onChange={(e) => setForm({ ...form, staff_size: e.target.value })}><option value="">Select</option><option>1-5</option><option>6-20</option><option>21-50</option><option>51-200</option><option>200+</option></select></label>
            <label>Business email<input type="email" value={form.business_email} onChange={(e) => setForm({ ...form, business_email: e.target.value })} /></label>
            <label>Phone number<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
        </section>
      )}

      {step === 2 && (
        <section><h1>Which AI employees do you need?</h1><p>Select every module that should be considered during configuration.</p><div className="choice-grid">{agentOptions.map(([value, label]) => <button type="button" key={value} className={form.requested_agents.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, requested_agents: toggleValue(form.requested_agents, value) })}>{form.requested_agents.includes(value) && <Check size={16} />}{label}</button>)}</div></section>
      )}

      {step === 3 && (
        <section><h1>What should the system accomplish?</h1><p>These goals shape workflows, reporting, and the first agent prompt.</p><div className="choice-grid">{goalOptions.map(([value, label]) => <button type="button" key={value} className={form.business_goals.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, business_goals: toggleValue(form.business_goals, value) })}>{form.business_goals.includes(value) && <Check size={16} />}{label}</button>)}</div></section>
      )}

      {step === 4 && (
        <section><h1>Where should your AI work?</h1><p>Choose channels and existing tools. Credentials are connected later through secure integration screens.</p><h3>Channels</h3><div className="choice-grid compact">{channelOptions.map((value) => <button type="button" key={value} className={form.channels.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, channels: toggleValue(form.channels, value) })}>{value}</button>)}</div><h3>Existing tools</h3><div className="choice-grid compact">{toolOptions.map((value) => <button type="button" key={value} className={form.existing_tools.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, existing_tools: toggleValue(form.existing_tools, value) })}>{value}</button>)}</div></section>
      )}

      {step === 5 && (
        <section><h1>Set the human escalation contact.</h1><p>Your draft agent will hand off requests when confidence, authority, or business policy requires a person.</p><div className="form-grid two"><label>Contact name<input value={form.human_contact_name} onChange={(e) => setForm({ ...form, human_contact_name: e.target.value })} /></label><label>Contact email<input type="email" value={form.human_contact_email} onChange={(e) => setForm({ ...form, human_contact_email: e.target.value })} /></label><label className="full">Additional notes<textarea rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Business rules, operating hours, escalation notes..." /></label></div></section>
      )}

      {error && <p className="onboarding-error">{error}</p>}
      <div className="onboarding-actions">
        <button type="button" className="back" disabled={step === 1 || saving} onClick={() => setStep(Math.max(1, step - 1))}><ArrowLeft size={17} /> Back</button>
        {step < 5 ? <button type="button" className="next" disabled={saving} onClick={next}>{saving ? <Loader2 className="spin" size={17} /> : null} Save and continue <ArrowRight size={17} /></button> : <button type="button" className="next" disabled={saving} onClick={complete}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Create agent draft</button>}
      </div>
    </div>
  );
}
