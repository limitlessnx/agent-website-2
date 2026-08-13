"use client";

import { useState } from "react";
import { Loader2 } from "@/components/admin/ServerIcons";

export default function CustomAgentRequestPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", problem_statement: "", current_process: "", desired_actions: "", required_channels: "", required_integrations: "", expected_volume: "", budget_range: "", desired_launch_date: "" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/custom-agent-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, required_channels: form.required_channels.split(",").map((v) => v.trim()).filter(Boolean), required_integrations: form.required_integrations.split(",").map((v) => v.trim()).filter(Boolean) }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Your custom build request was submitted for review." : result.error || "Unable to submit request.");
  }

  return <main className="admin-page"><header className="admin-page-header"><div><p className="admin-kicker">Custom AI system</p><h1>Describe the business process you want built.</h1><p>Fluxknight will review the scope, integrations, feasibility, pricing and milestones before any payment is requested.</p></div></header><form className="admin-panel" onSubmit={submit}><div className="form-grid two"><label>Request title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Budget range<input value={form.budget_range} onChange={(e) => setForm({ ...form, budget_range: e.target.value })} placeholder="₦500k–₦1.5m" /></label><label className="full">Problem to solve<textarea required rows={5} value={form.problem_statement} onChange={(e) => setForm({ ...form, problem_statement: e.target.value })} /></label><label className="full">Current process<textarea rows={4} value={form.current_process} onChange={(e) => setForm({ ...form, current_process: e.target.value })} /></label><label className="full">Actions the agent must perform<textarea rows={5} value={form.desired_actions} onChange={(e) => setForm({ ...form, desired_actions: e.target.value })} /></label><label>Channels, comma separated<input value={form.required_channels} onChange={(e) => setForm({ ...form, required_channels: e.target.value })} placeholder="WhatsApp, phone, email" /></label><label>Platforms, comma separated<input value={form.required_integrations} onChange={(e) => setForm({ ...form, required_integrations: e.target.value })} placeholder="Supabase, HubSpot, Google Calendar" /></label><label>Expected usage<input value={form.expected_volume} onChange={(e) => setForm({ ...form, expected_volume: e.target.value })} placeholder="5,000 messages monthly" /></label><label>Desired launch date<input type="date" value={form.desired_launch_date} onChange={(e) => setForm({ ...form, desired_launch_date: e.target.value })} /></label></div>{message ? <p>{message}</p> : null}<button type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : "Submit for review"}</button></form></main>;
}
