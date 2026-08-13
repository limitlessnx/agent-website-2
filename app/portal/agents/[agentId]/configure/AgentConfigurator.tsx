"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Play, Save, Send, ShieldCheck } from "@/components/admin/ServerIcons";

const channelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "web_chat", label: "Website Chat" },
  { value: "telegram", label: "Telegram" },
  { value: "voice", label: "Voice" },
] as const;

type AgentData = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  status: string;
  language: string;
  temperature: number;
  communication_channels: string[];
  escalation_rules: Record<string, unknown>;
  human_handoff_destination: Record<string, unknown>;
  configuration: Record<string, any>;
};

export default function AgentConfigurator({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("Hello, I need help with your services.");
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/configuration`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load agent.");
      setAgent(result.agent);
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [agentId]);

  function update<K extends keyof AgentData>(key: K, value: AgentData[K]) {
    setAgent((current) => current ? { ...current, [key]: value } : current);
  }

  function toggleChannel(channel: string) {
    setAgent((current) => {
      if (!current) return current;
      const selected = Array.isArray(current.communication_channels) ? current.communication_channels : [];
      return {
        ...current,
        communication_channels: selected.includes(channel)
          ? selected.filter((value) => value !== channel)
          : [...selected, channel],
      };
    });
  }

  async function save() {
    if (!agent) return;
    setSaving(true); setMessage("");
    const response = await fetch(`/api/agents/${agentId}/configuration`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agent.name,
        description: agent.description,
        system_prompt: agent.system_prompt,
        language: agent.language,
        temperature: Number(agent.temperature),
        communication_channels: agent.communication_channels,
        qualification_questions: agent.configuration?.qualification_questions || [],
        working_hours: agent.configuration?.working_hours || {},
        channel_instructions: agent.configuration?.channel_instructions || {},
        escalation_rules: agent.escalation_rules || {},
        human_handoff_destination: agent.human_handoff_destination || {},
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Configuration saved. Agent moved to testing." : result.error || "Unable to save configuration.");
    if (response.ok) setAgent((current) => current ? { ...current, status: result.agent.status } : current);
  }

  async function runTest() {
    setTesting(true); setMessage(""); setTestResult(null);
    const response = await fetch(`/api/agents/${agentId}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: testMessage }) });
    const result = await response.json().catch(() => ({}));
    setTesting(false);
    if (response.ok) setTestResult(result.test);
    else setMessage(result.error || "Test failed.");
  }

  async function submitApproval() {
    setSubmitting(true); setMessage("");
    const response = await fetch(`/api/agents/${agentId}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: "Configuration submitted from client workspace." }) });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);
    setMessage(response.ok ? "Agent submitted for internal approval." : `${result.error || "Unable to submit."}${result.readiness ? ` Missing: ${Object.entries(result.readiness).filter(([, value]) => value === false || Array.isArray(value) && value.length).map(([key]) => key).join(", ")}` : ""}`);
  }

  if (loading) return <main className="portal-page"><p><Loader2 className="spin" size={18} /> Loading agent configuration…</p></main>;
  if (!agent) return <main className="portal-page"><p>{message || "Agent not found."}</p></main>;

  const qualification = Array.isArray(agent.configuration?.qualification_questions) ? agent.configuration.qualification_questions.join("\n") : "";
  const channels = Array.isArray(agent.communication_channels) ? agent.communication_channels : [];
  const selectedChannelLabels = channelOptions.filter((option) => channels.includes(option.value)).map((option) => option.label);

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <div><p className="admin-kicker">Agent configuration</p><h1>{agent.name}</h1><p>Define behavior, permissions, handoff rules and test readiness before workflow connection.</p></div>
        <Link href="/portal/agents">Back to agents</Link>
      </header>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Identity and behavior</h2><p>Status: {agent.status}</p></div><ShieldCheck size={20} /></div>
        <div className="admin-form-grid">
          <label><span>Agent name</span><input value={agent.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label><span>Language</span><input value={agent.language || "en"} onChange={(event) => update("language", event.target.value)} /></label>
          <label className="admin-form-wide"><span>Description</span><textarea value={agent.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
          <label className="admin-form-wide"><span>System prompt</span><textarea rows={12} value={agent.system_prompt || ""} onChange={(event) => update("system_prompt", event.target.value)} placeholder="Define the organisation, role, approved actions, restrictions and response standards." /></label>
          <label><span>Temperature: {Number(agent.temperature || 0.3).toFixed(1)}</span><input type="range" min="0" max="1" step="0.1" value={agent.temperature || 0.3} onChange={(event) => update("temperature", Number(event.target.value))} /></label>
          <div>
            <span>Messaging channels</span>
            <details className="portal-channel-multiselect">
              <summary>{selectedChannelLabels.length ? selectedChannelLabels.join(", ") : "Select channels"}</summary>
              <div className="portal-channel-options">
                {channelOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={channels.includes(option.value)}
                      onChange={() => toggleChannel(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
          <label className="admin-form-wide"><span>Qualification questions, one per line</span><textarea value={qualification} onChange={(event) => setAgent((current) => current ? { ...current, configuration: { ...current.configuration, qualification_questions: event.target.value.split("\n").filter(Boolean) } } : current)} /></label>
          <label className="admin-form-wide"><span>Human handoff destination</span><input value={String(agent.human_handoff_destination?.contact || "")} onChange={(event) => update("human_handoff_destination", { ...agent.human_handoff_destination, contact: event.target.value })} placeholder="team email, phone or queue" /></label>
          <label className="admin-form-wide"><span>Escalation conditions</span><textarea value={String(agent.escalation_rules?.conditions || "")} onChange={(event) => update("escalation_rules", { ...agent.escalation_rules, conditions: event.target.value })} placeholder="Buyer intent, complaints, pricing exceptions, legal or sensitive requests…" /></label>
        </div>
        <button type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save configuration</button>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Configuration test</h2><p>This validates setup only. It does not call an external model or n8n.</p></div><Play size={20} /></div>
        <label><span>Test customer message</span><textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} /></label>
        <button type="button" onClick={runTest} disabled={testing}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />} Run validation</button>
        {testResult ? <div className="portal-list-row"><div><strong><CheckCircle2 size={15} /> Test {testResult.status}</strong><span>{testResult.output?.response}</span></div><em>{testResult.score}%</em></div> : null}
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Approval</h2><p>Submission is accepted only when prompt, handoff, required connections and a passed test are present.</p></div><Send size={20} /></div>
        <button type="button" onClick={submitApproval} disabled={submitting}>{submitting ? <Loader2 className="spin" size={16} /> : <Send size={16} />} Submit for approval</button>
        {message ? <p>{message}</p> : null}
      </section>
    </main>
  );
}
