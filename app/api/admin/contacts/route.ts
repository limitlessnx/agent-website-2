import { NextRequest, NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const CONSENT = new Set(["unknown", "opted_in", "opted_out"]);
function clean(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function dateOnly(value: unknown) {
  const v = clean(value, 10);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v ? v : undefined;
}
function phoneOnly(value: unknown) {
  const raw = clean(value, 50);
  if (!raw) return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return undefined;
  return (plus ? "+" : "") + digits;
}
function contactInput(input: any) {
  const full_name = clean(input?.full_name ?? input?.name, 180);
  const email = clean(input?.email, 240).toLowerCase() || null;
  const phone = phoneOnly(input?.phone);
  const birthday = dateOnly(input?.birthday);
  const anniversary = dateOnly(input?.anniversary);
  const whatsapp_consent = String(input?.whatsapp_consent ?? "unknown");
  const email_consent = String(input?.email_consent ?? "unknown");
  if (!full_name) return { error: "Name is required." };
  if (phone === undefined) return { error: "Phone must contain 7 to 15 digits." };
  if (birthday === undefined || anniversary === undefined) return { error: "Birthday and anniversary must use YYYY-MM-DD." };
  if (!CONSENT.has(whatsapp_consent) || !CONSENT.has(email_consent)) return { error: "Consent must be unknown, opted_in, or opted_out." };
  if (!phone && !email) return { error: "Provide a phone number or email address." };
  return { row: { full_name, email, phone, birthday, anniversary, whatsapp_consent, email_consent,
    consent_source: clean(input?.consent_source, 200) || null,
    consent_recorded_at: (whatsapp_consent === "opted_in" || email_consent === "opted_in" || whatsapp_consent === "opted_out" || email_consent === "opted_out") ? new Date().toISOString() : null,
    tags: Array.isArray(input?.tags) ? input.tags.map((t: unknown) => clean(t, 40)).filter(Boolean).slice(0,30) : [],
    notes: clean(input?.notes, 2000), source: clean(input?.source, 40) || "manual",
    external_key: clean(input?.external_key, 180) || null } };
}
export async function GET(request: NextRequest) {
  const access = await authorizeXposureTenantAccess("customers.view");
  if (!access.ok) return access.response;
  try {
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q"), 100);
    const admin = createAdminClient();
    let query = admin.from("tenant_customer_contacts")
      .select("id,full_name,email,phone,birthday,anniversary,tags,whatsapp_consent,email_consent,consent_source,consent_recorded_at,source,notes,created_at,updated_at")
      .eq("organization_id", access.organizationId).order("full_name", { ascending: true }).limit(500);
    if (q) query = query.ilike("full_name", "%" + q.replace(/[%_,]/g, "") + "%");
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ contacts: data || [], organization: { id: access.organizationId, name: "Xposure Studios" } });
  } catch { return NextResponse.json({ error: "Unable to load tenant contacts." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const access = await authorizeXposureTenantAccess("customers.manage");
  if (!access.ok) return access.response;
  try {
    const body = await request.json();
    const bulk = Array.isArray(body.contacts);
    const inputs = bulk ? body.contacts : [body];
    if (!inputs.length || inputs.length > 500) return NextResponse.json({ error: "Submit between 1 and 500 contacts per request." }, { status: 400 });
    const rows = [];
    const errors: Array<{ index:number; error:string }> = [];
    for (let i=0;i<inputs.length;i++) {
      const parsed = contactInput(inputs[i]);
      if ("error" in parsed) errors.push({ index:i+1, error:parsed.error ?? "Invalid contact." });
      else rows.push({ ...parsed.row, organization_id: access.organizationId });
    }
    if (errors.length) return NextResponse.json({ error: "Some contacts failed validation; no records were saved.", validation_errors: errors.slice(0,100), invalid_count: errors.length }, { status: 400 });
    const admin = createAdminClient();
    // Never overwrite an existing contact's consent during import. Duplicate identities
    // are reported rather than silently changing opt-in/opt-out state.
    const { data, error } = await admin.from("tenant_customer_contacts").insert(rows).select("id,full_name,email,phone,whatsapp_consent,email_consent");
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "A contact with that phone number or email already exists in this organization. Review duplicates before importing.", code: "duplicate_contact" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ created: data?.length || 0, contacts: data || [] }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to save tenant contacts." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  const access = await authorizeXposureTenantAccess("customers.manage");
  if (!access.ok) return access.response;
  try {
    const body = await request.json();
    const id = clean(body.id, 80);
    if (!id) return NextResponse.json({ error: "Contact id is required." }, { status: 400 });
    const update: Record<string, unknown> = {};
    for (const field of ["whatsapp_consent", "email_consent"] as const) {
      if (body[field] !== undefined) {
        if (!CONSENT.has(String(body[field]))) return NextResponse.json({ error: "Invalid consent value." }, { status: 400 });
        update[field] = body[field];
      }
    }
    if (body.consent_source !== undefined) update.consent_source = clean(body.consent_source, 200) || null;
    if (!Object.keys(update).length) return NextResponse.json({ error: "No supported changes supplied." }, { status: 400 });
    update.consent_recorded_at = new Date().toISOString();
    update.updated_at = new Date().toISOString();
    const admin = createAdminClient();
    const { data, error } = await admin.from("tenant_customer_contacts").update(update)
      .eq("organization_id", access.organizationId).eq("id", id)
      .select("id,full_name,whatsapp_consent,email_consent,consent_source,consent_recorded_at").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Contact not found in this organization." }, { status: 404 });
    return NextResponse.json({ contact: data });
  } catch { return NextResponse.json({ error: "Unable to update contact consent." }, { status: 500 }); }
}
