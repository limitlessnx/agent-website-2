import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { isHotelOrganization, hotelCampaignSuppression } from "@/lib/hotel-communication-policy";
import { loadHotelAudience, hotelConversationState } from "@/lib/hotel-communications";
import { loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { templateName?: string; templatePurpose?: string; languageCode?: string; customerIds?: string[]; contactIds?: string[]; variables?: Record<string, string> };

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await requirePortalPermission(session, ["conversations.reply"]); } catch { return NextResponse.json({ error: "You do not have permission to send campaigns." }, { status: 403 }); }
  try { await assertFluxFeatureAccess(session.organizationId, "follow_ups"); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign sending is not included in this plan." }, { status: 409 }); }
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: "Provide a campaign request." }, { status: 400 });
  const body = raw as Body;
  const templateName = String(body.templateName || "").trim();
  let templatePurpose = String(body.templatePurpose || "campaign").trim();
  const customerIds = Array.isArray(body.customerIds) ? [...new Set(body.customerIds.map(String).filter(Boolean))] : [];
  const contactIds = Array.isArray(body.contactIds) ? [...new Set(body.contactIds.map(String).filter(Boolean))] : [];
  if (!templateName || !customerIds.length && !contactIds.length || customerIds.length + contactIds.length > 500) return NextResponse.json({ error: "Choose an approved template and between 1 and 500 recipients." }, { status: 400 });
  if (!/^[a-z0-9_:-]{2,80}$/i.test(templatePurpose)) return NextResponse.json({ error: "The template purpose is invalid." }, { status: 400 });
  const admin = createAdminClient();
  const organization = await admin.from("organizations").select("status,metadata,slug").eq("id", session.organizationId).single();
  if (organization.error || organization.data?.status !== "active") return NextResponse.json({ error: "Organization is unavailable." }, { status: 409 });
  const xposure = organization.data.slug === "xposure";
  if (contactIds.length && !xposure) return NextResponse.json({ error: "Contact audiences are available only in Xposure." }, { status: 403 });
  let variableKeys: string[] = [];
  if (xposure) {
    try { await requirePortalPermission(session, ["customers.view", "customers.manage"]); }
    catch { return NextResponse.json({ error: "You do not have permission to use campaign contacts." }, { status: 403 }); }
    try {
      const inventory = await loadLinkedCampaignTemplates(session.organizationId);
      const selected = inventory.templates.find(item => item.name === templateName && item.language === body.languageCode && item.purpose === templatePurpose && ["campaign", "customer_follow_up", "campaign_promotion"].includes(item.purpose));
      if (!selected) return NextResponse.json({ error: "Choose a linked, provider-approved campaign template and its language." }, { status: 409 });
      variableKeys = selected.variable_keys;
    } catch { return NextResponse.json({ error: "Unable to verify template approval. No messages were sent." }, { status: 503 }); }
    if (variableKeys.some((key, index) => {
      if (key === "customer_name") return false;
      const value = body.variables?.[key] ?? body.variables?.[String(index + 1)];
      return typeof value !== "string" || !value.trim() || value.length > 1024;
    })) return NextResponse.json({ error: "Complete every template value before sending." }, { status: 400 });
  }
  let hotel = isHotelOrganization(organization.data);
  if (!hotel) {
    const profile = await admin.from("client_onboarding_profiles").select("industry").eq("organization_id", session.organizationId).maybeSingle();
    if (profile.error) return NextResponse.json({ error: "Organization industry is unavailable." }, { status: 503 });
    hotel = isHotelOrganization({ metadata: { industry: profile.data?.industry } });
  }
  if (hotel && !body.templatePurpose) templatePurpose = "hotel_campaign";
  if (hotel && templatePurpose !== "hotel_campaign") return NextResponse.json({ error: "Hotel campaigns require a hotel_campaign template." }, { status: 400 });
  const { data: crmCustomers, error: customerError } = await admin
    .from("crm_customers")
    .select("id,full_name,phone")
    .eq("organization_id", session.organizationId)
    .in("id", customerIds);
  if (customerError) return NextResponse.json({ error: "Unable to load the selected clients." }, { status: 500 });
  const customers = [...(crmCustomers || [])];
  if (contactIds.length) {
    const contacts = await admin.from("tenant_customer_contacts").select("id,full_name,phone").eq("organization_id", session.organizationId).in("id", contactIds);
    if (contacts.error) return NextResponse.json({ error: "Unable to load selected contacts." }, { status: 503 });
    customers.push(...(contacts.data || []));
  }
  const phones = new Set<string>();
  let accepted = 0; let failed = 0; let unknown = 0; const results: Array<{ customerId: string; status: string; error?: string }> = [];
  for (const customer of customers || []) {
    if (!customer.phone) { results.push({ customerId: String(customer.id), status: "skipped", error: "Client has no phone number." }); continue; }
    let submissionStarted = false;
    try {
      if (xposure) {
        // Re-read consent immediately before dispatch; imported contacts never inherit consent from CRM presence.
        const consent = await admin.from("tenant_customer_contacts").select("whatsapp_consent").eq("organization_id", session.organizationId).eq("phone", customer.phone).maybeSingle();
        const phone = String(customer.phone).replace(/\D/g, "");
        if (consent.error || consent.data?.whatsapp_consent !== "opted_in" || phones.has(phone)) {
          results.push({ customerId: String(customer.id), status: "skipped", error: "WhatsApp marketing permission is missing, unavailable, or this phone is already selected." });
          continue;
        }
        phones.add(phone);
      }
      if (hotel) {
        // Re-read consent and booking state for each recipient at dispatch, including manual audiences.
        const audience = await loadHotelAudience(session.organizationId, [String(customer.id)]);
        const reason = hotelCampaignSuppression(session.organizationId, audience.guests[0] || null, audience.bookings);
        const conversation = await hotelConversationState(session.organizationId, String(customer.id));
        if (reason || conversation.handoff) {
          results.push({ customerId: String(customer.id), status: "skipped", error: reason || "human_handoff" });
          continue;
        }
      }
      submissionStarted = true;
      const delivery = await sendWhatsAppMessage({
        organizationId: session.organizationId,
        to: customer.phone,
        text: String(body.variables?.message || "Campaign message"),
        deliveryMode: "template",
        forceTemplate: true,
        requireProviderApproval: hotel,
        templatePurpose,
        requestedTemplateName: templateName,
        ...(hotel && body.languageCode ? { requestedTemplateLanguage: String(body.languageCode) } : {}),
        variables: xposure
          ? Object.fromEntries(variableKeys.map((key, index) => [key, key === "customer_name" ? customer.full_name || "" : body.variables?.[key] ?? body.variables?.[String(index + 1)] ?? ""]))
          : { customer_name: customer.full_name || "", ...(body.variables || {}) },
      });
      if ((xposure || hotel) && !delivery?.providerMessageId) {
        unknown += 1;
        results.push({ customerId: String(customer.id), status: "unknown", error: "No provider receipt was returned. Reconcile this attempt before sending again." });
        continue;
      }
      accepted += 1;
      results.push({ customerId: String(customer.id), status: "accepted" });
    } catch (error) {
      if ((xposure || hotel) && submissionStarted) {
        unknown += 1;
        results.push({ customerId: String(customer.id), status: "unknown", error: "Provider submission was not confirmed. Check delivery records before sending again." });
        continue;
      }
      failed += 1;
      results.push({ customerId: String(customer.id), status: "failed", error: error instanceof Error ? error.message : "WhatsApp delivery failed." });
    }
  }
  return NextResponse.json({ ok: accepted > 0, templateName, templatePurpose, attempted: (customers || []).length, accepted, failed, unknown, skipped: results.filter(result => result.status === "skipped").length, results });
}
