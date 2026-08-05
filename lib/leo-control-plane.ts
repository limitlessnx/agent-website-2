import { activateN8nWorkflow, deactivateN8nWorkflow, getN8nWorkflow, listN8nExecutions } from "@/lib/n8n-api";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type LeoAction = {
  id: string;
  conversation_id: string;
  organization_id?: string | null;
  action_key: string;
  title: string;
  description?: string | null;
  risk_level: "low" | "medium" | "high";
  status: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
};

const READ_ONLY = new Set([
  "inspect_tenant",
  "inspect_agent",
  "inspect_workflow",
  "inspect_workflow_failures",
  "verify_tenant_integrations",
]);

const EXECUTABLE = new Set([
  ...READ_ONLY,
  "pause_tenant",
  "resume_tenant",
  "pause_agent",
  "resume_agent",
  "activate_workflow",
  "deactivate_workflow",
  "retry_failed_execution",
  "resync_workflow_registry",
]);

export function requiresApproval(actionKey: string) {
  return !READ_ONLY.has(actionKey);
}

export function isKnownLeoAction(actionKey: string) {
  return EXECUTABLE.has(actionKey);
}

async function event(
  action: LeoAction,
  eventType: string,
  actor?: string,
  details: Record<string, unknown> = {},
  beforeState?: unknown,
  afterState?: unknown,
) {
  await supabaseServerRequest("support_action_events", {
    method: "POST",
    body: JSON.stringify({
      action_id: action.id,
      organization_id: action.organization_id || null,
      event_type: eventType,
      actor: actor || null,
      before_state: beforeState ?? null,
      after_state: afterState ?? null,
      details,
    }),
  });
}

