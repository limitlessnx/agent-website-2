import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { isHotelOrganization, hotelCampaignSuppression } from "@/lib/hotel-communication-policy";
import { loadHotelAudience, hotelConversationState } from "@/lib/hotel-communications";
import { runPortalPromotion, type PromotionRequest } from "@/lib/portal-whatsapp-promotion";
import { CampaignTemplateError, loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = PromotionRequest & { templateName?: string; templatePurpose?: string; languageCode?: string; customerIds?: string[]; contactIds?: string[]; variables?: Record<string, string> };

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
  const admin = createAdminClient();
  const organization = await admin.from("organizations").select("status,metadata,slug").eq("id", session.organizationId).single();
  if (organization.error || organization.data?.status !== "active") return NextResponse.json({ error: "Organization is unavailable." }, { status: 409 });
  let hotel = isHotelOrganization(organization.data);
  if (!hotel) {
    const profile = await admin.from("client_onboarding_profiles").select("industry").eq("organization_id", session.organizationId).maybeSingle();
    if (profile.error) return NextResponse.json({ error: "Organization industry is unavailable." }, { status: 503 });
    hotel = isHotelOrganization({ metadata: { industry: profile.data?.industry } });
  }
  // Every non-hotel tenant inherits the reviewed campaign workflow. No slug
  // allowlist or new installation is needed, and the old direct bulk path
  // cannot bypass consent checks for future organizations.
  if (!hotel) {
    try {
      await requirePortalPermission(session, ["customers.view"]);
      await requirePortalPermission(session, ["customers.manage"]);
    } catch { return NextResponse.json({ error: "You do not have permission to use campaign contacts." }, { status: 403 }); }
    if (customerIds.length || body.templateName || body.templatePurpose || body.languageCode || body.variables) {
      return NextResponse.json({ error: "Select consented campaign contacts and review the approved marketing template." }, { status: 400 });
    }
    const result = await runPortalPromotion(admin, session, body, contactIds);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  }
  if (contactIds.length || body.action !== undefined || body.campaignTemplate !== undefined) return NextResponse.json({ error: "Hotel campaigns must use the guest campaign workflow." }, { status: 403 });
  if (!templateName || !customerIds.length || customerIds.length > 500) return NextResponse.json({ error: "Choose an approved template and between 1 and 500 recipients." }, { status: 400 });
  if (!/^[a-z0-9_:-]{2,80}$/i.test(templatePurpose)) return NextResponse.json({ error: "The template purpose is invalid." }, { status: 400 });
  if (hotel && !body.templatePurpose) templatePurpose = "hotel_campaign";
  if (hotel && templatePurpose !== "hotel_campaign") return NextResponse.json({ error: "Hotel campaigns require a hotel_campaign template." }, { status: 400 });
  let selectedTemplate;
  try {
    const { templates } = await loadLinkedCampaignTemplates(session.organizationId, true, [templatePurpose]);
    const matches = templates.filter(item => item.name === templateName && item.purpose === templatePurpose && item.category === "MARKETING"
      && (!body.languageCode || item.language === body.languageCode));
    if (matches.length !== 1) return NextResponse.json({ error: "Select a unique approved marketing template and language." }, { status: 409 });
    selectedTemplate = matches[0];
    const bodies = selectedTemplate.components.filter(component => component.type === "BODY");
    const staticText = (value?: string) => !value?.includes("{{");
    const keys = selectedTemplate.variable_keys;
    const indexes = [...(bodies[0]?.text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(match => Number(match[1]));
    if (bodies.length !== 1 || !bodies[0].text?.trim() || indexes.length !== keys.length
      || indexes.some((value, index) => value !== index + 1) || new Set(keys).size !== keys.length
      || keys.some(key => !/^[a-z][a-z0-9_]*$/.test(key))
      || !staticText(bodies[0].text.replace(/\{\{\s*\d+\s*\}\}/g, ""))
      || selectedTemplate.components.some(component => !["BODY", "HEADER", "FOOTER", "BUTTONS"].includes(component.type || "")
        || (component.type === "HEADER" && (component.format !== "TEXT" || !staticText(component.text)))
        || (component.type === "FOOTER" && !staticText(component.text))
        || (component.type === "BUTTONS" && (component.buttons || []).some(button => !["URL", "PHONE_NUMBER", "QUICK_REPLY"].includes(button.type || "") || !staticText(button.url) || !staticText(button.text))))) {
      return NextResponse.json({ error: "This template has unsupported or mismatched components. Review its mapping before sending." }, { status: 409 });
    }
    if (keys.some((key, index) => key !== "customer_name" && !String(body.variables?.[key] ?? body.variables?.[String(index + 1)] ?? "").trim())) {
      return NextResponse.json({ error: "Fill all required template variables before sending." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof CampaignTemplateError ? error.message : "Unable to verify the approved campaign template." }, { status: error instanceof CampaignTemplateError ? error.status : 503 });
  }
  const { data: crmCustomers, error: customerError } = await admin
    .from("crm_customers")
    .select("id,full_name,phone")
    .eq("organization_id", session.organizationId)
    .in("id", customerIds);
  if (customerError) return NextResponse.json({ error: "Unable to load the selected clients." }, { status: 500 });
  const customers = [...(crmCustomers || [])];
  let accepted = 0; let failed = 0; let unknown = 0; const results: Array<{ customerId: string; status: string; error?: string }> = [];
  for (const customer of customers || []) {
    if (!customer.phone) { results.push({ customerId: String(customer.id), status: "skipped", error: "Client has no phone number." }); continue; }
    let submissionStarted = false;
    try {
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
        requestedTemplateLanguage: selectedTemplate.language,
        expectedMetaVariableKeys: selectedTemplate.variable_keys,
        variables: Object.fromEntries(selectedTemplate.variable_keys.map((key, index) => [key, key === "customer_name" ? customer.full_name || "" : body.variables?.[key] ?? body.variables?.[String(index + 1)]])),
      });
      if (!delivery?.providerMessageId) {
        unknown += 1;
        results.push({ customerId: String(customer.id), status: "unknown", error: "No provider receipt was returned. Reconcile this attempt before sending again." });
        continue;
      }
      accepted += 1;
      results.push({ customerId: String(customer.id), status: "accepted" });
    } catch (error) {
      if (submissionStarted) {
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
