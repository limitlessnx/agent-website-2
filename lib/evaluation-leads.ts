export type EvaluationLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  business_name: string;
  business_type: string;
  agent_types: string[];
  main_goal: string;
  current_tools?: string | null;
  lead_volume: string;
  timeline: string;
  budget: string;
  preferred_contact_time?: string | null;
  consent_given: boolean;
  source: string;
  status: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

function config() {
  const url = (
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  if (!url || !key) throw new Error("Supabase configuration is missing.");
  return { url, key };
}

async function request<T>(query = "", init?: RequestInit): Promise<T[]> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/evaluation_leads${query}`, {
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
    throw new Error(`Evaluation leads request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) return [];
  return (await response.json()) as T[];
}

export async function getEvaluationLeads(limit = 500): Promise<EvaluationLead[]> {
  return request<EvaluationLead>(`?select=*&order=submitted_at.desc&limit=${Math.max(1, Math.min(limit, 2000))}`);
}

export async function updateEvaluationLeadStatus(id: string, status: string): Promise<EvaluationLead[]> {
  const allowed = new Set(["new", "contacted", "qualified", "converted", "closed"]);
  const normalized = String(status || "").trim().toLowerCase();
  if (!allowed.has(normalized)) throw new Error("Invalid evaluation status.");
  if (!id) throw new Error("Evaluation lead ID is required.");

  return request<EvaluationLead>(`?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: normalized, updated_at: new Date().toISOString() }),
  });
}
