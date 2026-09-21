"use client";

import { useMemo, useState, useTransition } from "react";
import type { AgentManagementSummary, ManagedAgent } from "@/lib/agent-management";

function lines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : String((item as Record<string, unknown>)?.label || (item as Record<string, unknown>)?.value || "")))
    .map((item) => item.trim())
    .filter(Boolean);
}

function list(value: unknown) {
  return lines(value).join("\n");
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

function hasHandoff(agent: ManagedAgent) {
  return Boolean(agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length);
}

function statusTone(status = "draft") {
  if (status === "active") return "live";
  if (status === "error" || status === "disabled") return "danger";
  if (status === "paused") return "warning";
  return "draft";
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

  const selectedWorkflows = summary.workflows.filter((workflow) => form.workflow_ids.includes(workflow.id));
  const selectedProject = projectMap.get(form.project_id);
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
        <div className="admin-panel-header">
          <div>
            <p className="agent-panel-kicker">Roster</p>
            <h2>Agent Builder</h2>
            <p>Select an AI worker, inspect its readiness, then edit without hunting through database-shaped misery.</p>
          </div>
          <button type="button" onClick={() => setForm(blank(summary.projects[0]?.id))}>New agent</button>
        </div>

        <div className="agent-status-tabs" aria-label="Filter agents by status">
          <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>All</button>
          <button type="button" className={statusFilter === "live" ? "active" : ""} onClick={() => setStatusFilter("live")}>Live</button>
          <button type="button" className={statusFilter === "draft" ? "active" : ""} onClick={() => setStatusFilter("draft")}>Drafts</button>
        </div>

        <div className="agent-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents, roles or workspaces..." />
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">All workspaces</option>
            {summary.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>

        <div className="agent-card-list">
          {filtered.map((agent) => {
            const connected = linksByAgent.get(agent.id) || [];
            const channels = lines(agent.communication_channels);
            const tone = statusTone(agent.status);
            return (
              <button key={agent.id} type="button" className={`agent-card status-${tone} ${form.id === agent.id ? "selected" : ""}`} onClick={() => setForm(fromAgent(agent, connected))}>
                <span className="agent-card-head">
                  <span>
                    <strong>{agent.name}</strong>
                    <small>{projectMap.get(agent.project_id)?.name || "Unknown workspace"} · {agent.agent_type || "custom agent"}</small>
                  </span>
                  <em>{agent.status}</em>
                </span>
                <span className="agent-card-body">{agent.description || "No operating brief has been written for this agent yet."}</span>
                <span className="agent-card-pills">
                  {channels.length ? channels.slice(0, 3).map((channel) => <small key={channel}>{channel}</small>) : <small>No channels</small>}
                  {channels.length > 3 ? <small>+{channels.length - 3}</small> : null}
                </span>
                <span className="agent-card-foot">
                  <small>{connected.length} workflow{connected.length === 1 ? "" : "s"}</small>
                  <small>{hasHandoff(agent) ? "handoff ready" : "handoff missing"}</small>
                  <b>Configure</b>
                </span>
              </button>
            );
          })}
          {!filtered.length ? <p className="admin-empty">No agents match this view.</p> : null}
        </div>
      </section>

      <section className="admin-panel agent-editor-panel">
        <div className="admin-panel-header">
          <div>
            <p className="agent-panel-kicker">Configuration</p>
            <h2>{form.id ? `Edit ${form.name || "Agent"}` : "Create Agent"}</h2>
            <p>{selectedProject ? `${selectedProject.name} workspace` : "Choose a workspace"} · {selectedWorkflows.length} connected workflow{selectedWorkflows.length === 1 ? "" : "s"}</p>
          </div>
          <span className={`admin-status ${form.status === "active" ? "live" : "warning"}`}>{form.status}</span>
        </div>

        <div className="agent-editor-summary">
          <div>
            <strong>{form.name || "Unnamed agent"}</strong>
            <span>{form.agent_type || "custom_agent"}</span>
          </div>
          <div>
            <strong>{form.communication_channels.split("\n").filter(Boolean).length}</strong>
            <span>channels</span>
          </div>
          <div>
            <strong>{form.escalation_rules.split("\n").filter(Boolean).length}</strong>
            <span>handoff rules</span>
          </div>
          <div>
            <strong>{form.workflow_ids.length}</strong>
            <span>workflows</span>
          </div>
        </div>

        <div className="agent-form-grid">
          <label><span>Agent name</span><input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label><span>Agent type</span><input value={form.agent_type} onChange={(e) => set("agent_type", e.target.value)} placeholder="sales_agent" /></label>
          <label><span>Workspace</span><select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>{summary.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={(e) => set("status", e.target.value)}>{["draft","active","paused","disabled","error"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Temperature</span><input type="number" min="0" max="2" step="0.05" value={form.temperature} onChange={(e) => set("temperature", e.target.value)} /></label>
          <label><span>Language</span><input value={form.language} onChange={(e) => set("language", e.target.value)} /></label>
          <label><span>Tone</span><input value={form.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Professional and helpful" /></label>
          <label><span>Voice provider</span><input value={form.voice_provider} onChange={(e) => set("voice_provider", e.target.value)} placeholder="Leave empty when voice is not enabled" /></label>
          <label className="wide"><span>Purpose and description</span><input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What this agent is responsible for" /></label>
          <label className="wide"><span>Instructions</span><textarea rows={9} value={form.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} placeholder="How this agent should speak, decide, escalate and complete tasks" /></label>
          <label><span>Communication channels</span><textarea rows={5} value={form.communication_channels} onChange={(e) => set("communication_channels", e.target.value)} placeholder="WhatsApp\nTelegram\nEmail" /></label>
          <label><span>Escalation rules</span><textarea rows={5} value={form.escalation_rules} onChange={(e) => set("escalation_rules", e.target.value)} /></label>
          <label><span>Handoff destination</span><input value={form.handoff_label} onChange={(e) => set("handoff_label", e.target.value)} placeholder="Sales team" /><input value={form.handoff_email} onChange={(e) => set("handoff_email", e.target.value)} placeholder="team@example.com" /><input value={form.handoff_phone} onChange={(e) => set("handoff_phone", e.target.value)} placeholder="WhatsApp phone" /></label>
          <label><span>Knowledge sources</span><textarea rows={7} value={form.knowledge_sources} onChange={(e) => set("knowledge_sources", e.target.value)} placeholder="Website\nSupabase catalog\nGoogle Drive folder" /></label>
          <fieldset className="wide"><legend>Connected workflows</legend><div className="workflow-check-grid">{summary.workflows.map((workflow) => <label key={workflow.id}><input type="checkbox" checked={form.workflow_ids.includes(workflow.id)} onChange={(e) => set("workflow_ids", e.target.checked ? [...form.workflow_ids, workflow.id] : form.workflow_ids.filter((id) => id !== workflow.id))} /><span><strong>{workflow.name}</strong><small>{workflow.status}</small></span></label>)}</div></fieldset>
        </div>

        <div className="agent-save-row"><p>{result}</p><button type="button" disabled={isPending || !form.name || !form.project_id} onClick={save}>{isPending ? "Saving..." : form.status === "active" ? "Save active agent" : "Save draft"}</button></div>
      </section>

      <style jsx>{`
        .agent-management-grid{display:grid;grid-template-columns:minmax(310px,.82fr) minmax(0,1.4fr);gap:22px;align-items:start}.agent-registry-panel,.agent-editor-panel{overflow:hidden}.agent-panel-kicker{margin:0 0 6px;color:var(--fk-brand-hover);font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.agent-status-tabs{display:flex;gap:8px;margin-bottom:14px}.agent-status-tabs button{min-height:36px;border:1px solid var(--fk-border);border-radius:999px;background:transparent;color:var(--fk-text-muted);padding:0 13px;font-weight:800;cursor:pointer}.agent-status-tabs button:hover{color:var(--fk-text);background:var(--fk-surface-hover)}.agent-status-tabs button.active{background:var(--fk-brand-soft);border-color:var(--fk-border-strong);color:var(--fk-text)}.agent-toolbar{display:grid;grid-template-columns:1fr .82fr;gap:10px;margin-bottom:16px}.agent-toolbar input,.agent-toolbar select,.agent-form-grid input,.agent-form-grid select,.agent-form-grid textarea{width:100%;box-sizing:border-box;border:1px solid var(--fk-border-strong);border-radius:var(--fk-radius-control,10px);background:var(--fk-input);color:var(--fk-text);padding:12px;font:inherit}.agent-toolbar input::placeholder,.agent-form-grid input::placeholder,.agent-form-grid textarea::placeholder{color:var(--fk-text-muted)}.agent-card-list{display:grid;gap:10px;max-height:790px;overflow:auto;padding-right:2px}.agent-card{display:grid;gap:11px;text-align:left;border:1px solid var(--fk-border);border-radius:16px;background:linear-gradient(180deg,var(--fk-brand-soft),transparent 62%),var(--fk-surface-raised);color:var(--fk-text);padding:15px;cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease}.agent-card:hover{border-color:var(--fk-border-strong);transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.14)}.agent-card.selected{border-color:var(--fk-brand-hover);background:linear-gradient(180deg,var(--fk-brand-soft),transparent 58%),var(--fk-surface-hover);box-shadow:0 0 0 1px var(--fk-brand-glow),0 16px 34px rgba(0,0,0,.16)}.agent-card.status-danger{border-color:color-mix(in srgb,var(--fk-danger) 44%,var(--fk-border))}.agent-card.status-warning{border-color:color-mix(in srgb,var(--fk-warning) 34%,var(--fk-border))}.agent-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.agent-card-head span,.agent-card strong,.agent-card small,.agent-card b,.agent-card em{display:block}.agent-card strong{font-size:14px;line-height:1.25}.agent-card small{color:var(--fk-text-muted);font-size:11px;line-height:1.35}.agent-card em{border:1px solid var(--fk-border);border-radius:999px;background:var(--fk-surface);color:var(--fk-text-secondary);font-size:10px;font-style:normal;font-weight:800;line-height:1;padding:6px 8px;text-transform:uppercase}.agent-card-body{color:var(--fk-text-secondary);font-size:12px;line-height:1.48}.agent-card-pills{display:flex;flex-wrap:wrap;gap:6px}.agent-card-pills small{border:1px solid var(--fk-border);border-radius:999px;background:var(--fk-surface);padding:5px 8px}.agent-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--fk-border);padding-top:10px}.agent-card-foot b{color:var(--fk-brand-hover);font-size:11px}.agent-editor-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}.agent-editor-summary>div{border:1px solid var(--fk-border);border-radius:14px;background:var(--fk-surface-raised);padding:12px}.agent-editor-summary strong{display:block;color:var(--fk-text);font-size:18px;line-height:1.1;letter-spacing:-.02em}.agent-editor-summary span{display:block;margin-top:5px;color:var(--fk-text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.agent-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.agent-form-grid label>span,.agent-form-grid legend{display:block;color:var(--fk-text-muted);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px}.agent-form-grid .wide{grid-column:1/-1}.agent-form-grid label input+input{margin-top:8px}.agent-form-grid fieldset{border:1px solid var(--fk-border);border-radius:14px;padding:14px}.workflow-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.workflow-check-grid label{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--fk-border);border-radius:12px;background:var(--fk-surface-raised);padding:10px}.workflow-check-grid input{width:auto;flex:0 0 auto}.workflow-check-grid span,.workflow-check-grid strong,.workflow-check-grid small{display:block}.workflow-check-grid strong{color:var(--fk-text);font-size:12px}.workflow-check-grid small{color:var(--fk-text-muted);margin-top:3px}.agent-save-row{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:18px;border-top:1px solid var(--fk-border);padding-top:16px}.agent-save-row p{margin:0;color:var(--fk-text-secondary);font-size:12px}.agent-save-row button,.admin-panel-header button{border:1px solid color-mix(in srgb,var(--fk-brand) 64%,var(--fk-border-strong));border-radius:12px;background:var(--fk-brand-gradient);color:white;font-weight:850;padding:12px 17px;cursor:pointer}.agent-save-row button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:980px){.agent-management-grid{grid-template-columns:1fr}.agent-card-list{max-height:430px}}@media(max-width:650px){.agent-toolbar,.agent-form-grid,.workflow-check-grid,.agent-editor-summary{grid-template-columns:1fr}.agent-form-grid .wide{grid-column:auto}.agent-save-row{align-items:stretch;flex-direction:column}.agent-save-row button{width:100%}.agent-card-head,.agent-card-foot{align-items:flex-start;flex-direction:column}.admin-panel-header button{width:100%}}
      `}</style>
    </div>
  );
}
