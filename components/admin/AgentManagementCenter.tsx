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
    status: "draft", system_prompt: "", temperature: "0.3", language: "English", tone: "Professional and helpful",
    voice_provider: "", communication_channels: "", escalation_rules: "Low confidence\nPayment or account access\nLegal or compliance request\nCustomer requests a human",
    handoff_type: "team", handoff_label: "", handoff_email: "", handoff_phone: "", knowledge_sources: "", workflow_ids: [] as string[],
  };
}

type FormState = ReturnType<typeof blank>;

function fromAgent(agent: ManagedAgent, workflowIds: string[]): FormState {
  const handoff = agent.human_handoff_destination || {};
  const config = agent.configuration || {};
  return {
    id: agent.id,
    name: agent.name,
    slug: agent.slug,
    description: agent.description || "",
    agent_type: agent.agent_type || "custom_agent",
    project_id: agent.project_id,
    status: agent.status || "draft",
    system_prompt: agent.system_prompt || "",
    temperature: String(agent.temperature ?? 0.3),
    language: agent.language || "English",
    tone: String(config.tone || "Professional and helpful"),
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
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "draft">("all");
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
    const matchesProject = projectFilter === "all" || agent.project_id === projectFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "draft" ? agent.status === "draft" : agent.status !== "draft");
    return matchesText && matchesProject && matchesStatus;
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
        <div className="admin-panel-header"><div><h2>Agent registry</h2><p>Select an agent to inspect or edit its configuration. Drafts remain here until they are ready to join the live workforce.</p></div><button type="button" className="agent-new-button" onClick={() => setForm(blank(summary.projects[0]?.id))}>New agent</button></div>
        <div className="agent-status-tabs" aria-label="Filter agents by status">
          <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>All</button>
          <button type="button" className={statusFilter === "live" ? "active" : ""} onClick={() => setStatusFilter("live")}>Live</button>
          <button type="button" className={statusFilter === "draft" ? "active" : ""} onClick={() => setStatusFilter("draft")}>Drafts</button>
        </div>
        <div className="agent-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents" />
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">All workspaces</option>{summary.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        </div>
        <div className="agent-card-list">
          {filtered.map((agent) => {
            const connected = linksByAgent.get(agent.id) || [];
            return <button key={agent.id} type="button" className={`agent-card ${form.id === agent.id ? "selected" : ""}`} onClick={() => setForm(fromAgent(agent, connected))}>
              <span><strong>{agent.name}</strong><small>{projectMap.get(agent.project_id)?.name || "Unknown workspace"} · {agent.agent_type || "custom agent"}</small></span>
              <span className="agent-card-meta"><em>{agent.status}</em><small>{connected.length} workflow{connected.length === 1 ? "" : "s"}</small></span>
            </button>;
          })}
          {!filtered.length ? <div className="admin-empty-state"><strong>No agents match this view</strong><span>Adjust the search or filter to see more of the workforce.</span></div> : null}
        </div>
      </section>

      <section className="admin-panel agent-editor-panel">
        <div className="admin-panel-header"><div><h2>{form.id ? `Edit ${form.name || "Agent"}` : "Create agent"}</h2><p>Configure instructions, channels, handoff rules and connected workflows.</p></div><span className={form.status === "active" ? "admin-status live" : "admin-status warning"}>{form.status}</span></div>
        <div className="agent-form-grid">
          <label><span>Agent name</span><input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label><span>Agent type</span><input value={form.agent_type} onChange={(e) => set("agent_type", e.target.value)} placeholder="sales_agent" /></label>
          <label><span>Workspace</span><select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>{summary.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={(e) => set("status", e.target.value)}>{["draft","active","paused","disabled","error"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Temperature</span><input type="number" min="0" max="2" step="0.05" value={form.temperature} onChange={(e) => set("temperature", e.target.value)} /></label>
          <label><span>Language</span><input value={form.language} onChange={(e) => set("language", e.target.value)} /></label>
          <label><span>Tone</span><input value={form.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Professional and helpful" /></label>
          <label><span>Voice provider</span><input value={form.voice_provider} onChange={(e) => set("voice_provider", e.target.value)} placeholder="Leave empty when voice is not enabled" /></label>
          <label className="wide"><span>Purpose and description</span><input value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="wide"><span>Instructions</span><textarea rows={9} value={form.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} /></label>
          <label><span>Communication channels</span><textarea rows={5} value={form.communication_channels} onChange={(e) => set("communication_channels", e.target.value)} placeholder="WhatsApp\nTelegram\nEmail" /></label>
          <label><span>Escalation rules</span><textarea rows={5} value={form.escalation_rules} onChange={(e) => set("escalation_rules", e.target.value)} /></label>
          <label><span>Handoff destination</span><input value={form.handoff_label} onChange={(e) => set("handoff_label", e.target.value)} placeholder="Sales team" /><input value={form.handoff_email} onChange={(e) => set("handoff_email", e.target.value)} placeholder="team@example.com" /><input value={form.handoff_phone} onChange={(e) => set("handoff_phone", e.target.value)} placeholder="WhatsApp phone" /></label>
          <label><span>Knowledge sources</span><textarea rows={7} value={form.knowledge_sources} onChange={(e) => set("knowledge_sources", e.target.value)} placeholder="Website\nSupabase catalog\nGoogle Drive folder" /></label>
          <fieldset className="wide"><legend>Connected workflows</legend><div className="workflow-check-grid">{summary.workflows.map((workflow) => <label key={workflow.id}><input type="checkbox" checked={form.workflow_ids.includes(workflow.id)} onChange={(e) => set("workflow_ids", e.target.checked ? [...form.workflow_ids, workflow.id] : form.workflow_ids.filter((id) => id !== workflow.id))} /><span><strong>{workflow.name}</strong><small>{workflow.status}</small></span></label>)}</div></fieldset>
        </div>
        <div className="agent-save-row"><p>{result}</p><button type="button" disabled={isPending || !form.name || !form.project_id} onClick={save}>{isPending ? "Saving..." : form.status === "active" ? "Save active agent" : "Save draft"}</button></div>
      </section>

      <style jsx>{`
        .agent-management-grid{display:grid;grid-template-columns:minmax(280px,.74fr) minmax(0,1.35fr);gap:12px;align-items:start}.agent-status-tabs{display:flex;gap:6px;margin-bottom:10px}.agent-status-tabs button{min-height:32px;padding:6px 10px;border:1px solid rgba(143,151,165,.14);border-radius:8px;background:#0b1016;color:#8f97a5;font-size:.68rem;font-weight:720}.agent-status-tabs button.active{border-color:rgba(124,92,246,.34);background:rgba(124,92,246,.09);color:#d9d1ff}.agent-toolbar{display:grid;grid-template-columns:1fr .8fr;gap:8px;margin-bottom:12px}.agent-toolbar input,.agent-toolbar select,.agent-form-grid input,.agent-form-grid select,.agent-form-grid textarea{width:100%;box-sizing:border-box;border:1px solid #202630;border-radius:8px;background:#0b0f14;color:#f1f3f6;padding:10px 11px;font:inherit;box-shadow:none}.agent-card-list{display:grid;gap:6px;max-height:720px;overflow:auto}.agent-card{display:flex;justify-content:space-between;gap:14px;text-align:left;border:1px solid rgba(143,151,165,.12);border-radius:9px;background:#0b1016;color:#f1f3f6;padding:11px 12px;box-shadow:none}.agent-card:hover{border-color:rgba(143,151,165,.24);background:#0d1218}.agent-card.selected{border-color:rgba(124,92,246,.38);background:rgba(124,92,246,.07)}.agent-card span,.agent-card strong,.agent-card small{display:block}.agent-card strong{font-size:.74rem}.agent-card small{color:#7f8895;margin-top:4px;font-size:.62rem}.agent-card-meta{text-align:right}.agent-card em{color:#aab1bb;font-size:.62rem;font-style:normal;text-transform:capitalize}.agent-new-button{min-height:34px!important;padding:7px 10px!important;border:1px solid rgba(143,151,165,.16)!important;border-radius:8px!important;background:#11161d!important;color:#d6dbe2!important;box-shadow:none!important}.agent-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.agent-form-grid label>span,.agent-form-grid legend{display:block;color:#8f97a5;font-size:.66rem;font-weight:750;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px}.agent-form-grid .wide{grid-column:1/-1}.agent-form-grid label input+input{margin-top:7px}.agent-form-grid fieldset{border:1px solid rgba(143,151,165,.14);border-radius:10px;padding:12px}.workflow-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.workflow-check-grid label{display:flex;gap:9px;align-items:flex-start;border:1px solid rgba(143,151,165,.11);border-radius:8px;padding:9px;background:#0b1016}.workflow-check-grid input{width:auto}.workflow-check-grid span,.workflow-check-grid strong,.workflow-check-grid small{display:block}.workflow-check-grid strong{font-size:.68rem}.workflow-check-grid small{color:#77808c;margin-top:3px;font-size:.6rem}.agent-save-row{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:16px}.agent-save-row p{color:#9ca4af;font-size:.67rem}.agent-save-row button{min-height:38px;border:1px solid rgba(124,92,246,.34);border-radius:8px;background:#6d43d7;color:white;font-weight:760;padding:8px 13px;box-shadow:none}.agent-save-row button:disabled{opacity:.45}@media(max-width:980px){.agent-management-grid{grid-template-columns:1fr}.agent-card-list{max-height:430px}}@media(max-width:650px){.agent-toolbar,.agent-form-grid,.workflow-check-grid{grid-template-columns:1fr}.agent-form-grid .wide{grid-column:auto}.agent-save-row{align-items:stretch;flex-direction:column}.agent-save-row button{width:100%}}
      `}</style>
    </div>
  );
}
