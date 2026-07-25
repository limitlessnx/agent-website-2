"use client";

import { useMemo, useState, useTransition } from "react";
import type { AgentManagementSummary, ManagedAgent } from "@/lib/agent-management";

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item : String((item as Record<string, unknown>)?.label || (item as Record<string, unknown>)?.value || "")).filter(Boolean).join("\n")
    : "";
}

function blank(projectId = "") {
  return {
    id: "", name: "", slug: "", description: "", agent_type: "custom_agent", project_id: projectId,
    status: "draft", system_prompt: "", ai_model: "gpt-4.1-mini", temperature: "0.3", language: "English",
    voice_provider: "", communication_channels: "", escalation_rules: "Low confidence\nPayment or account access\nLegal or compliance request\nCustomer requests a human",
    handoff_type: "team", handoff_label: "", handoff_email: "", handoff_phone: "", knowledge_sources: "", workflow_ids: [] as string[],
  };
}

type FormState = ReturnType<typeof blank>;

function fromAgent(agent: ManagedAgent, workflowIds: string[]): FormState {
  const handoff = agent.human_handoff_destination || {};
  return {
    id: agent.id,
    name: agent.name,
    slug: agent.slug,
    description: agent.description || "",
    agent_type: agent.agent_type || "custom_agent",
    project_id: agent.project_id,
    status: agent.status || "draft",
    system_prompt: agent.system_prompt || "",
    ai_model: agent.ai_model || "gpt-4.1-mini",
    temperature: String(agent.temperature ?? 0.3),
    language: agent.language || "English",
    voice_provider: agent.voice_provider || "",
    communication_channels: list(agent.communication_channels),
    escalation_rules: list(agent.escalation_rules),
    handoff_type: String(handoff.type || "team"),
    handoff_label: String(handoff.label || handoff.name || ""),
    handoff_email: String(handoff.email || ""),
    handoff_phone: String(handoff.phone || ""),
    knowledge_sources: list(agent.knowledge_sources),
    workflow_ids: workflowIds,
  };
}

