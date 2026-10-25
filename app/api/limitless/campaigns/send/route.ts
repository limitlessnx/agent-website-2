import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createLeoActionApproval, consumeLeoActionApproval } from "@/lib/leo-action-approval";
import { campaignApprovalArguments, campaignApprovalIdentity, campaignApprovalSessionId, REAL_ESTATE_CAMPAIGN_SEND_TOOL } from "@/lib/real-estate-campaign-approval";
import { getRealEstateCampaignGroup, matchesRealEstateCampaignGroupRules } from "@/lib/real-estate-campaign-groups";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads, normalizeLeadPhone, type ProgressiveLead } from "@/lib/lead-profile-service";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { saveCampaignDeliveryReport } from "@/lib/campaign-report-store";
import { splitWhatsAppMessage } from "@/lib/whatsapp-message-splitter";
import { buildPropertyCampaignContent, PropertyCampaignMessageError } from "@/lib/property-campaign-message";
import { getMetaCooldownPhones } from "@/lib/whatsapp-status-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimOutboundTracking, updateOutboundTracking } from "@/lib/real-estate-campaign-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CampaignType = "limitless_realty_update";
type RequestBody = {
  requestId?: string;
  approvalStage?: "prepare" | "send";
  approvalId?: string;
  approvalToken?: string;
  campaignType?: CampaignType;
  topic?: string;
  message?: string;
  mediaUrl?: string;
  audienceMode?: "all" | "manual" | "group" | "filters";
  selectedLeadIds?: string[];
  campaignGroupId?: string;
  state?: string;
  interest?: string;
  propertyId?: string;
  budgetMin?: number | string;
  budgetMax?: number | string;
};
const campaignTemplates = { limitless_realty_update: "limitless_realty_update_v2" } as const;
function campaignLabel(type: CampaignType) { return type === "limitless_realty_update" ? "Limitless Realty Update" : "Campaign"; }
function text(value: unknown) { return String(value ?? "").trim().toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function isContactable(lead: ProgressiveLead, organizationId: string) { const status = text(lead.status); return Boolean(String(lead.id || "").trim() && lead.organization_id === organizationId && lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }
function noStore(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } }); }
function requestIdentifier(value: unknown) { const id = String(value || "").trim(); return id.length > 0 && id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id) ? id : ""; }
function perRecipientStatus(recipient: Record<string, unknown>, hasProviderId: boolean): "accepted" | "sent" | "delivered" | "read" | "failed" | "unknown" {
  const status = text(recipient.deliveryStatus || recipient.delivery_status || recipient.status);
  if (["accepted", "sent", "delivered", "read", "failed"].includes(status)) return status as "accepted" | "sent" | "delivered" | "read" | "failed";
  return hasProviderId ? "accepted" : "unknown";
}
function maskedRecipientPreview(recipients: ProgressiveLead[]) {
  return recipients.slice(0, 20).map((lead) => ({ name: String(lead.name || "Client").slice(0, 80), phone: `••••${normalizeLeadPhone(lead.phone).slice(-4)}` }));
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return noStore({ error: "Unauthorized" }, 401);
  let organizationId = "";
  let requestId = "";
  let trackingAdmin: ReturnType<typeof createAdminClient> | null = null;
  let parentIdempotencyKey = "";
  try {
    const scope = await resolveAdminOrganizationScope();
    organizationId = scope.organizationId;
    const body = await request.json().catch(() => ({})) as RequestBody;
    requestId = requestIdentifier(body.requestId);
    if (!requestId) return noStore({ error: "A valid campaign request ID is required." }, 400);
    if (body.approvalStage !== "prepare" && body.approvalStage !== "send") return noStore({ error: "Campaigns require a preview stage followed by an explicit confirmation stage." }, 400);
    if (body.campaignType && !Object.prototype.hasOwnProperty.call(campaignTemplates, body.campaignType)) return noStore({ error: "Unsupported campaign type." }, 400);
    if (String(body.mediaUrl || "").trim()) return noStore({ error: "Media attachments are not enabled by the verified campaign template." }, 400);

    const originalMessage = String(body.message || "").trim();
    const [allLeads, properties] = await Promise.all([
      getCampaignAudienceLeads(organizationId, 10000),
      getProperties(500, organizationId),
    ]);
    // The legacy data helper has development fixtures. They are never valid send targets.
    const scopedProperties = properties.filter((property) => property.organization_id === organizationId);
    const selectedIds = new Set((body.selectedLeadIds || []).map(String));
    const campaignGroup = body.campaignGroupId ? await getRealEstateCampaignGroup(organizationId, String(body.campaignGroupId)) : null;
    if (body.campaignGroupId && !campaignGroup) return noStore({ error: "Campaign group not found in this organization." }, 404);
    const groupLeadIds = new Set(campaignGroup?.leadIds || []);
    const campaignType: CampaignType = body.campaignType || "limitless_realty_update";
    const templateName = campaignTemplates[campaignType];
    const selectedProperty = scopedProperties.find((property) => property.id === body.propertyId);
    if (body.propertyId && !selectedProperty) return noStore({ error: "The selected property is not available in this organization." }, 404);
    const propertyCampaign = selectedProperty ? buildPropertyCampaignContent(selectedProperty, originalMessage, String(body.mediaUrl || "")) : null;
    const message = propertyCampaign?.message || originalMessage;
    const topic = String(body.topic || (propertyCampaign ? `${propertyCampaign.propertyName} property update` : "WhatsApp campaign")).trim();
    if (!message) return noStore({ error: "Campaign message is required." }, 400);
    const messageParts = campaignType === "limitless_realty_update" ? [message] : splitWhatsAppMessage(message);
    if (!messageParts.length) return noStore({ error: "Campaign message is required." }, 400);

    const state = text(body.state);
    const interest = text(body.interest);
    const propertyNeedle = text(selectedProperty?.title || body.propertyId);
    const budgetMin = money(body.budgetMin);
    const budgetMax = money(body.budgetMax);
    const mode = body.audienceMode || "all";
    const matchedRecipients = allLeads.filter((lead) => {
      if (!isContactable(lead, organizationId)) return false;
      if (mode === "manual") return selectedIds.has(String(lead.id));
      if (mode === "group") {
        if (!campaignGroup) return false;
        return campaignGroup.groupType === "smart" ? matchesRealEstateCampaignGroupRules(lead, campaignGroup.rules) : groupLeadIds.has(String(lead.id));
      }
      if (mode === "all") return true;
      if (state && !text(lead.location_preference).includes(state)) return false;
      if (interest && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interest)) return false;
      if (propertyNeedle && ![lead.property_interest, lead.property_type, lead.purpose].map(text).join(" ").includes(propertyNeedle)) return false;
      const budget = money(lead.budget);
      if (budgetMin && (!budget || budget < budgetMin)) return false;
      if (budgetMax && (!budget || budget > budgetMax)) return false;
      return true;
    });
    const cooldowns = await getMetaCooldownPhones(matchedRecipients.map((lead) => lead.phone), 24);
    const recipients = matchedRecipients.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone)));
    const cooldownSkipped = matchedRecipients.length - recipients.length;
    if (!recipients.length) return noStore({ error: cooldownSkipped ? "All matched leads are currently in WhatsApp cooldown after Meta delivery blocks. Wait before retrying or ask the contact to message Maia first." : "No campaign-eligible leads matched this audience.", skipped: cooldownSkipped, cooldownSkipped }, 400);

    const approvalArguments = campaignApprovalArguments({
      organizationId,
      requestId,
      campaignType,
      topic,
      message,
      messageParts,
      templateName,
      mediaUrl: String(body.mediaUrl || "").trim() || null,
      audienceMode: mode,
      selectedLeadIds: [...selectedIds],
      campaignGroup,
      property: selectedProperty || null,
      recipients,
      skipped: cooldownSkipped,
    });
    const identity = campaignApprovalIdentity(session);
    const sessionId = campaignApprovalSessionId(session, organizationId, requestId);
    if (body.approvalStage === "prepare") {
      const approval = await createLeoActionApproval({ identity, organizationId, sessionId, channel: "api", toolKey: REAL_ESTATE_CAMPAIGN_SEND_TOOL, arguments: approvalArguments, realEstateOptIn: true });
      return noStore({ ok: true, status: "confirmation_required", requestId, preview: { campaignType, campaignTypeLabel: campaignLabel(campaignType), topic, templateName, propertyName: propertyCampaign?.propertyName || null, message, recipientPreview: maskedRecipientPreview(recipients), moreRecipients: Math.max(0, recipients.length - 20), attemptedRecipients: recipients.length, cooldownSkipped, messageParts: messageParts.length, expiresAt: approval.expiresAt }, approval: { approvalId: approval.approvalId, token: approval.token, expiresAt: approval.expiresAt } }, 200);
    }

    const approvalId = String(body.approvalId || "").trim();
    const approvalToken = String(body.approvalToken || "").trim();
    if (!approvalId || !approvalToken) return noStore({ error: "The exact campaign preview must be approved before sending." }, 409);
    const consumed = await consumeLeoActionApproval({ identity, organizationId, sessionId, channel: "api", toolKey: REAL_ESTATE_CAMPAIGN_SEND_TOOL, arguments: approvalArguments, approvalId, token: approvalToken, realEstateOptIn: true });
    if (!consumed.accepted) return noStore({ ok: false, status: consumed.status, error: "The campaign approval is invalid, expired, already used, or no longer matches the exact audience and message. Preview it again before any retry." }, 409);

    trackingAdmin = createAdminClient();
    parentIdempotencyKey = `campaign:${requestId}`;
    const campaignClaim = await claimOutboundTracking(trackingAdmin, {
      organizationId,
      outboundKind: "campaign",
      idempotencyKey: parentIdempotencyKey,
      campaignId: requestId,
      lifecycleStatus: "approved",
      deliveryStatus: "unknown",
      metadata: { requestId, campaignType, templateName, topic, attempted: recipients.length * messageParts.length, approvalId, approvalStatus: "consumed" },
    });
    if (campaignClaim.duplicate) {
      const storedResponse = campaignClaim.row.metadata && typeof campaignClaim.row.metadata.response === "object" ? campaignClaim.row.metadata.response as Record<string, unknown> : null;
      if (storedResponse) return noStore({ ...storedResponse, duplicatePrevented: true });
      return noStore({ ok: false, campaignId: requestId, requestId, status: campaignClaim.row.lifecycle_status === "failed" ? "failed" : "unknown", deliveryStatus: campaignClaim.row.delivery_status || "unknown", duplicatePrevented: true, message: "This approved campaign request was already claimed. Delivery must be reconciled before another attempt." }, 202);
    }

    await updateOutboundTracking(trackingAdmin, organizationId, parentIdempotencyKey, { lifecycle_status: "executing", delivery_status: "unknown" });
    const campaignId = requestId;
    const createdBy = session.email;
    const dispatches: Array<Awaited<ReturnType<typeof dispatchMaiaCampaignAction>>> = [];
    try {
      for (let index = 0; index < messageParts.length; index += 1) {
        dispatches.push(await dispatchMaiaCampaignAction({ commandId: messageParts.length === 1 ? campaignId : `${campaignId}-part-${index + 1}`, campaignType, templateName, topic, message: messageParts[index], recipients, propertyTitle: propertyCampaign?.propertyName || selectedProperty?.title, mediaUrl: String(body.mediaUrl || "").trim() || undefined, createdBy }));
      }
    } catch (dispatchError) {
      const detail = dispatchError instanceof Error ? dispatchError.message.slice(0, 1000) : "Provider execution returned an ambiguous failure.";
      await updateOutboundTracking(trackingAdmin, organizationId, parentIdempotencyKey, { lifecycle_status: "unknown", delivery_status: "unknown", error_message: detail }).catch(() => undefined);
      return noStore({ ok: false, campaignId, requestId, status: "unknown", deliveryStatus: "unknown", duplicatePrevented: false, message: "The provider result is uncertain. Do not resend; reconcile this request in the campaign report first." }, 502);
    }

    const attempted = recipients.length * dispatches.length;
    const accepted = dispatches.reduce((total, item) => total + Number(item.accepted || 0), 0);
    const failed = dispatches.reduce((total, item) => total + Number(item.failed || 0), 0);
    const skipped = cooldownSkipped * dispatches.length + dispatches.reduce((total, item) => total + Number(item.skipped || 0), 0);
    const pendingDelivery = dispatches.reduce((total, item) => total + Number(item.pendingDelivery || 0), 0);
    const delivered = dispatches.reduce((total, item) => total + Number((item.summary as Record<string, unknown>).delivered || 0), 0);
    const read = dispatches.reduce((total, item) => total + Number((item.summary as Record<string, unknown>).read || 0), 0);
    const freeFormSent = dispatches.reduce((total, item) => total + Number(item.freeFormSent || 0), 0);
    const templateSent = dispatches.reduce((total, item) => total + Number(item.templateSent || 0), 0);
    const failedRecipients = dispatches.flatMap((item) => item.failedRecipients || []);
    const deliveryStatus = delivered > 0 && (pendingDelivery > 0 || failed > 0) ? "partial" : delivered > 0 ? (read >= delivered ? "read" : "delivered") : accepted > 0 && failed > 0 ? "partial" : accepted > 0 ? "accepted" : failed > 0 ? "failed" : "unknown";
    const status = accepted > 0 ? "executed" : failed > 0 ? "failed" : "unknown";
    const allAcceptedRecipients = dispatches.flatMap((item) => Array.isArray(item.acceptedRecipients) ? item.acceptedRecipients : []).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    const payload = { ok: accepted > 0, campaignId, campaignType, campaignTypeLabel: campaignLabel(campaignType), templateName, requestId, topic, attempted, recipientCount: recipients.length, sent: accepted, accepted, delivered, read, failed, skipped, pendingDelivery, freeFormSent, templateSent, cooldownSkipped, messageParts: messageParts.length, originalCharacterCount: message.length, status, campaignStatus: status, approvalStatus: "consumed", deliveryStatus, providerStatus: dispatches.map((item) => item.status), message: messageParts.length > 1 ? `Campaign submitted in ${messageParts.length} WhatsApp message parts.` : dispatches[0]?.message, acceptedRecipients: allAcceptedRecipients, failedRecipients, executionId: dispatches.map((item) => item.executionId).join(","), workflowPath: [...new Set(dispatches.flatMap((item) => item.path || []))], duplicatePrevented: false, propertyContext: propertyCampaign?.memory || null, exactPropertyReply: propertyCampaign?.replyInstruction || null, mediaUrl: String(body.mediaUrl || "").trim() || null };

    for (let index = 0; index < dispatches.length; index += 1) {
      const item = dispatches[index];
      const acceptedRecipients = Array.isArray(item.acceptedRecipients) ? item.acceptedRecipients : [];
      for (const recipient of acceptedRecipients) {
        if (!recipient || typeof recipient !== "object") continue;
        const leadId = String(recipient.leadId || recipient.id || "").trim();
        if (!leadId) continue;
        const recipientIdempotencyKey = `campaign:${requestId}:part:${index + 1}:recipient:${leadId}`;
        const providerMessageId = String(recipient.providerMessageId || recipient.provider_message_id || recipient.messageId || recipient.message_id || "").trim() || null;
        const individualStatus = perRecipientStatus(recipient, Boolean(providerMessageId));
        const recipientClaim = await claimOutboundTracking(trackingAdmin, { organizationId, outboundKind: "campaign_recipient", idempotencyKey: recipientIdempotencyKey, campaignId: requestId, leadId, recipient: String(recipient.phone || recipient.recipient || ""), lifecycleStatus: individualStatus === "delivered" || individualStatus === "read" ? "received" : individualStatus === "failed" ? "failed" : providerMessageId ? "executed" : "unknown", deliveryStatus: individualStatus, metadata: { leadId, partIndex: index + 1, provider: String(recipient.provider || "whatsapp") } });
        if (!recipientClaim.duplicate) await updateOutboundTracking(trackingAdmin, organizationId, recipientIdempotencyKey, { provider_message_id: providerMessageId, provider: String(recipient.provider || "meta").toLowerCase(), lifecycle_status: individualStatus === "delivered" || individualStatus === "read" ? "received" : individualStatus === "failed" ? "failed" : providerMessageId ? "executed" : "unknown", delivery_status: individualStatus });
      }
    }

    const finalLifecycle = accepted > 0 ? "executed" : failed > 0 ? "failed" : "unknown";
    await updateOutboundTracking(trackingAdmin, organizationId, parentIdempotencyKey, { lifecycle_status: finalLifecycle, delivery_status: deliveryStatus, metadata: { requestId, campaignType, templateName, topic, attempted, response: payload } });
    await saveCampaignDeliveryReport({ id: campaignId, campaign_type: campaignType, template_name: templateName, campaign_topic: topic, command_id: campaignId, execution_id: payload.executionId, status, attempted, accepted, delivered, read, failed, skipped, pending_delivery: pendingDelivery, accepted_recipients: allAcceptedRecipients, failed_recipients: failedRecipients, workflow_path: payload.workflowPath, created_by: createdBy, created_at: new Date().toISOString() }).catch((error) => console.error("Campaign delivery ledger save failed.", error));
    return noStore(payload);
  } catch (error) {
    console.error("WhatsApp campaign dispatch failed.", error);
    return noStore({ error: error instanceof Error ? error.message : "Campaign dispatch failed.", reason: error instanceof Error ? error.message : "Campaign dispatch failed." }, error instanceof PropertyCampaignMessageError ? 400 : 500);
  }
}
