"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Link2, Loader2, Save, Trash2 } from "lucide-react";

type Agent = { id: string; name: string; agent_type: string | null; status: string; system_prompt: string | null; communication_channels: string[]; suggested_prompt: string };
type Workflow = { id: string; workflow_key: string; name: string; agent_type: string; channel: string; role: string; provider: string };
type Assignment = { agent_id: string; workflow_definition_id: string };
type Route = { id: string; source_agent_id: string; target_type: "agent" | "workflow" | "channel"; target_agent_id: string | null; target_workflow_definition_id: string | null; target_channel: string | null; trigger_event: string };

type Payload = { agents: Agent[]; workflows: Workflow[]; assignments: Assignment[]; routes: Route[] };

const CHANNELS = ["whatsapp", "web", "telegram", "email", "voice", "sms"];

export default function AgentConfigurationControl({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<Payload>({ agents: [], workflows: [], assignments: [], routes: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [routeDrafts, setRouteDrafts] = useState<Record<string, { targetType: string; targetValue: string }>>({});

  async function load() {
    setMessage("");
    const response = await fetch(`/api/admin/agent-configuration?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load agent configuration.");
    setData(result);
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load agent configuration.")); }, [organizationId]);

  function updateAgent(agentId: string, patch: Partial<Agent>) {
    setData((current) => ({ ...current, agents: current.agents.map((agent) => agent.id === agentId ? { ...agent, ...patch } : agent) }));
  }

  function workflowIdsFor(agentId: string) {
    return data.assignments.filter((item) => item.agent_id === agentId).map((item) => item.workflow_definition_id);
  }

  async function saveAgent(agent: Agent, workflowIds: string[]) {
    setBusy(agent.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agent-configuration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, agentId: agent.id, systemPrompt: agent.system_prompt || "", communicationChannels: agent.communication_channels || [], workflowDefinitionIds: workflowIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save agent configuration.");
      await load();
      setMessage(`${agent.name} configuration saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save agent configuration.");
    } finally { setBusy(null); }
  }

  function toggleWorkflow(agentId: string, workflowId: string) {
    setData((current) => {
      const exists = current.assignments.some((item) => item.agent_id === agentId && item.workflow_definition_id === workflowId);
      return { ...current, assignments: exists ? current.assignments.filter((item) => !(item.agent_id === agentId && item.workflow_definition_id === workflowId)) : [...current.assignments, { agent_id: agentId, workflow_definition_id: workflowId }] };
    });
  }

  async function addRoute(sourceAgentId: string) {
    const draft = routeDrafts[sourceAgentId] || { targetType: "agent", targetValue: "" };
    if (!draft.targetValue) return setMessage("Choose a routing target first.");
    setBusy(`route-${sourceAgentId}`);
    setMessage("");
    try {
      const body: Record<string, string> = { organizationId, sourceAgentId, targetType: draft.targetType, triggerEvent: "success" };
      if (draft.targetType === "agent") body.targetAgentId = draft.targetValue;
      if (draft.targetType === "workflow") body.targetWorkflowDefinitionId = draft.targetValue;
      if (draft.targetType === "channel") body.targetChannel = draft.targetValue;
      const response = await fetch("/api/admin/agent-configuration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to create route.");
      setRouteDrafts((current) => ({ ...current, [sourceAgentId]: { targetType: "agent", targetValue: "" } }));
      await load();
      setMessage("Automation route added.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create route."); }
    finally { setBusy(null); }
  }

  async function removeRoute(routeId: string) {
    setBusy(`delete-${routeId}`);
    try {
      const response = await fetch(`/api/admin/agent-configuration?organizationId=${encodeURIComponent(organizationId)}&routeId=${encodeURIComponent(routeId)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to remove route.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to remove route."); }
    finally { setBusy(null); }
  }

  const agentName = useMemo(() => new Map(data.agents.map((agent) => [agent.id, agent.name])), [data.agents]);
  const workflowName = useMemo(() => new Map(data.workflows.map((workflow) => [workflow.id, workflow.name])), [data.workflows]);

  if (!data.agents.length) return <p className="admin-empty">Provision at least one marketplace agent before configuring prompts, channels and automation routes.</p>;

  return (
    <div className="admin-list">
      {data.agents.map((agent) => {
        const selectedWorkflowIds = workflowIdsFor(agent.id);
        const draft = routeDrafts[agent.id] || { targetType: "agent", targetValue: "" };
        const routes = data.routes.filter((route) => route.source_agent_id === agent.id);
        const targetOptions = draft.targetType === "agent"
          ? data.agents.filter((item) => item.id !== agent.id).map((item) => ({ value: item.id, label: item.name }))
          : draft.targetType === "workflow"
            ? data.workflows.map((item) => ({ value: item.id, label: item.name }))
            : CHANNELS.map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) }));
        return (
          <section key={agent.id} className="admin-list-row" style={{ display: "grid", gap: 14, alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Bot size={16} /><div><strong>{agent.name}</strong><span>{agent.agent_type || "general agent"} · {agent.status}</span></div></div>

            <label style={{ display: "grid", gap: 6 }}>
              <strong>System message</strong>
              <textarea className="admin-input" rows={10} value={agent.system_prompt || ""} onChange={(event) => updateAgent(agent.id, { system_prompt: event.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="admin-button secondary" type="button" onClick={() => updateAgent(agent.id, { system_prompt: agent.suggested_prompt })}>Build from onboarding</button>
              <span className="muted">Uses this organization's submitted business details as a starting prompt. You can edit before saving.</span>
            </div>

            <div>
              <strong>Channels</strong>
              <p className="muted">The agent role is separate from the communication channel. Select every channel this tenant agent should be allowed to use.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {CHANNELS.map((channel) => {
                  const checked = (agent.communication_channels || []).includes(channel);
                  return <label key={channel} className="admin-list-row compact" style={{ cursor: "pointer" }}><input type="checkbox" checked={checked} onChange={() => updateAgent(agent.id, { communication_channels: checked ? agent.communication_channels.filter((item) => item !== channel) : [...(agent.communication_channels || []), channel] })} /><span>{channel}</span></label>;
                })}
              </div>
            </div>

            <div>
              <strong>Linked workflows</strong>
              <p className="muted">Attach any ready shared workflow this agent needs. Workflows are reusable across tenants; tenant credentials and data remain isolated.</p>
              <div className="admin-list">
                {data.workflows.map((workflow) => {
                  const checked = selectedWorkflowIds.includes(workflow.id);
                  return <label key={workflow.id} className="admin-list-row compact" style={{ cursor: "pointer" }}><input type="checkbox" checked={checked} onChange={() => toggleWorkflow(agent.id, workflow.id)} /><div><strong>{workflow.name}</strong><span>{workflow.channel} · {workflow.provider}</span></div></label>;
                })}
              </div>
            </div>

            <button className="admin-button" type="button" disabled={busy === agent.id} onClick={() => saveAgent(agent, selectedWorkflowIds)}>{busy === agent.id ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save agent configuration</button>

            <div style={{ borderTop: "1px solid var(--admin-border, rgba(255,255,255,.12))", paddingTop: 12 }}>
              <strong>Automation routing</strong>
              <p className="muted">Send this agent's successful output to another agent, a shared workflow, or a communication channel.</p>
              <div className="admin-form-grid">
                <select className="admin-input" value={draft.targetType} onChange={(event) => setRouteDrafts((current) => ({ ...current, [agent.id]: { targetType: event.target.value, targetValue: "" } }))}>
                  <option value="agent">Another agent</option><option value="workflow">Workflow</option><option value="channel">Channel</option>
                </select>
                <select className="admin-input" value={draft.targetValue} onChange={(event) => setRouteDrafts((current) => ({ ...current, [agent.id]: { ...draft, targetValue: event.target.value } }))}>
                  <option value="">Choose target</option>{targetOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <button className="admin-button secondary" type="button" disabled={busy === `route-${agent.id}`} onClick={() => addRoute(agent.id)}><Link2 size={14} /> Add route</button>
              </div>
              <div className="admin-list" style={{ marginTop: 10 }}>
                {routes.map((route) => {
                  const target = route.target_type === "agent" ? agentName.get(route.target_agent_id || "") : route.target_type === "workflow" ? workflowName.get(route.target_workflow_definition_id || "") : route.target_channel;
                  return <div key={route.id} className="admin-list-row compact"><Link2 size={14} /><div><strong>{agent.name} → {target || route.target_type}</strong><span>On {route.trigger_event}</span></div><button className="admin-button secondary" type="button" onClick={() => removeRoute(route.id)} disabled={busy === `delete-${route.id}`}><Trash2 size={13} /></button></div>;
                })}
                {!routes.length ? <p className="admin-empty">No downstream route configured for this agent yet.</p> : null}
              </div>
            </div>
          </section>
        );
      })}
      {message ? <p className="admin-form-message">{message}</p> : null}
    </div>
  );
}