async function patchAction(actionId: string, patch: Record<string, unknown>) {
  const rows = await supabaseServerRequest<LeoAction[]>(`support_actions?id=eq.${encodeURIComponent(actionId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return rows[0];
}

function requiredString(payload: Record<string, unknown>, key: string) {
  const value = String(payload[key] || "").trim();
  if (!value) throw new Error(`Leo action payload is missing ${key}.`);
  return value;
}

async function inspectTenant(organizationId: string) {
  const [organizations, agents, integrations, workflows, runs] = await Promise.all([
    supabaseServerRequest<any[]>(`organizations?id=eq.${encodeURIComponent(organizationId)}&select=id,name,slug,status,metadata&limit=1`),
    supabaseServerRequest<any[]>(`agents?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,name,status,agent_type&order=created_at.asc`),
    supabaseServerRequest<any[]>(`organization_integrations?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,provider,display_name,status,last_checked_at&order=provider.asc`),
    supabaseServerRequest<any[]>(`workflow_registry?organization_uuid=eq.${encodeURIComponent(organizationId)}&select=id,name,workflow_key,status,provider,external_workflow_id,last_run_at,last_error_at`),
    supabaseServerRequest<any[]>(`workflow_runs?organization_uuid=eq.${encodeURIComponent(organizationId)}&select=id,workflow_key,status,error_message,created_at&order=created_at.desc&limit=20`),
  ]);
  return { organization: organizations[0] || null, agents, integrations, workflows, recentRuns: runs };
}

export async function executeLeoAction(action: LeoAction, actor: string) {
  if (!isKnownLeoAction(action.action_key)) throw new Error(`Unsupported Leo action: ${action.action_key}`);
  if (requiresApproval(action.action_key) && action.status !== "approved") {
    throw new Error("This Leo action requires approval before execution.");
  }
  if (!requiresApproval(action.action_key) && !["proposed", "approved"].includes(action.status)) {
    throw new Error(`Action cannot execute from status ${action.status}.`);
  }

  const payload = action.payload || {};
  await patchAction(action.id, { status: "executing" });
  await event(action, "executing", actor, { action_key: action.action_key });

  try {
    let beforeState: unknown = null;
    let afterState: unknown = null;
    let result: Record<string, unknown> = {};

    switch (action.action_key) {
      case "inspect_tenant": {
        const organizationId = requiredString(payload, "organization_id");
        result = await inspectTenant(organizationId);
        afterState = result;
        break;
      }
      case "inspect_agent": {
        const organizationId = requiredString(payload, "organization_id");
        const agentId = requiredString(payload, "agent_id");
        const rows = await supabaseServerRequest<any[]>(`agents?organization_id=eq.${encodeURIComponent(organizationId)}&id=eq.${encodeURIComponent(agentId)}&select=*&limit=1`);
        result = { agent: rows[0] || null };
        afterState = result;
        break;
      }
      case "inspect_workflow":
      case "inspect_workflow_failures": {
        const workflowId = String(payload.n8n_workflow_id || "").trim();
        if (workflowId) {
          const [workflow, executions] = await Promise.all([
            getN8nWorkflow(workflowId),
            listN8nExecutions({ workflowId, limit: 20, includeData: true }),
          ]);
          result = { workflow, executions };
        } else {
          const organizationId = requiredString(payload, "organization_id");
          result = await inspectTenant(organizationId);
        }
        afterState = result;
        break;
      }
      case "verify_tenant_integrations": {
        const organizationId = requiredString(payload, "organization_id");
        const integrations = await supabaseServerRequest<any[]>(`organization_integrations?organization_id=eq.${encodeURIComponent(organizationId)}&select=*&order=provider.asc`);
        result = {
          integrations,
          unhealthy: integrations.filter((row) => !["connected", "active", "healthy"].includes(String(row.status).toLowerCase())),
        };
        afterState = result;
        break;
      }
      case "pause_tenant":
      case "resume_tenant": {
        const organizationId = requiredString(payload, "organization_id");
        const rows = await supabaseServerRequest<any[]>(`organizations?id=eq.${encodeURIComponent(organizationId)}&select=id,name,status&limit=1`);
        if (!rows[0]) throw new Error("Tenant organization not found.");
        beforeState = rows[0];
        const status = action.action_key === "pause_tenant" ? "suspended" : "active";
        const updated = await supabaseServerRequest<any[]>(`organizations?id=eq.${encodeURIComponent(organizationId)}`, {
          method: "PATCH",
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
        });
        afterState = updated[0];
        result = { organization: updated[0], verified: updated[0]?.status === status };
        break;
      }
      case "pause_agent":
      case "resume_agent": {
        const organizationId = requiredString(payload, "organization_id");
        const agentId = requiredString(payload, "agent_id");
        const rows = await supabaseServerRequest<any[]>(`agents?organization_id=eq.${encodeURIComponent(organizationId)}&id=eq.${encodeURIComponent(agentId)}&select=id,name,status&limit=1`);
        if (!rows[0]) throw new Error("Tenant agent not found.");
        beforeState = rows[0];
        const status = action.action_key === "pause_agent" ? "paused" : String(payload.resume_status || "testing");
        if (!["draft", "testing", "published", "paused"].includes(status)) throw new Error("Invalid agent status.");
        const updated = await supabaseServerRequest<any[]>(`agents?organization_id=eq.${encodeURIComponent(organizationId)}&id=eq.${encodeURIComponent(agentId)}`, {
          method: "PATCH",
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
        });
        afterState = updated[0];
        result = { agent: updated[0], verified: updated[0]?.status === status };
        break;
      }
      case "activate_workflow":
      case "deactivate_workflow": {
        const registryId = requiredString(payload, "workflow_registry_id");
        const rows = await supabaseServerRequest<any[]>(`workflow_registry?id=eq.${encodeURIComponent(registryId)}&select=*&limit=1`);
        if (!rows[0]) throw new Error("Workflow registry record not found.");
        beforeState = rows[0];
        const n8nWorkflowId = String(payload.n8n_workflow_id || rows[0].external_workflow_id || "").trim();
        if (!n8nWorkflowId) throw new Error("No n8n workflow ID is mapped to this registry record.");
        const n8nWorkflow = action.action_key === "activate_workflow"
          ? await activateN8nWorkflow(n8nWorkflowId)
          : await deactivateN8nWorkflow(n8nWorkflowId);
        const status = action.action_key === "activate_workflow" ? "active" : "paused";
        const updated = await supabaseServerRequest<any[]>(`workflow_registry?id=eq.${encodeURIComponent(registryId)}`, {
          method: "PATCH",
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
        });
        const workflowState: Record<string, unknown> = { registry: updated[0], n8n: n8nWorkflow };
        afterState = workflowState;
        result = {
          registry: updated[0],
          n8n: n8nWorkflow,
          verified: Boolean(n8nWorkflow.active) === (status === "active"),
        };
        break;
      }
      case "retry_failed_execution": {
        result = {
          queued: false,
          note: "n8n public API does not provide a universal execution retry endpoint. The failed execution has been inspected; use the workflow webhook or n8n UI retry for this workflow.",
        };
        afterState = result;
        break;
      }
      case "resync_workflow_registry": {
        const organizationId = requiredString(payload, "organization_id");
        result = await inspectTenant(organizationId);
        afterState = result;
        break;
      }
    }

    const verified = result.verified !== false;
    if (!verified) throw new Error("Leo executed the action but verification failed.");
    await patchAction(action.id, { status: "completed", result, completed_at: new Date().toISOString() });
    await event(action, "verified", actor, { verified: true }, beforeState, afterState);
    await event(action, "completed", actor, result, beforeState, afterState);
    return { ok: true, actionId: action.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo action failed.";
    await patchAction(action.id, { status: "failed", result: { error: message }, completed_at: new Date().toISOString() });
    await event(action, "failed", actor, { error: message });
    throw error;
  }
}
