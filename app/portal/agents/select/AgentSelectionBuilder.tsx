"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, Loader2, Settings2 } from "lucide-react";

const agents = [
  { key: "ai_sales_agent", name: "AI Sales Agent", description: "Qualifies prospects, answers objections and moves opportunities forward.", setup: 250000, monthly: 100000 },
  { key: "customer_support_agent", name: "Customer Support Agent", description: "Answers routine questions and escalates sensitive requests.", setup: 220000, monthly: 90000 },
  { key: "whatsapp_agent", name: "WhatsApp Agent", description: "Runs business conversations, lead capture and handover on WhatsApp.", setup: 180000, monthly: 75000 },
  { key: "appointment_agent", name: "Appointment Agent", description: "Books, confirms and reschedules appointments.", setup: 150000, monthly: 60000 },
  { key: "email_automation", name: "Email Follow-up Agent", description: "Runs structured follow-up sequences and stops when leads reply.", setup: 180000, monthly: 70000 },
  { key: "voice_receptionist", name: "Voice Receptionist", description: "Handles inbound calls, qualification and call transfers.", setup: 350000, monthly: 150000 },
  { key: "outbound_call_agent", name: "Outbound Call Agent", description: "Calls approved contacts, records outcomes and updates the CRM.", setup: 400000, monthly: 180000 },
  { key: "crm_followup_agent", name: "CRM Follow-up Agent", description: "Tracks pipeline stages, reminders and customer follow-up tasks.", setup: 200000, monthly: 80000 },
];

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function AgentSelectionBuilder() {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const totals = useMemo(() => agents.filter((agent) => selected.includes(agent.key)).reduce((value, agent) => ({ setup: value.setup + agent.setup, monthly: value.monthly + agent.monthly }), { setup: 0, monthly: 0 }), [selected]);

  function toggle(key: string) {
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/agent-selections", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_keys: selected }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Your agent package is saved. Checkout will be enabled after payment integration is approved." : result.error || "Unable to save your package.");
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-kicker">Agent marketplace</p><h1>Choose the AI employees your business needs.</h1><p>Standard agents receive fixed scope and pricing. Custom systems follow a reviewed proposal process.</p></div></header>
      <section className="admin-panel"><div className="admin-list">
        {agents.map((agent) => {
          const active = selected.includes(agent.key);
          return <button type="button" key={agent.key} className={`admin-list-row ${active ? "selected" : ""}`} onClick={() => toggle(agent.key)} style={{ width: "100%", textAlign: "left" }}>
            <span>{active ? <Check size={18} /> : <Bot size={18} />}</span><div style={{ flex: 1 }}><strong>{agent.name}</strong><span>{agent.description}</span></div><em>{money.format(agent.setup)} setup · {money.format(agent.monthly)}/month</em>
          </button>;
        })}
      </div></section>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Package summary</h2><p>{selected.length} standard agent{selected.length === 1 ? "" : "s"} selected</p></div><Settings2 size={18} /></div><div className="admin-list-row"><div><strong>{money.format(totals.setup)} setup</strong><span>{money.format(totals.monthly)} recurring monthly, excluding usage-based provider costs.</span></div><button type="button" disabled={!selected.length || saving} onClick={save}>{saving ? <Loader2 className="spin" size={16} /> : "Save package"}</button></div>{message ? <p>{message}</p> : null}</section>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Need something custom?</h2><p>Submit the business process, platforms, required actions, budget range and target launch date for review.</p></div><Link href="/portal/agents/custom">Request custom build</Link></div></section>
    </main>
  );
}
