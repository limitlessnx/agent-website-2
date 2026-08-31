import { loadLeoRuntimeConfiguration } from "@/lib/leo-runtime-config";
import { LeoN8nExecutor } from "@/lib/leo-n8n";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { RuntimeToolRegistry, RuntimeToolExecutorContext } from "@/lib/ai-runtime/tool-registry";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numeric = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function requireOrganization(context: RuntimeToolExecutorContext) {
  const organizationId = text(context.organizationId) || text(context.identity.organizationId);
  if (!organizationId) throw new Error("Production tool execution requires an exact organization ID.");
  if (context.identity.scope === "tenant" || context.identity.scope === "internal_service") {
    if (context.identity.organizationId !== organizationId) throw new Error("Cross-organization production execution is forbidden.");
  }
  return organizationId;
}

function requireId(input: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = text(input[key]);
    if (value) return value;
  }
  throw new Error(`${keys.join(" or ")} is required.`);
}

function safeLeadPatch(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (input.stage !== undefined) patch.stage = text(input.stage).slice(0, 80);
  if (input.score !== undefined) patch.score = Math.max(0, Math.min(100, numeric(input.score)));
  if (input.summary !== undefined) patch.summary = text(input.summary).slice(0, 4000);
  if (input.value_estimate !== undefined) patch.value_estimate = Math.max(0, numeric(input.value_estimate));
  if (input.currency !== undefined) patch.currency = text(input.currency).slice(0, 8).toUpperCase();
  if (Object.keys(patch).length === 0) throw new Error("No permitted lead fields were supplied.");
  patch.updated_at = new Date().toISOString();
  return patch;
}

async function mappedWorkflow(input: Record<string, unknown>, context: RuntimeToolExecutorContext, workflowKey: string, consequential: boolean) {
  const organizationId = requireOrganization(context);
  if (consequential && !context.authorization.approved) throw new Error("Approved runtime authorization is required for consequential workflow execution.");

  const rows = await supabaseServerRequest<Array<{ workflow_key: string; endpoint_url?: string | null; status: string; timeout_seconds?: number | null }>>(
    `workflow_registry?select=workflow_key,endpoint_url,status,timeout_seconds&workflow_key=eq.${encodeURIComponent(workflowKey)}&organization_uuid=eq.${encodeURIComponent(organizationId)}&status=eq.active&limit=1`,
  ).catch(() => []);
  const workflow = rows[0];
  if (!workflow?.endpoint_url) throw new Error(`No active mapped production workflow exists for ${workflowKey}.`);

  const base = loadLeoRuntimeConfiguration();
  const config = {
    ...base,
    n8n: {
      ...base.n8n,
      enabled: true,
      workflows: {
        [workflowKey]: {
          key: workflowKey,
          webhookUrl: workflow.endpoint_url,
          consequential,
          timeoutMs: Math.max(1_000, Math.min(60_000, numeric(workflow.timeout_seconds, 15) * 1_000)),
        },
      },
    },
  };

  const executor = new LeoN8nExecutor(config, {
    record: async (result) => {
      await supabaseServerRequest("runtime_progress_events", {
        method: "POST",
        body: JSON.stringify({
          organization_id: organizationId,
          execution_id: context.executionId,
          event_type: `tool.workflow.${result.status}`,
          message: `Production workflow ${workflowKey} finished with ${result.status}.`,
          payload: { workflow_key: workflowKey, attempts: result.attempts.length, tool_key: context.toolKey },
        }),
      }).catch(() => null);
    },
  });

  const result = await executor.execute(workflowKey, {
    executionId: context.executionId,
    organizationId,
    agentRole: context.identity.role,
    action: context.toolKey,
    risk: consequential ? "consequential" : "read_only",
    input,
    approval: consequential ? {
      approved: true,
      approvedBy: context.authorization.approvedBy || "runtime-approval-ledger",
      approvedAt: context.authorization.approvedAt || new Date().toISOString(),
    } : undefined,
    idempotencyKey: consequential ? text(input.idempotency_key) || `${context.executionId}:${context.toolKey}` : undefined,
  });
  if (result.status !== "succeeded") throw new Error(result.error || `Production workflow ${workflowKey} did not succeed.`);
  return result.response ?? { ok: true, workflow_key: workflowKey };
}

