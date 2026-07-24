export type WorkflowStatus = "draft" | "active" | "paused" | "disabled" | "error";
export type WorkflowRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timed_out";

export type WorkflowRecord = {
  id: string;
  organization_id: string;
  project_id: string;
  workflow_key: string;
  name: string;
  description?: string;
  provider: string;
  external_workflow_id?: string;
  endpoint_url?: string;
  status: WorkflowStatus;
  current_version: number;
  timeout_seconds: number;
  max_retries: number;
  metadata?: Record<string, unknown>;
  last_run_at?: string;
  last_success_at?: string;
  last_error_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  organization_id: string;
  project_id: string;
  workflow_key: string;
  provider_run_id?: string;
  status: WorkflowRunStatus;
  attempt: number;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  error_message?: string;
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
};

type SupabaseConfig = { url: string; key: string };

function getSupabaseConfig(): SupabaseConfig {
  const url =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  return { url: url.replace(/\/$/, ""), key };
}

function assertConfigured() {
  const config = getSupabaseConfig();
  if (!config.url || !config.key) throw new Error("Supabase workflow registry is not configured.");
  return config;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = assertConfigured();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Workflow registry request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function isWorkflowRegistryConfigured() {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

export async function getWorkflows(limit = 100) {
  if (!isWorkflowRegistryConfigured()) return [] as WorkflowRecord[];
  return request<WorkflowRecord[]>(
    `workflow_registry?select=*&order=updated_at.desc.nullslast&limit=${limit}`,
  );
}

export async function getWorkflowRuns(limit = 100) {
  if (!isWorkflowRegistryConfigured()) return [] as WorkflowRun[];
  return request<WorkflowRun[]>(
    `workflow_runs?select=*&order=created_at.desc&limit=${limit}`,
  );
}

export async function getWorkflowById(id: string) {
  const rows = await request<WorkflowRecord[]>(
    `workflow_registry?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  return rows[0] || null;
}

export async function getWorkflowByKey(organizationId: string, workflowKey: string) {
  const rows = await request<WorkflowRecord[]>(
    `workflow_registry?organization_id=eq.${encodeURIComponent(organizationId)}&workflow_key=eq.${encodeURIComponent(workflowKey)}&select=*&limit=1`,
  );
  return rows[0] || null;
}

export async function registerWorkflow(payload: Partial<WorkflowRecord>) {
  if (!payload.project_id || !payload.workflow_key || !payload.name) {
    throw new Error("project_id, workflow_key, and name are required.");
  }

  const organizationId = payload.organization_id || "limitless-realty";
  const existing = await getWorkflowByKey(organizationId, payload.workflow_key);
  const record = {
    organization_id: organizationId,
    project_id: payload.project_id,
    workflow_key: payload.workflow_key,
    name: payload.name,
    description: payload.description || null,
    provider: payload.provider || "n8n",
    external_workflow_id: payload.external_workflow_id || null,
    endpoint_url: payload.endpoint_url || null,
    status: payload.status || "draft",
    current_version: payload.current_version || 1,
    timeout_seconds: payload.timeout_seconds || 60,
    max_retries: payload.max_retries ?? 2,
    metadata: payload.metadata || {},
  };

  if (existing) {
    const rows = await request<WorkflowRecord[]>(
      `workflow_registry?id=eq.${encodeURIComponent(existing.id)}`,
      { method: "PATCH", body: JSON.stringify(record) },
    );
    return rows[0];
  }

  const rows = await request<WorkflowRecord[]>("workflow_registry", {
    method: "POST",
    body: JSON.stringify(record),
  });
  return rows[0];
}

export async function updateWorkflow(id: string, payload: Partial<WorkflowRecord>) {
  const allowed: Partial<WorkflowRecord> = {};
  const fields: Array<keyof WorkflowRecord> = [
    "name",
    "description",
    "provider",
    "external_workflow_id",
    "endpoint_url",
    "status",
    "current_version",
    "timeout_seconds",
    "max_retries",
    "metadata",
  ];

  for (const field of fields) {
    if (payload[field] !== undefined) Object.assign(allowed, { [field]: payload[field] });
  }

  const rows = await request<WorkflowRecord[]>(
    `workflow_registry?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(allowed) },
  );
  return rows[0] || null;
}

export async function createWorkflowRun(
  workflow: WorkflowRecord,
  inputPayload: Record<string, unknown>,
) {
  const rows = await request<WorkflowRun[]>("workflow_runs", {
    method: "POST",
    body: JSON.stringify({
      workflow_id: workflow.id,
      organization_id: workflow.organization_id,
      project_id: workflow.project_id,
      workflow_key: workflow.workflow_key,
      status: "queued",
      attempt: 1,
      input_payload: inputPayload,
    }),
  });
  return rows[0];
}

export async function updateWorkflowRun(id: string, payload: Partial<WorkflowRun>) {
  const rows = await request<WorkflowRun[]>(
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
