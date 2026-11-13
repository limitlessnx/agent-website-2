import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSupabaseConfig } from "@/lib/supabase-server-rest";
import { CampaignTemplateError, loadAssignedPromotion } from "@/lib/portal-campaign-templates";
import { normalizeTemplateParameter } from "@/lib/whatsapp-message-normalizer";
import { mapPromotionMessage, renderPromotionMessage } from "@/lib/whatsapp-promotion-message";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export type PromotionRequest = {
  action?: unknown;
  message?: unknown;
  whatsappConsentConfirmed?: unknown;
  reviewFingerprint?: unknown;
  campaignId?: unknown;
};

const error = (message: string, status: number) => ({ body: { error: message }, status });
const phoneKey = (value: string | null) => value?.replace(/^\+/, "") || "";
const MAX_AUDIENCE = 500;

export async function runPortalPromotion(
  admin: ReturnType<typeof createAdminClient>,
  session: ClientSession,
  body: PromotionRequest,
  contactIds: string[],
) {
  const { organizationId, userId } = session;
  const review = body.action === "review";
  if (!review && body.action !== "send") return error("Review the campaign before sending.", 400);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!contactIds.length || contactIds.length > MAX_AUDIENCE || contactIds.some(id => !uuid.test(id))) {
    return error("Select between 1 and 500 eligible contacts.", 400);
  }
  if (body.whatsappConsentConfirmed !== true) return error("Confirm WhatsApp marketing consent for the selected contacts.", 400);
  const campaignId = review ? randomUUID() : body.campaignId;
  if (typeof campaignId !== "string" || !uuid.test(campaignId)) return error("Review the campaign before sending.", 400);

  let template;
  try {
    template = await loadAssignedPromotion(organizationId);
  } catch (reason) {
    return reason instanceof CampaignTemplateError ? error(reason.message, reason.status) : error("Unable to verify the WhatsApp promotion. Try again later.", 503);
  }
  const mapped = mapPromotionMessage(template, body.message);
  if (!mapped.values) return error(mapped.error, 400);
  const { values } = mapped;

  const contacts = await admin.from("tenant_customer_contacts").select("id,full_name,phone,whatsapp_consent")
    .eq("organization_id", organizationId).in("id", contactIds);
  if (contacts.error) return error("Unable to verify the selected contacts.", 503);
  const contactsById = new Map((contacts.data || []).map(contact => [contact.id, contact]));
  const recipients = [];
  const seen = new Set<string>();
  for (const id of contactIds) {
    const contact = contactsById.get(id);
    const phone = phoneKey(contact?.phone || null);
    if (!contact || contact.whatsapp_consent !== "opted_in" || !/^[1-9]\d{7,14}$/.test(phone)) {
      return error("One or more selected contacts no longer have a valid WhatsApp number or recorded marketing permission. Refresh the audience and select again.", 409);
    }
    if (seen.has(phone)) return error("More than one selected contact has the same WhatsApp number. Select one per number.", 409);
    seen.add(phone);
    const variables = { ...values };
    if (template.variable_keys.includes("customer_name")) {
      try { variables.customer_name = normalizeTemplateParameter(contact.full_name, { maxLength: 1024 }); }
      catch { return error("A selected contact is missing a valid name. Update the contact and review again.", 409); }
    }
    recipients.push({ id, phone, variables, name: contact.full_name });
  }
  // Stored numbers can be represented with or without a leading plus.
  async function readConsent(phones: string[]) {
    return admin.from("tenant_customer_contacts").select("id,phone,whatsapp_consent")
      .eq("organization_id", organizationId).in("phone", phones.flatMap(phone => [phone, `+${phone}`]));
  }
  const phoneRows = new Map<string, Array<{ id: string; whatsapp_consent: string }>>();
  const numbers = [...seen];
  for (let start = 0; start < numbers.length; start += 100) {
    const consent = await readConsent(numbers.slice(start, start + 100));
    if (consent.error) return error("Unable to verify WhatsApp marketing permission. Try again.", 503);
    for (const row of consent.data || []) {
      const phone = phoneKey(row.phone);
      phoneRows.set(phone, [...(phoneRows.get(phone) || []), row]);
    }
  }
  if (recipients.some(({ id, phone }) => {
    const rows = phoneRows.get(phone);
    return !rows?.some(row => row.id === id) || rows.some(row => row.whatsapp_consent !== "opted_in");
  })) return error("A selected WhatsApp number has withdrawn, missing, or conflicting marketing permission. Refresh the audience and select again.", 409);

  const reviewFingerprint = createHmac("sha256", getServerSupabaseConfig().key).update(JSON.stringify({
    campaignId, organizationId, userId, template, recipients,
  })).digest("hex");
  if (review) {
    const sample = recipients[0];
    return { body: {
      campaignId, reviewFingerprint, recipientCount: recipients.length, sampleName: sample.name,
      message: renderPromotionMessage(template, sample.variables),
      header: template.header, footer: template.footer, buttonLabels: template.buttonLabels,
    }, status: 200 };
  }
  if (typeof body.reviewFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(body.reviewFingerprint) ||
      !timingSafeEqual(Buffer.from(body.reviewFingerprint, "hex"), Buffer.from(reviewFingerprint, "hex"))) {
    return error("The promotion or audience changed. Review the campaign again before sending.", 409);
  }

  const audit = await admin.from("audit_logs").insert({
    id: campaignId,
    organization_id: organizationId,
    actor_user_id: userId,
    action: "campaign.whatsapp_marketing_consent_confirmed",
    resource_type: "whatsapp_campaign",
    resource_id: campaignId,
    metadata: {
      confirmed: true, confirmation_version: 1, recipient_contact_ids: contactIds,
      template_name: template.name, template_language: template.language, review_fingerprint: reviewFingerprint,
    },
  });
  if (audit.error?.code === "23505") return error("This campaign was already submitted. Check delivery records before sending again.", 409);
  if (audit.error) return error("Unable to record the consent confirmation. No messages were sent.", 503);

  const results: Array<{ customerId: string; status: "accepted" | "unknown" | "skipped" }> = [];
  for (const { id, phone, variables } of recipients) {
    const consent = await readConsent([phone]);
    const rows = consent.data || [];
    if (consent.error || !rows.some(row => row.id === id) || rows.some(row => row.whatsapp_consent !== "opted_in")) {
      results.push({ customerId: id, status: "skipped" });
      continue;
    }
    try {
      const delivery = await sendWhatsAppMessage({
        organizationId, to: phone, deliveryMode: "template",
        templatePurpose: "campaign_promotion", requestedTemplateName: template.name,
        requestedTemplateLanguage: template.language, expectedMetaVariableKeys: template.variable_keys, variables,
      });
      results.push({ customerId: id, status: delivery?.providerMessageId ? "accepted" : "unknown" });
    } catch {
      results.push({ customerId: id, status: "unknown" });
    }
  }
  const accepted = results.filter(result => result.status === "accepted").length;
  const unknown = results.filter(result => result.status === "unknown").length;
  return { body: { ok: accepted > 0, campaignId, accepted, unknown, failed: 0, skipped: results.length - accepted - unknown, results }, status: 200 };
}
