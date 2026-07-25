export type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
  createdAt?: string;
  nodes?: unknown[];
  connections?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

export type N8nExecution = {
  id: string;
  workflowId: string;
  status?: string;
  finished?: boolean;
  startedAt?: string;
  stoppedAt?: string;
  mode?: string;
};

function config() {
  const baseUrl = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
  const apiKey = process.env.N8N_API_KEY || "";
  if (!baseUrl || !apiKey) {
    throw new Error("N8N_BASE_URL and N8N_API_KEY must be configured.");
  }
  return { baseUrl, apiKey };
}

async function n8nRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = config();
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`n8n API request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function isN8nApiConfigured() {
  return Boolean(process.env.N8N_BASE_URL && process.env.N8N_API_KEY);
}

export function getN8nBaseUrl() {
  return config().baseUrl;
}

export async function listN8nWorkflows(limit = 100) {
  const result = await n8nRequest<{ data?: N8nWorkflow[] } | N8nWorkflow[]>(`/workflows?limit=${limit}`);
  return Array.isArray(result) ? result : result.data || [];
}

export async function getN8nWorkflow(id: string) {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(id)}`);
}

function normalizedWorkflowName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findN8nWorkflowByName(name: string) {
  const workflows = await listN8nWorkflows(250);
  const target = normalizedWorkflowName(name);
  return workflows.find((workflow) => normalizedWorkflowName(workflow.name) === target) || null;
}

export async function findN8nWorkflowFlexible(options: {
  exactNames?: string[];
  requiredKeywords?: string[];
  preferredKeywords?: string[];
  workflowId?: string;
}) {
  if (options.workflowId) {
    try {
      return await getN8nWorkflow(options.workflowId);
    } catch {
      // Continue to name and keyword matching.
    }
  }

  const workflows = await listN8nWorkflows(250);
  const exactTargets = (options.exactNames || []).map(normalizedWorkflowName).filter(Boolean);

  const exact = workflows.find((workflow) => exactTargets.includes(normalizedWorkflowName(workflow.name)));
  if (exact) return exact;

  const required = (options.requiredKeywords || []).map(normalizedWorkflowName).filter(Boolean);
  const preferred = (options.preferredKeywords || []).map(normalizedWorkflowName).filter(Boolean);

  const ranked = workflows
    .map((workflow) => {
      const name = normalizedWorkflowName(workflow.name);
      const allRequired = required.every((keyword) => name.includes(keyword));
      if (!allRequired) return null;
      const preferredScore = preferred.reduce((score, keyword) => score + (name.includes(keyword) ? 1 : 0), 0);
      return { workflow, score: preferredScore + (workflow.active ? 0.25 : 0) };
    })
    .filter((entry): entry is { workflow: N8nWorkflow; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.workflow || null;
}

export async function listN8nExecutions(limit = 100) {
  const result = await n8nRequest<{ data?: N8nExecution[] } | N8nExecution[]>(`/executions?limit=${limit}`);
  return Array.isArray(result) ? result : result.data || [];
}

export async function createN8nWorkflow(workflow: Omit<N8nWorkflow, "id" | "active"> & { active?: boolean }) {
  return n8nRequest<N8nWorkflow>("/workflows", { method: "POST", body: JSON.stringify(workflow) });
}

export async function updateN8nWorkflow(id: string, workflow: Partial<N8nWorkflow>) {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(workflow) });
}

export async function activateN8nWorkflow(id: string) {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(id)}/activate`, { method: "POST" });
}

export async function deactivateN8nWorkflow(id: string) {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
}