export default function AgentManagementCenter({ summary }: { summary: AgentManagementSummary }) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [form, setForm] = useState<FormState>(blank(summary.projects[0]?.id));
  const [result, setResult] = useState("");
  const [isPending, startTransition] = useTransition();

  const projectMap = useMemo(() => new Map(summary.projects.map((project) => [project.id, project])), [summary.projects]);
  const linksByAgent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of summary.links) map.set(link.agent_id, [...(map.get(link.agent_id) || []), link.workflow_id]);
    return map;
  }, [summary.links]);

  const filtered = summary.agents.filter((agent) => {
    const needle = query.trim().toLowerCase();
    const matchesText = !needle || [agent.name, agent.agent_type, agent.status, projectMap.get(agent.project_id)?.name].some((value) => String(value || "").toLowerCase().includes(needle));
    return matchesText && (projectFilter === "all" || agent.project_id === projectFilter);
  });

  const set = (key: keyof FormState, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    setResult("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Agent save failed.");
        setResult(`${data.agent.name} saved successfully.`);
        window.location.reload();
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Agent save failed.");
      }
    });
  };

  return (
    <div className="agent-management-grid">
      <section className="admin-panel agent-registry-panel">
        <div className="admin-panel-header"><div><h2>Agent Registry</h2><p>Manage every AI employee by project, status, model, channel and workflow.</p></div><button type="button" onClick={() => setForm(blank(summary.projects[0]?.id))}>New agent</button></div>
        <div className="agent-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents..." />
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">All projects</option>{summary.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        </div>
        <div className="agent-card-list">
          {filtered.map((agent) => {
            const connected = linksByAgent.get(agent.id) || [];
            return <button key={agent.id} type="button" className={`agent-card ${form.id === agent.id ? "selected" : ""}`} onClick={() => setForm(fromAgent(agent, connected))}>
              <span><strong>{agent.name}</strong><small>{projectMap.get(agent.project_id)?.name || "Unknown project"} · {agent.agent_type || "custom agent"}</small></span>
              <span className="agent-card-meta"><em>{agent.status}</em><small>{agent.ai_model || "model unset"} · {connected.length} workflows</small></span>
            </button>;
          })}
          {!filtered.length ? <p className="admin-empty">No agents match this view.</p> : null}
        </div>
      </section>

      <section className="admin-panel agent-editor-panel">
        <div className="admin-panel-header"><div><h2>{form.id ? "Edit Agent" : "Create Agent"}</h2><p>Configuration changes are stored in the canonical agent record.</p></div><span className="admin-status live">Phase 3</span></div>
        <div className="agent-form-grid">
          <label><span>Agent name</span><input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label><span>Agent type</span><input value={form.agent_type} onChange={(e) => set("agent_type", e.target.value)} placeholder="sales_agent" /></label>
          <label><span>Project</span><select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>{summary.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={(e) => set("status", e.target.value)}>{["draft","active","paused","disabled","error"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>AI model</span><select value={form.ai_model} onChange={(e) => set("ai_model", e.target.value)}>{["gpt-4.1-mini","gpt-4.1","gpt-5-mini","gpt-5","claude-sonnet","gemini-2.5-flash"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Temperature</span><input type="number" min="0" max="2" step="0.05" value={form.temperature} onChange={(e) => set("temperature", e.target.value)} /></label>
          <label><span>Language</span><input value={form.language} onChange={(e) => set("language", e.target.value)} /></label>
          <label><span>Voice provider</span><select value={form.voice_provider} onChange={(e) => set("voice_provider", e.target.value)}><option value="">None</option><option>ElevenLabs</option><option>Vapi</option><option>Retell AI</option><option>OpenAI</option></select></label>
          <label className="wide"><span>Description</span><input value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="wide"><span>System prompt</span><textarea rows={9} value={form.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} /></label>
          <label><span>Communication channels</span><textarea rows={5} value={form.communication_channels} onChange={(e) => set("communication_channels", e.target.value)} placeholder="WhatsApp\nTelegram\nEmail" /></label>
          <label><span>Escalation rules</span><textarea rows={5} value={form.escalation_rules} onChange={(e) => set("escalation_rules", e.target.value)} /></label>
          <label><span>Handoff destination</span><input value={form.handoff_label} onChange={(e) => set("handoff_label", e.target.value)} placeholder="Sales team" /><input value={form.handoff_email} onChange={(e) => set("handoff_email", e.target.value)} placeholder="team@example.com" /><input value={form.handoff_phone} onChange={(e) => set("handoff_phone", e.target.value)} placeholder="WhatsApp phone" /></label>
          <label><span>Knowledge sources</span><textarea rows={7} value={form.knowledge_sources} onChange={(e) => set("knowledge_sources", e.target.value)} placeholder="Website\nSupabase catalog\nGoogle Drive folder" /></label>
          <fieldset className="wide"><legend>Connected workflows</legend><div className="workflow-check-grid">{summary.workflows.map((workflow) => <label key={workflow.id}><input type="checkbox" checked={form.workflow_ids.includes(workflow.id)} onChange={(e) => set("workflow_ids", e.target.checked ? [...form.workflow_ids, workflow.id] : form.workflow_ids.filter((id) => id !== workflow.id))} /><span><strong>{workflow.name}</strong><small>{workflow.organization_id} · {workflow.status}</small></span></label>)}</div></fieldset>
        </div>
        <div className="agent-save-row"><p>{result}</p><button type="button" disabled={isPending || !form.name || !form.project_id} onClick={save}>{isPending ? "Saving..." : "Save agent"}</button></div>
      </section>

      <style jsx>{`
        .agent-management-grid{display:grid;grid-template-columns:minmax(280px,.78fr) minmax(0,1.35fr);gap:22px;align-items:start}.agent-toolbar{display:grid;grid-template-columns:1fr .8fr;gap:10px;margin-bottom:16px}.agent-toolbar input,.agent-toolbar select,.agent-form-grid input,.agent-form-grid select,.agent-form-grid textarea{width:100%;box-sizing:border-box;border:1px solid rgba(166,113,255,.22);border-radius:12px;background:#09050f;color:white;padding:12px;font:inherit}.agent-card-list{display:grid;gap:9px;max-height:780px;overflow:auto}.agent-card{display:flex;justify-content:space-between;gap:14px;text-align:left;border:1px solid rgba(166,113,255,.16);border-radius:14px;background:#0b0613;color:white;padding:14px}.agent-card.selected{border-color:#9f67ff;background:#160a27}.agent-card span,.agent-card strong,.agent-card small{display:block}.agent-card small{color:#9e92ae;margin-top:4px}.agent-card-meta{text-align:right}.agent-card em{color:#c99cff;font-style:normal}.agent-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.agent-form-grid label>span,.agent-form-grid legend{display:block;color:#a99cbd;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px}.agent-form-grid .wide{grid-column:1/-1}.agent-form-grid label input+input{margin-top:8px}.agent-form-grid fieldset{border:1px solid rgba(166,113,255,.18);border-radius:14px;padding:14px}.workflow-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.workflow-check-grid label{display:flex;gap:10px;align-items:flex-start;border:1px solid rgba(166,113,255,.14);border-radius:10px;padding:10px}.workflow-check-grid input{width:auto}.workflow-check-grid span,.workflow-check-grid strong,.workflow-check-grid small{display:block}.workflow-check-grid small{color:#9286a2;margin-top:3px}.agent-save-row{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:18px}.agent-save-row p{color:#c9b6e5}.agent-save-row button,.admin-panel-header button{border:0;border-radius:12px;background:linear-gradient(135deg,#9d55ff,#6d28d9);color:white;font-weight:800;padding:12px 17px}.agent-save-row button:disabled{opacity:.45}@media(max-width:980px){.agent-management-grid{grid-template-columns:1fr}.agent-card-list{max-height:430px}}@media(max-width:650px){.agent-toolbar,.agent-form-grid,.workflow-check-grid{grid-template-columns:1fr}.agent-form-grid .wide{grid-column:auto}.agent-save-row{align-items:stretch;flex-direction:column}.agent-save-row button{width:100%}}
      `}</style>
    </div>
  );
}