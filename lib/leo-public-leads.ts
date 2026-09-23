import { createAdminClient } from "@/lib/supabase/admin";

export type LeoPublicLead = {
  id: string;
  session_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  industry: string | null;
  recommended_plan: string | null;
  qualification: Record<string, unknown>;
  notes: string | null;
  source: string;
  status: string;
  handoff_requested: boolean;
  preferred_contact_method: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function getLeoPublicLeads(limit = 100): Promise<LeoPublicLead[]> {
  const supabase = createAdminClient();
  const result = await supabase
    .from("leo_public_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));
  if (result.error) throw result.error;
  return (result.data || []) as LeoPublicLead[];
}

export async function upsertLeoPublicLead(input: {
  sessionId: string;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  companyName?: unknown;
  industry?: unknown;
  recommendedPlan?: unknown;
  qualification?: unknown;
  notes?: unknown;
  status?: unknown;
  handoffRequested?: boolean;
  preferredContactMethod?: unknown;
  metadata?: unknown;
}) {
  const supabase = createAdminClient();
  const sessionId = clean(input.sessionId, 120);
  const email = clean(input.email, 240).toLowerCase();
  const name = clean(input.name, 180);
  if (!sessionId) throw new Error("Public Leo session ID is required.");

  const existing = await supabase
    .from("leo_public_leads")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const current = (existing.data || {}) as Partial<LeoPublicLead>;
  const nextQualification = { ...object(current.qualification), ...object(input.qualification) };
  const nextMetadata = { ...object(current.metadata), ...object(input.metadata) };
  const now = new Date().toISOString();

  const payload = {
    session_id: sessionId,
    full_name: name || current.full_name || "Website visitor",
    email: email || current.email || "",
    phone: clean(input.phone, 80) || current.phone || null,
    company_name: clean(input.companyName, 180) || current.company_name || null,
    industry: clean(input.industry, 140) || current.industry || null,
    recommended_plan: clean(input.recommendedPlan, 80) || current.recommended_plan || null,
    qualification: nextQualification,
    notes: clean(input.notes, 2000) || current.notes || null,
    source: "public_leo",
    status: clean(input.status, 60) || current.status || "new",
    handoff_requested: input.handoffRequested === true || current.handoff_requested === true,
    preferred_contact_method: clean(input.preferredContactMethod, 40) || current.preferred_contact_method || null,
    metadata: nextMetadata,
    updated_at: now,
  };

  const result = existing.data
    ? await supabase.from("leo_public_leads").update(payload).eq("session_id", sessionId).select("*").single()
    : await supabase.from("leo_public_leads").insert({ ...payload, created_at: now }).select("*").single();

  if (result.error) throw result.error;
  return result.data as LeoPublicLead;
}
