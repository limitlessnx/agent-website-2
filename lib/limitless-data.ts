export type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  score?: string;
  budget?: string;
  location_preference?: string;
  property_type?: string;
  purpose?: string;
  follow_up_stage?: number;
  last_contacted_at?: string;
  last_follow_up_at?: string;
  created_at?: string;
};

export type PropertyRecord = {
  id: string;
  title: string;
  location_area?: string;
  location_city?: string;
  price?: string;
  type?: string;
  status?: string;
  drive_photos_link?: string;
  drive_brochure_link?: string;
  features?: string;
  description?: string;
  created_at?: string;
};

export type CampaignReport = {
  id: string;
  campaign_topic: string;
  attempted: number;
  accepted: number;
  failed: number;
  skipped: number;
  created_at: string;
};

export type AutomationProject = {
  id: string;
  name: string;
  status: "production" | "draft" | "paused";
  channel: string;
  description: string;
  workflows: number;
};

const seedLeads: Lead[] = [
  {
    id: "sample-1",
    name: "Limitless Test",
    phone: "2347036233508",
    status: "in_conversation",
    score: "warm",
    budget: "N5,000,000",
    location_preference: "Benin City, Edo State",
    property_type: "land",
    purpose: "investment",
    follow_up_stage: 1,
    last_contacted_at: new Date().toISOString(),
  },
];

const seedProperties: PropertyRecord[] = [
  {
    id: "sample-property-1",
    title: "Iwinosa Mega City",
    location_area: "Okome Community",
    location_city: "Edo State",
    price: "N650,000",
    type: "Land / Estate",
    status: "active",
    features: "Deed of Assignment, Registered Survey, C of O in view",
  },
  {
    id: "sample-property-2",
    title: "Atlanta City Estate Phase 1",
    location_area: "Ureghin Community, Off Airport Road",
    location_city: "Benin City, Edo State",
    price: "N2,500,000",
    type: "Landed Property",
    status: "active",
    features: "Certificate of Occupancy, road access, fast-developing area",
  },
];

const seedCampaigns: CampaignReport[] = [
  {
    id: "sample-campaign-1",
    campaign_topic: "Benin estate update",
    attempted: 1,
    accepted: 1,
    failed: 0,
    skipped: 3,
    created_at: new Date().toISOString(),
  },
];

export const automationProjects: AutomationProject[] = [
  {
    id: "limitless-realty",
    name: "Limitless Realty",
    status: "production",
    channel: "WhatsApp + Telegram + n8n",
    description: "Maia property assistant, leads, properties, campaigns, and auto follow-ups.",
    workflows: 8,
  },
  {
    id: "gencouv",
    name: "Gencouv",
    status: "draft",
    channel: "Email + CRM",
    description: "Lead generation and dormant-lead outbound system.",
    workflows: 2,
  },
  {
    id: "fluxagents",
    name: "FluxAgents Voice AI",
    status: "draft",
    channel: "Voice + Web",
    description: "Voice agent intake and website demo automation.",
    workflows: 1,
  },
];

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  return { url: url.replace(/\/$/, ""), key };
}

export function isSupabaseConfigured() {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

async function supabaseFetch<T>(table: string, query = "", init?: RequestInit): Promise<T[]> {
  const { url, key } = supabaseConfig();
  if (!url || !key) return [];

  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
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

  if (!response.ok) throw new Error(`Supabase ${table} request failed: ${response.status}`);
  return (await response.json()) as T[];
}

export async function getLeads(limit = 50) {
  if (!isSupabaseConfigured()) return seedLeads;
  return supabaseFetch<Lead>("leads", `?select=*&order=updated_at.desc.nullslast&limit=${limit}`);
}

export async function getProperties(limit = 100) {
  if (!isSupabaseConfigured()) return seedProperties;
  return supabaseFetch<PropertyRecord>("properties", `?select=*&order=updated_at.desc.nullslast&limit=${limit}`);
}

export async function getCampaignReports(limit = 25) {
  if (!isSupabaseConfigured()) return seedCampaigns;
  const rows = await supabaseFetch<{ id: string; content?: string; created_at?: string }>(
    "bot_sessions",
    `?select=*&role=eq.whatsapp_campaign_context&order=created_at.desc&limit=${limit}`,
  );

  return rows.map((row) => {
    let content: Record<string, unknown> = {};
    try {
      content = typeof row.content === "string" ? JSON.parse(row.content) : row.content || {};
    } catch {}
    return {
      id: row.id,
      campaign_topic: String(content.campaign_topic || content.topic || "WhatsApp campaign"),
      attempted: Number(content.attempted || 0),
      accepted: Number(content.accepted || 0),
      failed: Number(content.failed || 0),
      skipped: Number(content.skipped || 0),
      created_at: row.created_at || "",
    };
  });
}

export async function createLead(payload: Partial<Lead>) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  return supabaseFetch<Lead>("leads", "", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name || "Unknown",
      phone: payload.phone || "",
      status: payload.status || "new",
      score: payload.score || "unscored",
      budget: payload.budget || "",
      location_preference: payload.location_preference || "",
      property_type: payload.property_type || "",
      purpose: payload.purpose || "",
      source: "admin_dashboard",
    }),
  });
}

export async function createProperty(payload: Partial<PropertyRecord>) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  return supabaseFetch<PropertyRecord>("properties", "", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title || "Untitled property",
      location_area: payload.location_area || "",
      location_city: payload.location_city || "",
      price: payload.price || "",
      type: payload.type || "",
      status: payload.status || "active",
      drive_photos_link: payload.drive_photos_link || "",
      drive_brochure_link: payload.drive_brochure_link || "",
      features: payload.features || "",
      description: payload.description || "",
    }),
  });
}

export async function getN8nStatus() {
  const baseUrl = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
  const email = process.env.N8N_EMAIL || "";
  const password = process.env.N8N_PASSWORD || "";
  if (!baseUrl || !email || !password) {
    return { configured: false, activeWorkflows: 0, workflows: [] as { id: string; name: string; active: boolean }[] };
  }

  const jar = new Map<string, string>();
  const remember = (response: Response) => {
    const cookie = response.headers.get("set-cookie");
    if (!cookie) return;
    const first = cookie.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
  };
  const cookieHeader = () => [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");

  const login = await fetch(`${baseUrl}/rest/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ emailOrLdapLoginId: email, password }),
    cache: "no-store",
  });
  remember(login);
  if (!login.ok) return { configured: true, activeWorkflows: 0, workflows: [], error: "n8n login failed" };

  const response = await fetch(`${baseUrl}/rest/workflows?limit=100`, {
    headers: { Accept: "application/json", Cookie: cookieHeader() },
    cache: "no-store",
  });
  if (!response.ok) return { configured: true, activeWorkflows: 0, workflows: [], error: "n8n workflow fetch failed" };

  const data = await response.json();
  const rows = data.data || data.results || data || [];
  const workflows = Array.isArray(rows)
    ? rows.map((row) => ({ id: String(row.id), name: String(row.name), active: Boolean(row.active) }))
    : [];

  return {
    configured: true,
    activeWorkflows: workflows.filter((workflow) => workflow.active).length,
    workflows,
  };
}
