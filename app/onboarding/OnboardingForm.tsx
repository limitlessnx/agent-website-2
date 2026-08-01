"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import type { ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

const goalOptions = [["generate_leads", "Generate leads"], ["qualify_prospects", "Qualify prospects"], ["book_appointments", "Book appointments"], ["answer_questions", "Answer customer questions"], ["follow_up_leads", "Follow up leads"], ["send_reminders", "Send reminders"], ["make_outbound_calls", "Make outbound calls"], ["manage_customer_records", "Manage customer records"]];
const channelOptions = ["Website chat", "WhatsApp", "Telegram", "Email", "Phone calls", "Instagram/Facebook", "Internal dashboard"];
const toolOptions = ["Supabase", "Google Sheets", "Gmail", "Google Calendar", "HubSpot", "Airtable", "n8n", "ElevenLabs", "Vapi", "Other CRM"];
const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export default function OnboardingForm({ initialProfile }: { initialProfile: ClientOnboardingProfile }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialProfile.current_step || 1, 4));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ business_name: initialProfile.business_name || "", industry: initialProfile.industry || "", website: initialProfile.website || "", country: initialProfile.country || "Nigeria", timezone: initialProfile.timezone || "Africa/Lagos", business_email: initialProfile.business_email || "", phone: initialProfile.phone || "", staff_size: initialProfile.staff_size || "", requested_agents: [], business_goals: initialProfile.business_goals || [], channels: initialProfile.channels || [], existing_tools: initialProfile.existing_tools || [], human_contact_name: initialProfile.human_contact_name || "", human_contact_email: initialProfile.human_contact_email || "", notes: initialProfile.notes || "" });
  const progress = useMemo(() => `${Math.round((step / 4) * 100)}%`, [step]);

  async function save(nextStep = step) {
    setSaving(true); setError("");
    const response = await fetch("/api/client-onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, current_step: nextStep }) });
    const result = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) throw new Error(result.error || "Unable to save onboarding progress.");
  }

  async function next() {
    try {
      if (step === 1 && (!form.business_name.trim() || !form.industry.trim())) return setError("Business name and industry are required.");
      if (step === 2 && !form.business_goals.length) return setError("Select at least one business goal.");
      const nextStep = Math.min(4, step + 1); await save(nextStep); setStep(nextStep);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to continue."); }
  }

  async function complete() {
    if (!form.human_contact_email.trim()) return setError("A human contact email is required for escalation.");
    try {
      setSaving(true); setError(""); await save(4);
      const response = await fetch("/api/client-onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to complete onboarding.");
      router.push("/portal/agents/select"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to complete onboarding."); } finally { setSaving(false); }
  }

  return <div className="onboarding-shell"><div className="onboarding-progress"><span style={{ width: progress }} /></div><div className="onboarding-heading"><div className="small-label"><Sparkles size={13} /> Business setup</div><p>Step {step} of 4</p></div>
    {step === 1 && <section><h1>Tell us about your business.</h1><p>This creates the shared context every selected agent will use later.</p><div className="form-grid two"><label>Business name<input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></label><label>Industry<input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></label><label>Website<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label><label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label><label>Time zone<input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label><label>Staff size<input value={form.staff_size} onChange={(e) => setForm({ ...form, staff_size: e.target.value })} /></label><label>Business email<input type="email" value={form.business_email} onChange={(e) => setForm({ ...form, business_email: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div></section>}
    {step === 2 && <section><h1>What should AI improve?</h1><p>Your answers will recommend suitable standard agents after onboarding.</p><div className="choice-grid">{goalOptions.map(([value, label]) => <button type="button" key={value} className={form.business_goals.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, business_goals: toggle(form.business_goals, value) })}>{form.business_goals.includes(value) && <Check size={16} />}{label}</button>)}</div></section>}
    {step === 3 && <section><h1>Where does your business operate?</h1><h3>Customer channels</h3><div className="choice-grid compact">{channelOptions.map((value) => <button type="button" key={value} className={form.channels.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, channels: toggle(form.channels, value) })}>{value}</button>)}</div><h3>Existing tools</h3><div className="choice-grid compact">{toolOptions.map((value) => <button type="button" key={value} className={form.existing_tools.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, existing_tools: toggle(form.existing_tools, value) })}>{value}</button>)}</div></section>}
    {step === 4 && <section><h1>Set the human escalation contact.</h1><p>Agents will hand off requests involving low confidence, authority limits or business policy.</p><div className="form-grid two"><label>Contact name<input value={form.human_contact_name} onChange={(e) => setForm({ ...form, human_contact_name: e.target.value })} /></label><label>Contact email<input type="email" value={form.human_contact_email} onChange={(e) => setForm({ ...form, human_contact_email: e.target.value })} /></label><label className="full">Business rules and notes<textarea rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div></section>}
    {error && <p className="onboarding-error">{error}</p>}<div className="onboarding-actions"><button type="button" className="back" disabled={step === 1 || saving} onClick={() => setStep(Math.max(1, step - 1))}><ArrowLeft size={17} /> Back</button>{step < 4 ? <button type="button" className="next" disabled={saving} onClick={next}>{saving ? <Loader2 className="spin" size={17} /> : null} Save and continue <ArrowRight size={17} /></button> : <button type="button" className="next" disabled={saving} onClick={complete}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Continue to agent selection</button>}</div>
  </div>;
}
