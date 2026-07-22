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

export type LeadImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export type SupabaseTableStatus = {
  table: string;
  ready: boolean;
  error?: string;
};

export type SupabaseReadiness = {
  configured: boolean;
  ready: boolean;
  tables: SupabaseTableStatus[];
};

const requiredSupabaseTables = ["leads", "properties", "bot_sessions"] as const;

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
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
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

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase ${table} request failed: ${response.status} ${detail}`);
  }
  return (await response.json()) as T[];
}

async function supabasePatch<T>(table: string, query: string, payload: Record<string, unknown>): Promise<T[]> {
  return supabaseFetch<T>(table, query, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function supabaseFetchWithFallback<T>(table: string, queries: string[], fallback: T[]) {
  const shouldUseFallback = process.env.NODE_ENV !== "production";
  if (!isSupabaseConfigured()) return shouldUseFallback ? fallback : [];
  let lastError: unknown = null;

  for (const query of queries) {
    try {
      return await supabaseFetch<T>(table, query);
    } catch (error) {
      lastError = error;
    }
  }

  console.error(`Unable to load Supabase table "${table}".`, lastError);
  return shouldUseFallback ? fallback : [];
}

async function checkSupabaseTable(table: string): Promise<SupabaseTableStatus> {
  if (!isSupabaseConfigured()) return { table, ready: false, error: "Supabase env vars are missing." };

  try {
    await supabaseFetch<Record<string, unknown>>(table, "?select=id&limit=1", {
      headers: { Prefer: "return=minimal" },
    });
    return { table, ready: true };
  } catch (error) {
    return {
      table,
      ready: false,
      error: error instanceof Error ? error.message : "Table check failed.",
    };
  }
}

export async function getSupabaseReadiness(): Promise<SupabaseReadiness> {
  const configured = isSupabaseConfigured();
  const tables = configured ? await Promise.all(requiredSupabaseTables.map(checkSupabaseTable)) : [];

  return {
    configured,
    ready: configured && tables.every((table) => table.ready),
    tables,
  };
}

function normalizeLead(row: Partial<Lead> & Record<string, unknown>): Lead {
  return {
    id: String(row.id || row.phone || row.whatsapp_id || crypto.randomUUID()),
    name: String(row.name || row.full_name || row.client_name || row.profile_name || "Unknown"),
    phone: String(row.phone || row.whatsapp || row.whatsapp_id || row.from || ""),
    status: String(row.status || row.lead_status || "new"),
    score: row.score ? String(row.score) : row.lead_score ? String(row.lead_score) : undefined,
    budget: row.budget ? String(row.budget) : row.price_range ? String(row.price_range) : undefined,
    location_preference: row.location_preference
      ? String(row.location_preference)
      : row.preferred_location
        ? String(row.preferred_location)
        : undefined,
    property_type: row.property_type ? String(row.property_type) : undefined,
    purpose: row.purpose ? String(row.purpose) : undefined,
    follow_up_stage: row.follow_up_stage ? Number(row.follow_up_stage) : undefined,
    last_contacted_at: row.last_contacted_at ? String(row.last_contacted_at) : undefined,
    last_follow_up_at: row.last_follow_up_at ? String(row.last_follow_up_at) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

function normalizeProperty(row: Partial<PropertyRecord> & Record<string, unknown>): PropertyRecord {
  return {
    id: String(row.id || row.title || row.name || crypto.randomUUID()),
    title: String(row.title || row.name || row.property_name || "Untitled property"),
    location_area: row.location_area ? String(row.location_area) : row.area ? String(row.area) : undefined,
    location_city: row.location_city ? String(row.location_city) : row.city ? String(row.city) : undefined,
    price: row.price ? String(row.price) : undefined,
    type: row.type ? String(row.type) : row.property_type ? String(row.property_type) : undefined,
    status: row.status ? String(row.status) : "active",
    drive_photos_link: row.drive_photos_link
      ? String(row.drive_photos_link)
      : row.photos_link
        ? String(row.photos_link)
        : row.image_url
          ? String(row.image_url)
          : undefined,
    drive_brochure_link: row.drive_brochure_link ? String(row.drive_brochure_link) : undefined,
    features: row.features ? String(row.features) : row.title_details ? String(row.title_details) : undefined,
    description: row.description ? String(row.description) : row.brief ? String(row.brief) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function getLeads(limit = 50) {
  const rows = await supabaseFetchWithFallback<Partial<Lead> & Record<string, unknown>>(
    "leads",
    [
      `?select=*&order=updated_at.desc.nullslast&limit=${limit}`,
      `?select=*&order=created_at.desc.nullslast&limit=${limit}`,
      `?select=*&limit=${limit}`,
    ],
    seedLeads,
  );
  return rows.map(normalizeLead);
}

export async function getProperties(limit = 100) {
  const rows = await supabaseFetchWithFallback<Partial<PropertyRecord> & Record<string, unknown>>(
    "properties",
    [
      `?select=*&order=updated_at.desc.nullslast&limit=${limit}`,
      `?select=*&order=created_at.desc.nullslast&limit=${limit}`,
      `?select=*&limit=${limit}`,
    ],
    seedProperties,
  );
  return rows.map(normalizeProperty);
}

export async function getCampaignReports(limit = 25) {
  if (!isSupabaseConfigured()) return seedCampaigns;
  const rows = await supabaseFetchWithFallback<{ id: string; content?: string | Record<string, unknown>; created_at?: string }>(
    "bot_sessions",
    [
      `?select=*&role=eq.whatsapp_campaign_context&order=created_at.desc&limit=${limit}`,
      `?select=*&role=eq.whatsapp_campaign_context&limit=${limit}`,
    ],
    seedCampaigns.map((campaign) => ({ id: campaign.id, content: campaign, created_at: campaign.created_at })),
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

function cleanPhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

async function upsertLeadByPhone(payload: Partial<Lead>) {
  const phone = cleanPhone(String(payload.phone || ""));
  if (!phone) throw new Error("Lead has no phone number.");

  const body = {
    name: payload.name || "Unknown",
    phone,
    status: payload.status || "new",
    score: payload.score || "unscored",
    budget: payload.budget || "",
    location_preference: payload.location_preference || "",
    property_type: payload.property_type || "",
    purpose: payload.purpose || "",
    source: "admin_dashboard_import",
  };

  try {
    return await supabaseFetch<Lead>("leads", "?on_conflict=phone", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    });
  } catch {
    const existing = await supabaseFetch<Lead>("leads", `?select=id&phone=eq.${encodeURIComponent(phone)}&limit=1`);
    if (existing[0]?.id) {
      return supabasePatch<Lead>("leads", `?id=eq.${encodeURIComponent(existing[0].id)}`, body);
    }
    return supabaseFetch<Lead>("leads", "", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

export async function importLeads(leads: Partial<Lead>[]): Promise<LeadImportResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");

  const seen = new Set<string>();
  const result: LeadImportResult = { imported: 0, skipped: 0, errors: [] };

  for (const lead of leads) {
    const phone = cleanPhone(String(lead.phone || ""));
    if (!phone || seen.has(phone)) {
      result.skipped += 1;
      continue;
    }
    seen.add(phone);

    try {
      await upsertLeadByPhone({ ...lead, phone });
      result.imported += 1;
    } catch (error) {
      result.errors.push(`${lead.name || phone}: ${error instanceof Error ? error.message : "Import failed"}`);
    }
  }

  return result;
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

export async function updateProperty(propertyId: string, payload: Partial<PropertyRecord>) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  if (!propertyId) throw new Error("Property ID is missing.");
  return supabasePatch<PropertyRecord>("properties", `?id=eq.${encodeURIComponent(propertyId)}`, {
    title: payload.title || "Untitled property",
    location_area: payload.location_area || "",
    location_city: payload.location_city || "",
    price: payload.price || "",
    type: payload.type || "",
    status: payload.status || "active",
    drive_brochure_link: payload.drive_brochure_link || "",
    features: payload.features || "",
    description: payload.description || "",
  });
}

export async function updatePropertyImageLink(propertyId: string, drivePhotosLink: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  if (!propertyId) throw new Error("Property ID is missing.");
  return supabasePatch<PropertyRecord>("properties", `?id=eq.${encodeURIComponent(propertyId)}`, {
    drive_photos_link: drivePhotosLink,
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
