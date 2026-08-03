import type { Lead } from "@/lib/limitless-data";

export type ProgressiveLead = Lead & {
  profile_status?: "undocumented" | "partial" | "documented";
  campaign_eligible?: boolean;
  property_interest?: string;
  email?: string;
  notes?: string;
};

export type ProgressiveLeadInput = Partial<ProgressiveLead> & {
  name: string;
  phone: string;
  source?: string;
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

  if (!url || !key) {
    throw new Error("Limitless Supabase service-role configuration is missing.");
  }

  return { url, key };
}

async function request<T>(table: string, query = "", init?: RequestInit): Promise<T[]> {
  const { url, key } = config();
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
    const error = new Error(`Supabase ${table} request failed: ${response.status} ${detail}`);
    Object.assign(error, { status: response.status, detail });
    throw error;
  }

  if (response.status === 204) return [];
  return (await response.json()) as T[];
}

export function normalizeLeadPhone(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("2340") && digits.length >= 14) digits = `234${digits.slice(4)}`;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  if (digits.startsWith("234") && digits.length >= 13) return digits.slice(0, 13);
  return digits;
}

export function inferProfileStatus(input: Partial<ProgressiveLead>): ProgressiveLead["profile_status"] {
  const details = [
    input.budget,
    input.location_preference,
    input.property_type,
    input.property_interest,
    input.purpose,
    input.email,
  ].filter((value) => String(value || "").trim());

  if (details.length === 0) return "undocumented";
  if (details.length < 4) return "partial";
  return "documented";
}

function optional(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function buildPayload(input: ProgressiveLeadInput) {
  const phone = normalizeLeadPhone(input.phone);
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Lead name is required.");
  if (!phone) throw new Error("Lead phone number is required.");

  return Object.fromEntries(
    Object.entries({
      name,
      phone,
      status: optional(input.status) || "new",
      score: optional(input.score),
      budget: optional(input.budget),
      location_preference: optional(input.location_preference),
      property_type: optional(input.property_type),
      property_interest: optional(input.property_interest),
      purpose: optional(input.purpose),
      email: optional(input.email),
      notes: optional(input.notes),
      source: optional(input.source) || "admin_dashboard",
      profile_status: input.profile_status || inferProfileStatus(input),
      campaign_eligible: input.campaign_eligible !== false,
    }).filter(([, value]) => value !== undefined),
  );
}

function missingColumn(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  const patterns = [
    /Could not find the ['\"]([^'\"]+)['\"] column/i,
    /column ['\"]?([^'\"\s]+)['\"]? of relation .* does not exist/i,
    /column .*\.([^\s]+) does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/["']/g, "");
  }
  return null;
}

async function adaptiveWrite<T>(
  table: string,
  query: string,
  method: "POST" | "PATCH",
  initialPayload: Record<string, unknown>,
  prefer?: string,
) {
  const payload = { ...initialPayload };
  const protectedFields = new Set(["name", "phone"]);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      return await request<T>(table, query, {
        method,
        headers: prefer ? { Prefer: prefer } : undefined,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const column = missingColumn(error);
      if (!column || protectedFields.has(column) || !(column in payload)) throw error;
      delete payload[column];
    }
  }

  throw new Error(`Unable to save ${table} after removing unsupported optional fields.`);
}

export async function saveProgressiveLead(input: ProgressiveLeadInput) {
  const payload = buildPayload(input);
  const phone = String(payload.phone);

  try {
    return await adaptiveWrite<ProgressiveLead>(
      "leads",
      "?on_conflict=phone",
      "POST",
      payload,
      "resolution=merge-duplicates,return=representation",
    );
  } catch {
    const existing = await request<{ id: string }>(
      "leads",
      `?select=id&phone=eq.${encodeURIComponent(phone)}&limit=1`,
    ).catch(() => []);

    if (existing[0]?.id) {
      return adaptiveWrite<ProgressiveLead>(
        "leads",
        `?id=eq.${encodeURIComponent(existing[0].id)}`,
        "PATCH",
        payload,
      );
    }

    return adaptiveWrite<ProgressiveLead>("leads", "", "POST", payload);
  }
}

export async function updateProgressiveLead(id: string, input: ProgressiveLeadInput) {
  if (!id) throw new Error("Lead ID is required.");
  const payload = buildPayload(input);
  return adaptiveWrite<ProgressiveLead>(
    "leads",
    `?id=eq.${encodeURIComponent(id)}`,
    "PATCH",
    payload,
  );
}

export async function deleteProgressiveLead(id: string) {
  if (!id) throw new Error("Lead ID is required.");
  return request<ProgressiveLead>(
    "leads",
    `?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    },
  );
}

export async function importProgressiveLeads(inputs: ProgressiveLeadInput[]) {
  const result = { imported: 0, skipped: 0, errors: [] as string[] };
  const seen = new Set<string>();

  for (const input of inputs) {
    const phone = normalizeLeadPhone(input.phone || "");
    if (!phone || !String(input.name || "").trim() || seen.has(phone)) {
      result.skipped += 1;
      continue;
    }
    seen.add(phone);

    try {
      await saveProgressiveLead({ ...input, phone, source: input.source || "admin_dashboard_import" });
      result.imported += 1;
    } catch (error) {
      result.errors.push(`${input.name || phone}: ${error instanceof Error ? error.message : "Save failed"}`);
    }
  }

  return result;
}

export async function getCampaignAudienceLeads(limit = 5000): Promise<ProgressiveLead[]> {
  const rows = await request<Record<string, unknown>>(
    "leads",
    `?select=*&order=created_at.desc.nullslast&limit=${Math.max(1, Math.min(limit, 10000))}`,
  );

  return rows.map((row) => {
    const lead = row as Partial<ProgressiveLead> & Record<string, unknown>;
    return {
      id: String(lead.id || lead.phone || crypto.randomUUID()),
      name: String(lead.name || lead.full_name || lead.client_name || "Unknown"),
      phone: normalizeLeadPhone(String(lead.phone || lead.whatsapp || lead.whatsapp_id || "")),
      status: String(lead.status || lead.lead_status || "new"),
      score: optional(lead.score || lead.lead_score),
      budget: optional(lead.budget || lead.price_range),
      location_preference: optional(lead.location_preference || lead.preferred_location || lead.state),
      property_type: optional(lead.property_type),
      property_interest: optional(lead.property_interest || lead.interested_property || lead.property_name),
      purpose: optional(lead.purpose || lead.interest),
      email: optional(lead.email),
      notes: optional(lead.notes),
      profile_status: (optional(lead.profile_status) as ProgressiveLead["profile_status"]) || inferProfileStatus(lead),
      campaign_eligible: lead.campaign_eligible !== false,
      created_at: optional(lead.created_at),
    };
  });
}

export async function saveCampaignReport(content: Record<string, unknown>) {
  return request("bot_sessions", "", {
    method: "POST",
    body: JSON.stringify({
      role: "whatsapp_campaign_context",
      content,
    }),
  }).catch((error) => {
    console.error("Unable to save campaign report.", error);
    return [];
  });
}
