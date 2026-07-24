import { resolveTenantContext } from "@/lib/platform-repository";
import { isServerSupabaseConfigured, supabaseRest } from "@/lib/supabase-server-rest";

export type WorkflowStatus = "draft" | "active" | "paused" | "disabled" | "error";
export type WorkflowRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timed_out";
export type WorkflowEnvironment = "development" | "preview" | "staging" | "production";

export type WorkflowRecord = {
  id: string;
  organization_id: string;
  project_id: string;
  organization_uuid?: string | null;
  branch_id?: string | null;
  agent_family_id?: string | null;
  project_uuid?: string | null;
  agent_id?: string | null;
  workflow_key: string;
  name: string;
  description?: string | null;
  provider: string;
  external_workflow_id?: string | null;
  endpoint_url?: string | null;
  trigger_type?: string;
  environment?: WorkflowEnvironment;
  status: WorkflowStatus;
  current_version: number;
  timeout_seconds: number;
  max_retries: number;
  metadata?: Record<string, unknown>;
  last_run_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  organization_id: string;
  project_id: string;
  organization_uuid?: string | null;
  branch_id?: string | null;
  agent_family_id?: string | null;
  project_uuid?: string | null;
  agent_id?: string | null;
  workflow_key: string;
  provider_run_id?: string | null;
  status: WorkflowRunStatus;
  attempt: number;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  error_message?: string | null;
  duration_ms?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
};

type RegisterWorkflowInput = Partial<WorkflowRecord> & {
  organization_slug?: string;
  agent_family_slug?: string;
  project_slug?: string;
  agent_slug?: string;
};

const workflowStatuses = new Set<WorkflowStatus>(["draft", "active", "paused", "disabled", "error"]);
const environments = new Set<WorkflowEnvironment>(["development", "preview", "staging", "production"]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validateWorkflowInput(payload: RegisterWorkflowInput) {
  const workflowKey = cleanText(payload.workflow_key);
  const name = cleanText(payload.name);
  const projectId = cleanText(payload.project_id, cleanText(payload.project_slug, "maia"));

  if (!workflowKey || !name || !projectId) {
    throw new Error("project_id, workflow_key, and name are required.");
  }
  if (!/^[a-z0-9][a-z0-9-_]{1,119}$/i.test(workflowKey)) {
    throw new Error("workflow_key may only contain letters, numbers, hyphens, and underscores.");
  }
  if (payload.status && !workflowStatuses.has(payload.status)) {
    throw new Error("Invalid workflow status.");
  }
  if (payload.environment && !environments.has(payload.environment)) {
    throw new Error("Invalid workflow environment.");
  }

  const timeout = Number(payload.timeout_seconds ?? 60);
  const retries = Number(payload.max_retries ?? 2);
  if (!Number.isInteger(timeout) || timeout < 5 || timeout > 3600) {
    throw new Error("timeout_seconds must be an integer between 5 and 3600.");
  }
  if (!Number.isInteger(retries) || retries < 0 || retries > 10) {
    throw new Error("max_retries must be an integer between 0 and 10.");
  }

  return { workflowKey, name, projectId, timeout, retries };
}

export function isWorkflowRegistryConfigured() {
  return isServerSupabaseConfigured();
}

export async function getWorkflows(limit = 100) {
  if (!isWorkflowRegistryConfigured()) return [] as WorkflowRecord[];
  return supabaseRest<WorkflowRecord[]>(
    `workflow_registry?select=*&order=updated_at.desc.nullslast&limit=${limit}`,
  );
}

export async function getWorkflowRuns(limit = 100) {
  if (!isWorkflowRegistryConfigured()) return [] as WorkflowRun[];
  return supabaseRest<WorkflowRun[]>(
    `workflow_runs?select=*&order=created_at.desc&limit=${limit}`,
  );
}

export async function getWorkflowById(id: string) {
  const rows = await supabaseRest<WorkflowRecord[]>(
    `workflow_registry?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  return rows[0] || null;
}

export async function getWorkflowByKey(organizationId: string, workflowKey: string) {
  const context = await resolveTenantContext({
    organizationSlug: organizationId === "limitless-realty" ? "fluxknight" : organizationId,
    agentFamilySlug: organizationId === "fluxknight" ? "limitless-realty" : organizationId,
    projectSlug: "maia",
    agentSlug: "maia",
  }).catch(() => null);

  if (context) {
    const rows = await supabaseRest<WorkflowRecord[]>(
      `workflow_registry?organization_uuid=eq.${encodeURIComponent(context.organization.id)}&agent_family_id=eq.${encodeURIComponent(context.agentFamily.id)}&workflow_key=eq.${encodeURIComponent(workflowKey)}&select=*&limit=1`,
    );
    if (rows[0]) return rows[0];
  }

  const legacyRows = await supabaseRest<WorkflowRecord[]>(
    `workflow_registry?organization_id=eq.${encodeURIComponent(organizationId)}&workflow_key=eq.${encodeURIComponent(workflowKey)}&select=*&limit=1`,
  );
  return legacyRows[0] || null;
}

export async function registerWorkflow(payload: RegisterWorkflowInput) {
  const validated = validateWorkflowInput(payload);
  const organizationSlug = cleanText(payload.organization_slug, "fluxknight");
  const agentFamilySlug = cleanText(payload.agent_family_slug, cleanText(payload.organization_id, "limitless-realty"));
  const projectSlug = cleanText(payload.project_slug, validated.projectId === "limitless-realty" ? "maia" : validated.projectId);
  const agentSlug = cleanText(payload.agent_slug, "maia");

  const context = await resolveTenantContext({
    organizationSlug,
    agentFamilySlug,
    projectSlug,
    agentSlug,
  });

  const legacyOrganizationId = agentFamilySlug;
  const existing = await getWorkflowByKey(legacyOrganizationId, validated.workflowKey);
  const record = {
    organization_id: legacyOrganizationId,
    project_id: projectSlug,
    organization_uuid: context.organization.id,
    branch_id: context.branch?.id || null,
    agent_family_id: context.agentFamily.id,
    project_uuid: context.project.id,
    agent_id: context.agent?.id || null,
    workflow_key: validated.workflowKey,
    name: validated.name,
    description: payload.description || null,
    provider: cleanText(payload.provider, "n8n"),
    external_workflow_id: payload.external_workflow_id || null,
    endpoint_url: payload.endpoint_url || null,
    trigger_type: cleanText(payload.trigger_type, "webhook"),
    environment: payload.environment || "production",
    status: payload.status || "draft",
    current_version: Number(payload.current_version || 1),
    timeout_seconds: validated.timeout,
    max_retries: validated.retries,
    metadata: payload.metadata || {},
  };

  if (existing) {
    const rows = await supabaseRest<WorkflowRecord[]>(
      `workflow_registry?id=eq.${encodeURIComponent(existing.id)}`,
      { method: "PATCH", body: JSON.stringify(record) },
    );
    return rows[0];
  }

  const rows = await supabaseRest<WorkflowRecord[]>("workflow_registry", {
    method: "POST",
    body: JSON.stringify(record),
  });
  return rows[0];
}

export async function updateWorkflow(id: string, payload: Partial<WorkflowRecord>) {
  if (payload.status && !workflowStatuses.has(payload.status)) throw new Error("Invalid workflow status.");
  if (payload.environment && !environments.has(payload.environment)) throw new Error("Invalid workflow environment.");

  const allowed: Partial<WorkflowRecord> = {};
  const fields: Array<keyof WorkflowRecord> = [
    "name",
    "description",
    "provider",
    "external_workflow_id",
    "endpoint_url",
    "trigger_type",
    "environment",
    "status",
    "current_version",
    "timeout_seconds",
    "max_retries",
    "metadata",
    "last_run_at",
    "last_success_at",
    "last_error_at",
  ];

  for (const field of fields) {
    if (payload[field] !== undefined) Object.assign(allowed, { [field]: payload[field] });
  }

  const rows = await supabaseRest<WorkflowRecord[]>(
    `workflow_registry?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(allowed) },
  );
  return rows[0] || null;
}

