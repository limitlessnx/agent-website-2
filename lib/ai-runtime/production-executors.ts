import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { RuntimeToolRegistry, RuntimeToolExecutor } from "@/lib/ai-runtime/tool-registry";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : undefined;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function requireOrganization(context: { organizationId?: string }) {
  const organizationId = text(context.organizationId);
  if (!organizationId) throw new Error("Production tool execution requires an organization ID.");
  return organizationId;
}

function requestedOrganization(args: Record<string, unknown>, context: { organizationId?: string; identity: { scope: string } }) {
  const explicit = text(args.organization_id || args.organizationId);
  if (context.identity.scope === "super_admin") {
    const organizationId = explicit || text(context.organizationId);
    if (!organizationId) throw new Error("Super Admin tenant execution requires an explicit organization ID.");
    return organizationId;
  }
  const organizationId = requireOrganization(context);
  if (explicit && explicit !== organizationId) throw new Error("Cross-organization production execution is forbidden.");
  return organizationId;
}

function register(registry: RuntimeToolRegistry, key: string, executor: RuntimeToolExecutor) {
  registry.registerExecutor(key, executor);
}

export function registerProductionRuntimeExecutors(registry: RuntimeToolRegistry) {
  register(registry, "leo.tenant.inspect", async (_args, context) => {
    const organizationId = requireOrganization(context);
    const [agents, workflows, integrations, subscriptions] = await Promise.all([
      supabaseServerRequest<Record<string, unknown>[]>(`agents?select=id,name,slug,status,agent_type,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=50`),
      supabaseServerRequest<Record<string, unknown>[]>(`workflow_registry?select=id,workflow_key,name,status,provider,environment,last_run_at,last_success_at,last_error_at&organization_uuid=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=50`).catch(() => []),
      supabaseServerRequest<Record<string, unknown>[]>(`organization_integrations?select=id,provider,display_name,status,health,last_checked_at,last_connected_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=50`).catch(() => []),
      supabaseServerRequest<Record<string, unknown>[]>(`organization_subscriptions?select=id,plan_id,provider,status,current_period_start,current_period_end,grace_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`).catch(() => []),
    ]);
    return { organization_id: organizationId, agents, workflows, integrations, subscription: subscriptions[0] || null };
  });

  register(registry, "leo.agent.inspect", async (args, context) => {
    const organizationId = requireOrganization(context);
    const agentId = text(args.agent_id || args.agentId || context.agentId);
    if (!agentId) throw new Error("agent_id is required.");
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`agents?select=id,name,slug,description,status,current_version,configuration,agent_type,ai_model,temperature,language,voice_provider,communication_channels,escalation_rules,human_handoff_destination,knowledge_sources,updated_at&id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
    if (!rows[0]) throw new Error("Agent was not found in this organization.");
    return rows[0];
  });

  register(registry, "leo.workflow.inspect", async (args, context) => {
    const organizationId = requireOrganization(context);
    const key = text(args.workflow_key || args.workflowKey);
    const id = text(args.workflow_id || args.workflowId);
    const filter = id ? `id=eq.${encodeURIComponent(id)}` : key ? `workflow_key=eq.${encodeURIComponent(key)}` : "";
    return supabaseServerRequest<Record<string, unknown>[]>(`workflow_registry?select=id,workflow_key,name,description,provider,external_workflow_id,status,current_version,timeout_seconds,max_retries,last_run_at,last_success_at,last_error_at,environment,agent_id,updated_at&organization_uuid=eq.${encodeURIComponent(organizationId)}${filter ? `&${filter}` : ""}&order=updated_at.desc&limit=50`);
  });

  register(registry, "leo.workflow.inspect_failures", async (args, context) => {
    const organizationId = requireOrganization(context);
    const limit = Math.max(1, Math.min(50, number(args.limit) || 20));
    return supabaseServerRequest<Record<string, unknown>[]>(`runtime_executions?select=id,agent_id,conversation_id,status,error_code,error_message,latency_ms,started_at,completed_at,created_at&organization_id=eq.${encodeURIComponent(organizationId)}&status=in.(failed,dead_lettered)&order=created_at.desc&limit=${limit}`);
  });

  register(registry, "leo.integration.inspect", async (_args, context) => {
    const organizationId = requireOrganization(context);
    return supabaseServerRequest<Record<string, unknown>[]>(`organization_integrations?select=id,provider,display_name,status,health,last_checked_at,last_connected_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=100`);
  });

  register(registry, "leo.billing.inspect", async (_args, context) => {
    const organizationId = requireOrganization(context);
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`organization_subscriptions?select=id,plan_id,provider,status,current_period_start,current_period_end,grace_period_end,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`);
    return rows[0] || null;
  });

  register(registry, "leo.crm.leads.read", async (args, context) => {
    const organizationId = requireOrganization(context);
    const leadId = text(args.lead_id || args.leadId);
    const limit = Math.max(1, Math.min(100, number(args.limit) || 30));
    const filter = leadId ? `&id=eq.${encodeURIComponent(leadId)}` : "";
    return supabaseServerRequest<Record<string, unknown>[]>(`crm_leads?select=id,customer_id,assigned_agent_id,source,stage,score,value_estimate,currency,summary,details,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}${filter}&order=updated_at.desc&limit=${limit}`);
  });

  register(registry, "leo.crm.leads.update", async (args, context) => {
    const organizationId = requireOrganization(context);
    const leadId = text(args.lead_id || args.leadId);
    if (!leadId) throw new Error("lead_id is required.");
    const body: Record<string, unknown> = {};
    if (text(args.stage)) body.stage = text(args.stage);
    if (number(args.score) !== undefined) body.score = Math.max(0, Math.min(100, number(args.score)!));
    if (text(args.summary)) body.summary = text(args.summary).slice(0, 4000);
    if (args.value_estimate !== undefined || args.valueEstimate !== undefined) body.value_estimate = number(args.value_estimate ?? args.valueEstimate) ?? null;
    if (!Object.keys(body).length) throw new Error("No permitted lead fields were supplied.");
    body.updated_at = new Date().toISOString();
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`crm_leads?id=eq.${encodeURIComponent(leadId)}&organization_id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!rows[0]) throw new Error("Lead was not found in this organization.");
    return rows[0];
  });

  register(registry, "leo.crm.followup.prepare", async (args, context) => {
    const organizationId = requireOrganization(context);
    const leadId = text(args.lead_id || args.leadId);
    const description = text(args.message || args.content || args.description);
    if (!leadId || !description) throw new Error("lead_id and follow-up content are required.");
    const rows = await supabaseServerRequest<Record<string, unknown>[]>("crm_tasks", { method: "POST", body: JSON.stringify({ organization_id: organizationId, lead_id: leadId, assigned_agent_id: context.agentId || null, task_type: "ai_follow_up_draft", title: "AI follow-up draft", description: description.slice(0, 8000), status: "draft", metadata: { execution_id: context.executionId, source: "phase13_runtime" } }) });
    return rows[0] || null;
  });

  register(registry, "leo.agent.pause", async (args, context) => {
    const organizationId = requireOrganization(context);
    const agentId = text(args.agent_id || args.agentId || context.agentId);
    if (!agentId) throw new Error("agent_id is required.");
    const current = await supabaseServerRequest<Record<string, unknown>[]>(`agents?select=id,status,configuration&id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
    if (!current[0]) throw new Error("Agent was not found in this organization.");
    const configuration = { ...record(current[0].configuration), phase13_previous_status: current[0].status };
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`agents?id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "paused", configuration, updated_at: new Date().toISOString() }) });
    return { id: rows[0]?.id || agentId, status: rows[0]?.status || "paused" };
  });

  register(registry, "leo.agent.resume", async (args, context) => {
    const organizationId = requireOrganization(context);
    const agentId = text(args.agent_id || args.agentId || context.agentId);
    if (!agentId) throw new Error("agent_id is required.");
    const current = await supabaseServerRequest<Record<string, unknown>[]>(`agents?select=id,status,configuration&id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
    if (!current[0]) throw new Error("Agent was not found in this organization.");
    const configuration = record(current[0].configuration);
    const savedStatus = text(configuration.phase13_previous_status);
    const restoreStatus = ["draft", "testing", "published", "deprecated"].includes(savedStatus) ? savedStatus : "published";
    const { phase13_previous_status: _previous, ...cleanConfiguration } = configuration;
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`agents?id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: restoreStatus, configuration: cleanConfiguration, updated_at: new Date().toISOString() }) });
    return { id: rows[0]?.id || agentId, status: rows[0]?.status || restoreStatus };
  });

  register(registry, "leo.support.request_admin_repair", async (args, context) => {
    const organizationId = requireOrganization(context);
    const description = text(args.description || args.issue || args.message);
    if (!description) throw new Error("Repair request description is required.");
    const conversations = await supabaseServerRequest<Record<string, unknown>[]>("support_conversations", { method: "POST", body: JSON.stringify({ organization_id: organizationId, title: text(args.title) || "Runtime repair request", status: "open", priority: text(args.priority) || "high", created_by: context.identity.email || "runtime", assigned_agent: "agent-leo", summary: description.slice(0, 4000), metadata: { execution_id: context.executionId, source: "phase13_runtime", requires_admin: true } }) });
    return conversations[0] || null;
  });

  register(registry, "leo.platform.organizations.read", async (args, context) => {
    if (context.identity.scope !== "super_admin") throw new Error("Platform organization inspection is restricted to Super Admin.");
    const organizationId = text(args.organization_id || args.organizationId);
    const filter = organizationId ? `&id=eq.${encodeURIComponent(organizationId)}` : "";
    return supabaseServerRequest<Record<string, unknown>[]>(`organizations?select=id,name,slug,status,created_at,updated_at${filter}&order=updated_at.desc&limit=100`);
  });

  register(registry, "leo.platform.tenant.pause", async (args, context) => {
    if (context.identity.scope !== "super_admin") throw new Error("Platform tenant control is restricted to Super Admin.");
    const organizationId = requestedOrganization(args, context);
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`organizations?id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "suspended", updated_at: new Date().toISOString() }) });
    if (!rows[0]) throw new Error("Organization was not found.");
    return { id: rows[0].id, status: rows[0].status };
  });

  register(registry, "leo.platform.tenant.resume", async (args, context) => {
    if (context.identity.scope !== "super_admin") throw new Error("Platform tenant control is restricted to Super Admin.");
    const organizationId = requestedOrganization(args, context);
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`organizations?id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "active", updated_at: new Date().toISOString() }) });
    if (!rows[0]) throw new Error("Organization was not found.");
    return { id: rows[0].id, status: rows[0].status };
  });

  const workflowStatusExecutor = (status: "active" | "disabled"): RuntimeToolExecutor => async (args, context) => {
    if (context.identity.scope !== "super_admin") throw new Error("Platform workflow control is restricted to Super Admin.");
    const workflowId = text(args.workflow_id || args.workflowId);
    const workflowKey = text(args.workflow_key || args.workflowKey);
    if (!workflowId && !workflowKey) throw new Error("workflow_id or workflow_key is required.");
    const filter = workflowId ? `id=eq.${encodeURIComponent(workflowId)}` : `workflow_key=eq.${encodeURIComponent(workflowKey)}`;
    const rows = await supabaseServerRequest<Record<string, unknown>[]>(`workflow_registry?${filter}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
    if (!rows[0]) throw new Error("Workflow was not found.");
    return { id: rows[0].id, workflow_key: rows[0].workflow_key, status: rows[0].status };
  };
  register(registry, "leo.platform.workflow.activate", workflowStatusExecutor("active"));
  register(registry, "leo.platform.workflow.deactivate", workflowStatusExecutor("disabled"));

  return registry;
}
