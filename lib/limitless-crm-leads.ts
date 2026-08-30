import { createAdminClient } from "@/lib/supabase/admin";
import type { Lead } from "@/lib/limitless-data";

const LIMITLESS_REALTY_ORGANIZATION_ID = process.env.LIMITLESS_REALTY_ORGANIZATION_ID || "b15f21b4-5697-4d21-9421-8a34eae3476d";

type CrmLeadRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  source?: string | null;
  stage?: string | null;
  score?: string | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CustomerRow = {
  id: string;
  organization_id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function detailsValue(details: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = details?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

export async function getLimitlessCrmLeads(limit = 100): Promise<Lead[]> {
  const admin = createAdminClient();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const { data: leads, error } = await admin
    .from("crm_leads")
    .select("id,organization_id,customer_id,source,stage,score,summary,details,created_at,updated_at")
    .eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
    .order("updated_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;

  const rows = (leads || []) as CrmLeadRow[];
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  const customersById = new Map<string, CustomerRow>();
  if (customerIds.length) {
    const { data: customers, error: customerError } = await admin
      .from("crm_customers")
      .select("id,organization_id,full_name,email,phone,metadata")
      .eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
      .in("id", customerIds);
    if (customerError) throw customerError;
    for (const customer of (customers || []) as CustomerRow[]) customersById.set(customer.id, customer);
  }

  return rows.map((row) => {
    const customer = customersById.get(row.customer_id);
    const details = row.details || {};
    const metadata = customer?.metadata || {};
    return {
      id: row.id,
      name: text(customer?.full_name) || detailsValue(details, "name", "full_name") || "Unknown",
      phone: text(customer?.phone) || detailsValue(details, "phone", "whatsapp", "whatsapp_id") || "",
      status: text(row.stage) || "new",
      score: text(row.score) || undefined,
      budget: detailsValue(details, "budget", "price_range", "budget_range"),
      location_preference: detailsValue(details, "location_preference", "preferred_location", "location"),
      property_type: detailsValue(details, "property_type", "property_interest", "property"),
      purpose: detailsValue(details, "purpose", "buying_purpose"),
      last_contacted_at: detailsValue(details, "last_contacted_at") || row.updated_at || undefined,
      last_follow_up_at: detailsValue(details, "last_follow_up_at"),
      created_at: row.created_at || undefined,
    } satisfies Lead;
  });
}

export async function createLimitlessCrmLead(payload: Partial<Lead> & { email?: string; details?: Record<string, unknown> }) {
  const admin = createAdminClient();
  const name = text(payload.name) || "Unknown";
  const phone = text(payload.phone) || null;
  const email = text(payload.email) || null;

  let customer: CustomerRow | null = null;
  if (phone || email) {
    let query = admin.from("crm_customers").select("id,organization_id,full_name,email,phone,metadata").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).limit(1);
    query = phone ? query.eq("phone", phone) : query.eq("email", email!);
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    customer = result.data as CustomerRow | null;
  }

  if (!customer) {
    const result = await admin.from("crm_customers").insert({
      organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
      full_name: name,
      phone,
      email,
      metadata: { source: "limitless_dashboard" },
    }).select("id,organization_id,full_name,email,phone,metadata").single();
    if (result.error) throw result.error;
    customer = result.data as CustomerRow;
  }

  const existing = await admin.from("crm_leads").select("id").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).eq("customer_id", customer.id).maybeSingle();
  if (existing.error) throw existing.error;
  const details = {
    ...(payload.details || {}),
    ...(payload.budget ? { budget: payload.budget } : {}),
    ...(payload.location_preference ? { location_preference: payload.location_preference } : {}),
    ...(payload.property_type ? { property_type: payload.property_type } : {}),
    ...(payload.purpose ? { purpose: payload.purpose } : {}),
  };
  const leadPayload = {
    organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
    customer_id: customer.id,
    source: "limitless_dashboard",
    stage: text(payload.status) || "new",
    score: text(payload.score) || null,
    summary: null,
    details,
    updated_at: new Date().toISOString(),
  };
  const result = existing.data?.id
    ? await admin.from("crm_leads").update(leadPayload).eq("id", existing.data.id).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).select("id,stage,score,details,created_at,updated_at").single()
    : await admin.from("crm_leads").insert(leadPayload).select("id,stage,score,details,created_at,updated_at").single();
  if (result.error) throw result.error;
  return { customer, lead: result.data };
}
