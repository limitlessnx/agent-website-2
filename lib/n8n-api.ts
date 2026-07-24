export type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
  createdAt?: string;
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

export async function listN8nWorkflows(limit = 100) {
  const result = await n8nRequest<{ data?: N8nWorkflow[] } | N8nWorkflow[]>(`/workflows?limit=${limit}`);
  return Array.isArray(result) ? result : result.data || [];
}

export async function listN8nExecutions(limit = 100) {
  const result = await n8nRequest<{ data?: N8nExecution[] } | N8nExecution[]>(`/executions?limit=${limit}`);
  return Array.isArray(result) ? result : result.data || [];
}

export async function activateN8nWorkflow(id: string) {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(id)}/activate`, { method: "POST" });
}

export async function deactivateN8nWorkflow(id: string) {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
}