export function registerProductionRuntimeTools(registry: RuntimeToolRegistry) {
  const register = (key: string, executor: (input: Record<string, unknown>, context: RuntimeToolExecutorContext) => Promise<unknown>) => {
    registry.registerExecutor(key, executor);
  };

  register("leo.tenant.inspect", async (_input, context) => {
    const organizationId = requireOrganization(context);
    const [agents, integrations, workflows, executions] = await Promise.all([
      supabaseServerRequest(`agents?select=id,name,status,agent_type,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=50`).catch(() => []),
      supabaseServerRequest(`organization_integrations?select=id,provider,display_name,status,health,last_checked_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=50`).catch(() => []),
      supabaseServerRequest(`workflow_registry?select=id,workflow_key,name,status,last_run_at,last_success_at,last_error_at&organization_uuid=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=50`).catch(() => []),
      supabaseServerRequest(`runtime_executions?select=id,agent_id,status,error_code,error_message,latency_ms,created_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=created_at.desc&limit=25`).catch(() => []),
    ]);
    return { organization_id: organizationId, agents, integrations, workflows, recent_executions: executions };
  });

  register("leo.agent.inspect", async (input, context) => {
    const organizationId = requireOrganization(context);
    const agentId = requireId(input, "agent_id", "id") || context.agentId;
    const rows = await supabaseServerRequest(`agents?select=id,name,slug,description,status,current_version,agent_type,ai_model,language,communication_channels,escalation_rules,updated_at&id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Agent was not found in this organization.");
    return rows[0];
  });

  register("leo.workflow.inspect", async (input, context) => {
    const organizationId = requireOrganization(context);
    const key = text(input.workflow_key);
    const id = text(input.workflow_id) || text(input.id);
    const filter = key ? `workflow_key=eq.${encodeURIComponent(key)}` : id ? `id=eq.${encodeURIComponent(id)}` : "";
    if (!filter) throw new Error("workflow_key or workflow_id is required.");
    const rows = await supabaseServerRequest(`workflow_registry?select=id,workflow_key,name,description,provider,status,current_version,timeout_seconds,max_retries,last_run_at,last_success_at,last_error_at,updated_at&organization_uuid=eq.${encodeURIComponent(organizationId)}&${filter}&limit=1`);
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Workflow was not found in this organization.");
    return rows[0];
  });

  register("leo.workflow.inspect_failures", async (input, context) => {
    const organizationId = requireOrganization(context);
    const limit = Math.max(1, Math.min(50, numeric(input.limit, 20)));
    return supabaseServerRequest(`workflow_runs?select=id,workflow_id,workflow_key,status,attempt,error_message,duration_ms,started_at,completed_at,created_at&organization_uuid=eq.${encodeURIComponent(organizationId)}&status=in.(failed,error,dead_lettered)&order=created_at.desc&limit=${limit}`);
  });

  register("leo.integration.inspect", async (_input, context) => {
    const organizationId = requireOrganization(context);
    return supabaseServerRequest(`organization_integrations?select=id,provider,display_name,status,health,last_checked_at,last_connected_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc`);
  });

  register("leo.billing.inspect", async (_input, context) => {
    const organizationId = requireOrganization(context);
    return supabaseServerRequest(`organization_subscriptions?select=id,plan_id,provider,status,current_period_start,current_period_end,grace_period_end,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`);
  });

  register("leo.crm.leads.read", async (input, context) => {
    const organizationId = requireOrganization(context);
    const id = text(input.lead_id) || text(input.id);
    const stage = text(input.stage);
    const limit = Math.max(1, Math.min(100, numeric(input.limit, 25)));
    const extra = id ? `&id=eq.${encodeURIComponent(id)}` : stage ? `&stage=eq.${encodeURIComponent(stage)}` : "";
    return supabaseServerRequest(`crm_leads?select=id,customer_id,assigned_agent_id,source,stage,score,value_estimate,currency,summary,details,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}${extra}&order=updated_at.desc&limit=${limit}`);
  });

  register("leo.crm.leads.update", async (input, context) => {
    const organizationId = requireOrganization(context);
    const leadId = requireId(input, "lead_id", "id");
    const rows = await supabaseServerRequest(`crm_leads?id=eq.${encodeURIComponent(leadId)}&organization_id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify(safeLeadPatch(input)) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Lead update did not affect a tenant-scoped record.");
    return rows[0];
  });

  register("leo.crm.followup.prepare", async (input, context) => {
    const organizationId = requireOrganization(context);
    const leadId = requireId(input, "lead_id");
    const rows = await supabaseServerRequest(`crm_tasks`, { method: "POST", body: JSON.stringify({ organization_id: organizationId, lead_id: leadId, assigned_agent_id: context.agentId || null, task_type: "runtime_follow_up", title: text(input.title) || "AI prepared follow-up", description: text(input.message) || text(input.content) || null, status: "prepared", due_at: text(input.due_at) || null, metadata: { execution_id: context.executionId, source: "phase13_runtime" } }) });
    return Array.isArray(rows) ? rows[0] : rows;
  });

  register("leo.crm.followup.send", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "crm_followup_send", true));
  register("leo.campaign.prepare", async (input, context) => {
    const organizationId = requireOrganization(context);
    const rows = await supabaseServerRequest(`crm_tasks`, { method: "POST", body: JSON.stringify({ organization_id: organizationId, assigned_agent_id: context.agentId || null, task_type: "campaign_draft", title: text(input.title) || "AI prepared campaign", description: text(input.message) || text(input.content) || null, status: "prepared", metadata: { execution_id: context.executionId, audience: record(input.audience), source: "phase13_runtime" } }) });
    return Array.isArray(rows) ? rows[0] : rows;
  });
  register("leo.campaign.send", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "campaign_send", true));

  register("leo.appointment.read", async (input, context) => {
    const organizationId = requireOrganization(context);
    const limit = Math.max(1, Math.min(100, numeric(input.limit, 25)));
    return supabaseServerRequest(`crm_tasks?select=id,customer_id,lead_id,assigned_agent_id,title,description,status,due_at,completed_at,metadata,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&task_type=eq.appointment_booking&order=due_at.asc&limit=${limit}`);
  });

  register("leo.appointment.manage", async (input, context) => {
    const organizationId = requireOrganization(context);
    const action = text(input.action) || "create";
    if (action === "create") {
      const rows = await supabaseServerRequest(`crm_tasks`, { method: "POST", body: JSON.stringify({ organization_id: organizationId, customer_id: text(input.customer_id) || null, lead_id: text(input.lead_id) || null, assigned_agent_id: context.agentId || null, task_type: "appointment_booking", title: text(input.title) || "Appointment", description: text(input.description) || null, status: "scheduled", due_at: requireId(input, "due_at"), metadata: { execution_id: context.executionId, source: "phase13_runtime" } }) });
      return Array.isArray(rows) ? rows[0] : rows;
    }
    const taskId = requireId(input, "appointment_id", "task_id", "id");
    const patch = action === "cancel" ? { status: "cancelled", updated_at: new Date().toISOString() } : { due_at: requireId(input, "due_at"), status: "scheduled", updated_at: new Date().toISOString() };
    const rows = await supabaseServerRequest(`crm_tasks?id=eq.${encodeURIComponent(taskId)}&organization_id=eq.${encodeURIComponent(organizationId)}&task_type=eq.appointment_booking`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Appointment was not found in this organization.");
    return rows[0];
  });

  register("leo.agent.pause", async (input, context) => {
    const organizationId = requireOrganization(context);
    const agentId = requireId(input, "agent_id", "id");
    const rows = await supabaseServerRequest(`agents?id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "paused", updated_at: new Date().toISOString() }) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Agent was not found in this organization.");
    return rows[0];
  });

  register("leo.agent.resume", async (input, context) => {
    const organizationId = requireOrganization(context);
    const agentId = requireId(input, "agent_id", "id");
    const rows = await supabaseServerRequest(`agents?id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "active", updated_at: new Date().toISOString() }) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Agent was not found in this organization.");
    return rows[0];
  });

  register("leo.support.request_admin_repair", async (input, context) => {
    const organizationId = requireOrganization(context);
    const rows = await supabaseServerRequest(`handoff_requests`, { method: "POST", body: JSON.stringify({ organization_id: organizationId, agent_id: context.agentId || null, reason: text(input.reason) || "Runtime requested platform repair review.", priority: text(input.priority) || "high", status: "open", notes: `Phase 13 execution ${context.executionId}` }) });
    return Array.isArray(rows) ? rows[0] : rows;
  });

  register("leo.platform.organizations.read", async (input) => {
    const limit = Math.max(1, Math.min(100, numeric(input.limit, 50)));
    return supabaseServerRequest(`organizations?select=id,name,slug,status,created_at,updated_at&order=updated_at.desc&limit=${limit}`);
  });

  register("leo.platform.tenant.pause", async (input) => {
    const organizationId = requireId(input, "organization_id", "tenant_id");
    const rows = await supabaseServerRequest(`organizations?id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "paused", updated_at: new Date().toISOString() }) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Organization was not found.");
    return rows[0];
  });

  register("leo.platform.tenant.resume", async (input) => {
    const organizationId = requireId(input, "organization_id", "tenant_id");
    const rows = await supabaseServerRequest(`organizations?id=eq.${encodeURIComponent(organizationId)}`, { method: "PATCH", body: JSON.stringify({ status: "active", updated_at: new Date().toISOString() }) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Organization was not found.");
    return rows[0];
  });

  register("leo.platform.workflow.activate", async (input) => {
    const workflowId = requireId(input, "workflow_id", "id");
    const rows = await supabaseServerRequest(`workflow_registry?id=eq.${encodeURIComponent(workflowId)}`, { method: "PATCH", body: JSON.stringify({ status: "active", updated_at: new Date().toISOString() }) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Workflow was not found.");
    return rows[0];
  });

  register("leo.platform.workflow.deactivate", async (input) => {
    const workflowId = requireId(input, "workflow_id", "id");
    const rows = await supabaseServerRequest(`workflow_registry?id=eq.${encodeURIComponent(workflowId)}`, { method: "PATCH", body: JSON.stringify({ status: "inactive", updated_at: new Date().toISOString() }) });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("Workflow was not found.");
    return rows[0];
  });

  register("leo.platform.workflow.resync", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "workflow_registry_resync", true));

  register("leo.limitless.leads.read", async (input, context) => {
    const organizationId = requireOrganization(context);
    const limit = Math.max(1, Math.min(100, numeric(input.limit, 25)));
    return supabaseServerRequest(`leads?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=${limit}`);
  });
  register("leo.limitless.followup.prepare", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "limitless_realty_followup_prepare", false));
  register("leo.limitless.followup.send", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "limitless_realty_followup_send", true));
  register("leo.limitless.campaign.prepare", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "limitless_realty_campaign_prepare", false));
  register("leo.limitless.campaign.send", async (input, context) => mappedWorkflow(input, context, text(input.workflow_key) || "limitless_realty_campaign_send", true));

  return registry;
}
