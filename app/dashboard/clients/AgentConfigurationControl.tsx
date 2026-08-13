"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Link2, Loader2, Save, Trash2 } from "@/components/admin/ServerIcons";

type Agent = {
  id: string;
  name: string;
  agent_type: string | null;
  status: string;
  system_prompt: string | null;
  communication_channels: string[];
  suggested_prompt: string;
};

type Workflow = {
  id: string;
  workflow_key: string;
  name: string;
  agent_type: string;
  channel: string;
  role: string;
  provider: string;
};

type Assignment = { agent_id: string; workflow_definition_id: string };
type Route = {
  id: string;
  source_agent_id: string;
  target_type: "agent" | "workflow" | "channel";
  target_agent_id: string | null;
  target_workflow_definition_id: string | null;
  target_channel: string | null;
  trigger_event: string;
};

type Payload = { agents: Agent[]; workflows: Workflow[]; assignments: Assignment[]; routes: Route[] };
type ChannelOption = { key: string; label: string; reason: string; recommended?: boolean };
type AgentGuide = {
  purpose: string;
  channels: ChannelOption[];
  workflowKeys: string[];
  workflowReason: string;
  routingReason: string;
};

const DEFAULT_GUIDE: AgentGuide = {
  purpose: "Configure this tenant agent only for the job it was assigned to perform.",
  channels: [],
  workflowKeys: [],
  workflowReason: "No default shared workflow is required for this agent yet.",
  routingReason: "Route output only when another assigned tenant agent or relevant shared workflow should continue the job.",
};

const AGENT_GUIDES: Record<string, AgentGuide> = {
  whatsapp_agent: {
    purpose: "Handles this organization's customer conversations on WhatsApp. Use it for enquiries, qualification, handoff and WhatsApp follow-up.",
    channels: [
      { key: "whatsapp", label: "WhatsApp", reason: "Required because this agent communicates through the tenant's WhatsApp number.", recommended: true },
    ],
    workflowKeys: ["shared.whatsapp.inbound", "shared.crm.lead_capture", "shared.crm.followup"],
    workflowReason: "Only WhatsApp routing and CRM workflows are shown because they directly support a WhatsApp conversation agent.",
    routingReason: "Use routing when a WhatsApp conversation should be handed to another agent already assigned to this tenant, such as Support or Outbound Call.",
  },
  support_agent: {
    purpose: "Answers customer questions, uses approved business knowledge and escalates issues. The same support role can operate on more than one customer channel.",
    channels: [
      { key: "whatsapp", label: "WhatsApp", reason: "Use when customers should receive support through the tenant's WhatsApp number.", recommended: true },
      { key: "web", label: "Web chat", reason: "Use when the Support Agent will answer customers from the tenant's website chat widget." },
      { key: "telegram", label: "Telegram", reason: "Use only when the tenant has a Telegram bot/channel that should provide customer support." },
    ],
    workflowKeys: ["shared.whatsapp.inbound", "shared.crm.followup"],
    workflowReason: "Support only sees shared workflows that can help receive conversations or continue a customer follow-up. Unrelated sales, email and voice workflows are hidden.",
    routingReason: "Route support output only when another assigned agent should continue the case, for example a WhatsApp agent for messaging or an Outbound Call Agent for a phone escalation.",
  },
  email_automation: {
    purpose: "Runs tenant email communication, nurture sequences, follow-ups and operational email messages.",
    channels: [
      { key: "email", label: "Email", reason: "Required because this automation sends through the tenant's configured email provider.", recommended: true },
    ],
    workflowKeys: ["shared.email.followup", "shared.crm.followup", "shared.crm.lead_capture"],
    workflowReason: "Only email and CRM follow-up workflows are shown for this automation.",
    routingReason: "Route into Email Automation when another assigned agent or lead-generation flow should trigger an email sequence.",
  },
  outbound_call_agent: {
    purpose: "Calls leads or customers, qualifies interest, records call outcomes and hands qualified conversations to staff or another agent.",
    channels: [
      { key: "voice", label: "Voice", reason: "Required because this agent operates through the tenant's configured voice/calling provider.", recommended: true },
    ],
    workflowKeys: ["shared.voice.outbound", "shared.crm.lead_capture", "shared.crm.followup"],
    workflowReason: "Only outbound voice and CRM workflows are shown because they support calling, qualification and follow-up.",
    routingReason: "Use routing when a qualified call should continue to another agent assigned to this tenant or when another agent should trigger an outbound call.",
  },
  lead_generation: {
    purpose: "Finds, enriches and organizes prospects. It is a backend acquisition system, so it normally sends qualified leads to another assigned agent instead of talking to customers directly.",
    channels: [],
    workflowKeys: ["shared.crm.lead_capture", "shared.crm.followup"],
    workflowReason: "Lead Generation only sees CRM workflows because its primary job is to create and organize qualified lead records.",
    routingReason: "This is where you connect generated leads to another assigned tenant agent, such as Email Automation, WhatsApp Agent, Support Agent or Outbound Call Agent.",
  },
  onboarding_agent: {
    purpose: "Guides new customers through the tenant's onboarding steps, document requests, reminders and escalation rules.",
    channels: [
      { key: "whatsapp", label: "WhatsApp", reason: "Use when onboarding should happen through WhatsApp.", recommended: true },
      { key: "email", label: "Email", reason: "Use when onboarding instructions or documents should also be sent by email." },
      { key: "web", label: "Web chat", reason: "Use when customers should complete guided onboarding from the website." },
      { key: "telegram", label: "Telegram", reason: "Use only when onboarding is offered through a tenant Telegram bot." },
    ],
    workflowKeys: ["shared.whatsapp.inbound", "shared.email.followup", "shared.crm.followup"],
    workflowReason: "Only messaging and follow-up workflows useful for onboarding are shown.",
    routingReason: "Use routing when onboarding completion should hand a customer to another assigned agent or workflow.",
  },
};