export async function createWorkflowRun(workflow: WorkflowRecord, inputPayload: Record<string, unknown>) {
  const rows = await supabaseRest<WorkflowRun[]>("workflow_runs", {
    method: "POST",
    body: JSON.stringify({
      workflow_id: workflow.id,
      organization_id: workflow.organization_id,
      project_id: workflow.project_id,
      organization_uuid: workflow.organization_uuid || null,
      branch_id: workflow.branch_id || null,
      agent_family_id: workflow.agent_family_id || null,
      project_uuid: workflow.project_uuid || null,
      agent_id: workflow.agent_id || null,
      workflow_key: workflow.workflow_key,
      status: "queued",
      attempt: 1,
      input_payload: inputPayload,
    }),
  });
  return rows[0];
}

export async function updateWorkflowRun(id: string, payload: Partial<WorkflowRun>) {
  const rows = await supabaseRest<WorkflowRun[]>(
    `workflow_runs?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return rows[0] || null;
}

export async function updateWorkflowHeartbeat(
  workflowId: string,
  fields: Partial<Pick<WorkflowRecord, "last_run_at" | "last_success_at" | "last_error_at" | "status">>,
) {
  return updateWorkflow(workflowId, fields);
}

export async function getWorkflowRegistrySummary() {
  const [workflows, runs] = await Promise.all([getWorkflows(), getWorkflowRuns(250)]);
  const succeeded = runs.filter((run) => run.status === "succeeded").length;
  const failed = runs.filter((run) => ["failed", "timed_out"].includes(run.status)).length;
  const completed = succeeded + failed;

  return {
    configured: isWorkflowRegistryConfigured(),
    workflows,
    runs,
    active: workflows.filter((workflow) => workflow.status === "active").length,
    paused: workflows.filter((workflow) => workflow.status === "paused").length,
    failures: failed,
    successRate: completed ? Math.round((succeeded / completed) * 100) : 0,
  };
}
