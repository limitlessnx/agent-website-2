export type EvaluationSessionDetail = {
  id: string;
  industry?: string | null;
  context?: Record<string, unknown> | null;
  messages?: Array<Record<string, unknown>> | null;
  evaluation?: Record<string, unknown> | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_consent?: boolean | null;
  status?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EvaluationTimelineEvent = {
  id: string;
  event_type: string;
  channel?: string | null;
  title: string;
  summary?: string | null;
  occurred_at: string;
  actor_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type EvaluationImplementationOpportunity = {
  id: string;
  title: string;
  pricing_type?: string | null;
  status: string;
  evaluation?: Record<string, unknown> | null;
  contact_consent?: boolean | null;
  contact_channels?: string[] | null;
};

export type EvaluationLeadDetail = {
  lead: EvaluationLead;
  session: EvaluationSessionDetail | null;
  timeline: EvaluationTimelineEvent[];
  implementation_opportunities: EvaluationImplementationOpportunity[];
};

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
  organization_id?: string | null;
  customer_id?: string | null;
  conversation_id?: string | null;
  evaluation_session_id?: string | null;
  ai_evaluation?: { score?: number; opportunity?: string; summary?: string; nextStep?: string; recommendedSystem?: string; estimatedAutomationPotential?: string; recommendedAgents?: string[]; integrations?: string[]; bottlenecks?: string[]; opportunities?: { title: string; description: string; impact: string; potential: number }[]; pricingType?: string; recommendationReason?: string; voiceAgent?: string; voiceReason?: string } | null;
  pricing_type?: string | null;
  approval_at?: string | null;
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

export async function getEvaluationLeads(limit = 500, organizationId?: string): Promise<EvaluationLead[]> {
  const filters = organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
  return request<EvaluationLead>(`?select=*&order=submitted_at.desc&limit=${Math.max(1, Math.min(limit, 2000))}${filters}`);
}

async function requestTable<T>(table: string, query = ""): Promise<T[]> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${table} request failed: ${response.status} ${detail}`);
  }
  return response.status === 204 ? [] : ((await response.json()) as T[]);
}

export async function getEvaluationLeadDetail(id: string, organizationId: string): Promise<EvaluationLeadDetail | null> {
  if (!id || !organizationId) throw new Error("Evaluation lead scope is required.");

  const leads = await request<EvaluationLead>(`?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
  const lead = leads[0];
  if (!lead) return null;

  const [sessions, timeline, opportunities] = await Promise.all([
    lead.evaluation_session_id
      ? requestTable<EvaluationSessionDetail>(
          "ai_business_evaluation_sessions",
          `?id=eq.${encodeURIComponent(lead.evaluation_session_id)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`,
        )
      : Promise.resolve([]),
    lead.customer_id
      ? requestTable<EvaluationTimelineEvent>(
          "customer_timeline_events",
          `?organization_id=eq.${encodeURIComponent(organizationId)}&customer_id=eq.${encodeURIComponent(lead.customer_id)}&select=id,event_type,channel,title,summary,occurred_at,actor_type,metadata&order=occurred_at.desc&limit=100`,
        )
      : Promise.resolve([]),
    requestTable<EvaluationImplementationOpportunity>(
      "evaluation_implementation_opportunities",
      `?evaluation_lead_id=eq.${encodeURIComponent(lead.id)}&order=created_at.desc&limit=50`,
    ),
  ]);

  return {
    lead,
    session: sessions[0] || null,
    timeline,
    implementation_opportunities: opportunities,
  };
}

export async function updateEvaluationLeadStatus(id: string, status: string, organizationId?: string): Promise<EvaluationLead[]> {
  const allowed = new Set(["new", "contacted", "qualified", "converted", "closed"]);
  const normalized = String(status || "").trim().toLowerCase();
  if (!allowed.has(normalized)) throw new Error("Invalid evaluation status.");
  if (!id) throw new Error("Evaluation lead ID is required.");

  const scope = organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
  return request<EvaluationLead>(`?id=eq.${encodeURIComponent(id)}${scope}`, {
    method: "PATCH",
    body: JSON.stringify({ status: normalized, updated_at: new Date().toISOString() }),
  });
}