function guideFor(agent: Agent) {
  return AGENT_GUIDES[agent.agent_type || ""] || DEFAULT_GUIDE;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AgentConfigurationControl({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<Payload>({ agents: [], workflows: [], assignments: [], routes: [] });
  const [activeAgentId, setActiveAgentId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [routeDrafts, setRouteDrafts] = useState<Record<string, { targetType: string; targetValue: string }>>({});

  async function load() {
    setMessage("");
    const response = await fetch(`/api/admin/agent-configuration?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load agent configuration.");
    setData(result);
    setActiveAgentId((current) => current && result.agents?.some((agent: Agent) => agent.id === current) ? current : result.agents?.[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load agent configuration."));
  }, [organizationId]);

  function updateAgent(agentId: string, patch: Partial<Agent>) {
    setData((current) => ({ ...current, agents: current.agents.map((agent) => agent.id === agentId ? { ...agent, ...patch } : agent) }));
  }

  function workflowIdsFor(agentId: string) {
    return data.assignments.filter((item) => item.agent_id === agentId).map((item) => item.workflow_definition_id);
  }

  function relevantWorkflows(agent: Agent) {
    const guide = guideFor(agent);
    const selectedIds = new Set(workflowIdsFor(agent.id));
    return data.workflows.filter((workflow) => guide.workflowKeys.includes(workflow.workflow_key) || selectedIds.has(workflow.id));
  }

  async function saveAgent(agent: Agent, workflowIds: string[]) {
    setBusy(agent.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agent-configuration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          agentId: agent.id,
          systemPrompt: agent.system_prompt || "",
          communicationChannels: agent.communication_channels || [],
          workflowDefinitionIds: workflowIds,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save agent configuration.");
      await load();
      setMessage(`${agent.name} configuration saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save agent configuration.");
    } finally {
      setBusy(null);
    }
  }

  function toggleWorkflow(agentId: string, workflowId: string) {
    setData((current) => {
      const exists = current.assignments.some((item) => item.agent_id === agentId && item.workflow_definition_id === workflowId);
      return {
        ...current,
        assignments: exists
          ? current.assignments.filter((item) => !(item.agent_id === agentId && item.workflow_definition_id === workflowId))
          : [...current.assignments, { agent_id: agentId, workflow_definition_id: workflowId }],
      };
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
      const response = await fetch("/api/admin/agent-configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to create route.");
      setRouteDrafts((current) => ({ ...current, [sourceAgentId]: { targetType: "agent", targetValue: "" } }));
      await load();
      setMessage("Automation route added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create route.");
    } finally {
      setBusy(null);
    }
  }

  async function removeRoute(routeId: string) {
    setBusy(`delete-${routeId}`);
    try {
      const response = await fetch(`/api/admin/agent-configuration?organizationId=${encodeURIComponent(organizationId)}&routeId=${encodeURIComponent(routeId)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to remove route.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove route.");
    } finally {
      setBusy(null);
    }
  }

  const agentName = useMemo(() => new Map(data.agents.map((agent) => [agent.id, agent.name])), [data.agents]);
  const workflowName = useMemo(() => new Map(data.workflows.map((workflow) => [workflow.id, workflow.name])), [data.workflows]);
  const activeAgent = data.agents.find((agent) => agent.id === activeAgentId) || data.agents[0];

  if (!data.agents.length) {
    return <p className="admin-empty">Provision at least one marketplace agent before configuring prompts, channels and automation routes.</p>;
  }

  const agent = activeAgent;
  const guide = guideFor(agent);
  const selectedWorkflowIds = workflowIdsFor(agent.id);
  const workflows = relevantWorkflows(agent);
  const draft = routeDrafts[agent.id] || { targetType: "agent", targetValue: "" };
  const routes = data.routes.filter((route) => route.source_agent_id === agent.id);
  const assignedAgentTargets = data.agents.filter((item) => item.id !== agent.id);
  const workflowTargets = workflows;
  const channelTargets = guide.channels.filter((item) => (agent.communication_channels || []).includes(item.key));
  const availableRouteTypes = [
    ...(assignedAgentTargets.length ? [{ value: "agent", label: "Another assigned agent" }] : []),
    ...(workflowTargets.length ? [{ value: "workflow", label: "Relevant shared workflow" }] : []),
    ...(channelTargets.length ? [{ value: "channel", label: "One of this agent's channels" }] : []),
  ];
  const safeDraftType = availableRouteTypes.some((item) => item.value === draft.targetType) ? draft.targetType : availableRouteTypes[0]?.value || "agent";
  const targetOptions = safeDraftType === "agent"
    ? assignedAgentTargets.map((item) => ({ value: item.id, label: `${item.name} — ${titleCase(item.agent_type || "agent")}` }))
    : safeDraftType === "workflow"
      ? workflowTargets.map((item) => ({ value: item.id, label: item.name }))
      : channelTargets.map((item) => ({ value: item.key, label: item.label }));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="admin-list-row" style={{ display: "grid", gap: 10 }}>
        <div>
          <strong>Choose an assigned agent to configure</strong>
          <span>Only agents already allocated to this tenant appear here. Configure one agent at a time.</span>
        </div>
        <select className="admin-input" value={agent.id} onChange={(event) => setActiveAgentId(event.target.value)}>
          {data.agents.map((item) => (
            <option key={item.id} value={item.id}>{item.name} — {titleCase(item.agent_type || "agent")}</option>
          ))}
        </select>
      </div>

      <section className="admin-list-row" style={{ display: "grid", gap: 16, alignItems: "stretch" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Bot size={18} />
          <div>
            <strong>{agent.name}</strong>
            <span>{guide.purpose}</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <strong>1. System message</strong>
          <p className="muted">This controls how only <b>{agent.name}</b> behaves. Build from the client's onboarding details, review it, then edit anything specific to this agent's job.</p>
          <textarea className="admin-input" rows={10} value={agent.system_prompt || ""} onChange={(event) => updateAgent(agent.id, { system_prompt: event.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="admin-button secondary" type="button" onClick={() => updateAgent(agent.id, { system_prompt: agent.suggested_prompt })}>Build from onboarding</button>
            <span className="muted">Use this once as a starting point. It does not overwrite the prompt again unless you press it.</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <strong>2. Communication channels</strong>
          {guide.channels.length ? (
            <>
              <p className="muted">Only channels suitable for <b>{agent.name}</b> are shown. Select a channel only when this agent should actually communicate there.</p>
              <div className="admin-list">
                {guide.channels.map((channel) => {
                  const checked = (agent.communication_channels || []).includes(channel.key);
                  return (
                    <label key={channel.key} className="admin-list-row compact" style={{ cursor: "pointer", alignItems: "flex-start" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateAgent(agent.id, {
                          communication_channels: checked
                            ? agent.communication_channels.filter((item) => item !== channel.key)
                            : [...(agent.communication_channels || []), channel.key],
                        })}
                      />
                      <div>
                        <strong>{channel.label} {channel.recommended ? "· Recommended" : "· Optional"}</strong>
                        <span>{channel.reason}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="admin-list-row compact">
              <CheckCircle2 size={15} />
              <div><strong>No direct customer channel required</strong><span>{guide.purpose} Use automation routing below to send its output to another assigned tenant agent.</span></div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <strong>3. Relevant shared workflows</strong>
          <p className="muted">{guide.workflowReason}</p>
          {workflows.length ? (
            <div className="admin-list">
              {workflows.map((workflow) => {
                const checked = selectedWorkflowIds.includes(workflow.id);
                return (
                  <label key={workflow.id} className="admin-list-row compact" style={{ cursor: "pointer", alignItems: "flex-start" }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleWorkflow(agent.id, workflow.id)} />
                    <div>
                      <strong>{workflow.name}</strong>
                      <span>{titleCase(workflow.channel)} · {workflow.provider} · Used because it supports this agent's role or selected channel.</span>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="admin-empty">No ready shared workflow currently matches this agent. You can still save its prompt and channels; a workflow can be added later.</p>
          )}
        </div>

        <button className="admin-button" type="button" disabled={busy === agent.id} onClick={() => saveAgent(agent, selectedWorkflowIds)}>
          {busy === agent.id ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save {agent.name}
        </button>

        <div style={{ borderTop: "1px solid var(--admin-border, rgba(255,255,255,.12))", paddingTop: 14, display: "grid", gap: 8 }}>
          <strong>4. Automation routing</strong>
          <p className="muted">{guide.routingReason}</p>
          <p className="muted"><b>Use this only when something should happen after this agent finishes its task.</b> If no handoff is needed, leave this section empty.</p>

          {availableRouteTypes.length ? (
            <div className="admin-form-grid">
              <label style={{ display: "grid", gap: 5 }}>
                <span className="muted">What should receive the result?</span>
                <select
                  className="admin-input"
                  value={safeDraftType}
                  onChange={(event) => setRouteDrafts((current) => ({ ...current, [agent.id]: { targetType: event.target.value, targetValue: "" } }))}
                >
                  {availableRouteTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span className="muted">Choose the specific destination</span>
                <select
                  className="admin-input"
                  value={safeDraftType === draft.targetType ? draft.targetValue : ""}
                  onChange={(event) => setRouteDrafts((current) => ({ ...current, [agent.id]: { targetType: safeDraftType, targetValue: event.target.value } }))}
                >
                  <option value="">Choose destination</option>
                  {targetOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <button className="admin-button secondary" type="button" disabled={busy === `route-${agent.id}`} onClick={() => addRoute(agent.id)}>
                <Link2 size={14} /> Add handoff route
              </button>
            </div>
          ) : (
            <p className="admin-empty">There is no relevant downstream target yet. Assign another tenant agent or connect a suitable workflow/channel first.</p>
          )}

          <div className="admin-list" style={{ marginTop: 6 }}>
            {routes.map((route) => {
              const target = route.target_type === "agent"
                ? agentName.get(route.target_agent_id || "")
                : route.target_type === "workflow"
                  ? workflowName.get(route.target_workflow_definition_id || "")
                  : route.target_channel;
              return (
                <div key={route.id} className="admin-list-row compact">
                  <Link2 size={14} />
                  <div><strong>{agent.name} → {target || route.target_type}</strong><span>Runs after this agent completes successfully.</span></div>
                  <button className="admin-button secondary" type="button" onClick={() => removeRoute(route.id)} disabled={busy === `delete-${route.id}`}><Trash2 size={13} /></button>
                </div>
              );
            })}
            {!routes.length ? <p className="admin-empty">No handoff route configured. That is fine if this agent can complete its job by itself.</p> : null}
          </div>
        </div>
      </section>

      {message ? <p className="admin-form-message">{message}</p> : null}
    </div>
  );
}
