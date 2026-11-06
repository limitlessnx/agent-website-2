import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCampaignContacts } from "@/lib/campaign-phone-contacts";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await authorizeXposureTenantAccess("customers.view");
  if (!access.ok) return access.response;
  const { data, error } = await createAdminClient().from("tenant_customer_contacts")
    .select("id,full_name,phone,whatsapp_consent").eq("organization_id", access.organizationId).order("full_name").limit(500);
  if (error) return NextResponse.json({ error: "Unable to load campaign contacts." }, { status: 503 });
  return NextResponse.json({ contacts: data || [] });
}

export async function POST(request: Request) {
  const access = await authorizeXposureTenantAccess("customers.manage");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  let parsed;
  try { parsed = validateCampaignContacts(body?.contacts); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid contacts." }, { status: 400 }); }
  const consent = body.whatsappConsentConfirmed === true;
  const rows = parsed.contacts.map(contact => ({
    organization_id: access.organizationId, full_name: contact.name, phone: contact.phone,
    whatsapp_consent: consent ? "opted_in" : "unknown", email_consent: "unknown", source: "phone_contact_import",
    consent_source: consent ? "campaign_phone_import_confirmation" : null,
    consent_recorded_at: consent ? new Date().toISOString() : null,
  }));
  // Insert only: importing a duplicate must never change an existing opt-out.
  const { data, error } = await createAdminClient().from("tenant_customer_contacts").insert(rows)
    .select("id,full_name,phone,whatsapp_consent");
  if (error?.code === "23505") return NextResponse.json({ error: "A selected phone number already exists. Remove existing contacts from this import and try again. No contacts were changed." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Unable to save campaign contacts." }, { status: 503 });
  return NextResponse.json({ contacts: data || [], imported: data?.length || 0, duplicates: parsed.duplicates }, { status: 201 });
}
