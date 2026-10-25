import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createLeoActionApproval, consumeLeoActionApproval } from "@/lib/leo-action-approval";
import { campaignApprovalArguments, campaignApprovalIdentity, campaignApprovalSessionId, REAL_ESTATE_CAMPAIGN_SEND_TOOL } from "@/lib/real-estate-campaign-approval";
import { getRealEstateCampaignGroup, matchesRealEstateCampaignGroupRules } from "@/lib/real-estate-campaign-groups";
import { getCampaignAudienceLeads, normalizeLeadPhone, type ProgressiveLead } from "@/lib/lead-profile-service";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { saveCampaignDeliveryReport } from "@/lib/campaign-report-store";
import { splitWhatsAppMessage } from "@/lib/whatsapp-message-splitter";
import { getMetaCooldownPhones } from "@/lib/whatsapp-status-log";
import { getRealEstateDirectWindowPhones } from "@/lib/real-estate-customer-service-window";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimOutboundTracking, updateOutboundTracking } from "@/lib/real-estate-campaign-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  requestId?: string;
  approvalStage?: "prepare" | "send";
  approvalId?: string;
  approvalToken?: string;
  topic?: string;
  message?: string;
  audienceMode?: "all" | "manual" | "group" | "filters";
  selectedLeadIds?: string[];
  campaignGroupId?: string;
  state?: string;
  interest?: string;
  budgetMin?: string | number;
  budgetMax?: string | number;
  mediaUrl?: string;
  propertyId?: string;
};
function text(value: unknown) { return String(value ?? "").trim().toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function contactable(lead: ProgressiveLead, organizationId: string) { const status = text(lead.status); return Boolean(String(lead.id || "").trim() && lead.organization_id === organizationId && lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }
function noStore(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } }); }
function requestIdentifier(value: unknown) { const id = String(value || "").trim(); return id.length > 0 && id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id) ? id : ""; }
function perRecipientStatus(recipient: Record<string, unknown>, hasProviderId: boolean): "accepted" | "sent" | "delivered" | "read" | "failed" | "unknown" {
  const status = text(recipient.deliveryStatus || recipient.delivery_status || recipient.status);
  if (["accepted", "sent", "delivered", "read", "failed"].includes(status)) return status as "accepted" | "sent" | "delivered" | "read" | "failed";
  return hasProviderId ? "accepted" : "unknown";
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return noStore({ error: "Unauthorized" }, 401);
  let organizationId = "";
  let requestId = "";
  let trackingAdmin: ReturnType<typeof createAdminClient> | null = null;
  let parentKey = "";
  try {
    organizationId = (await resolveAdminOrganizationScope()).organizationId;
    const body = await request.json().catch(() => ({})) as Body;
    requestId = requestIdentifier(body.requestId);
    if (!requestId) return noStore({ error: "A valid direct-message request ID is required." }, 400);
    if (body.approvalStage !== "prepare" && body.approvalStage !== "send") return noStore({ error: "Direct messages require a preview stage followed by explicit confirmation." }, 400);
    if (!String(body.message || "").trim()) return noStore({ error: "Direct message is required." }, 400);
    if (String(body.propertyId || "").trim()) return noStore({ error: "Direct mode does not attach property context. Use an approved property campaign template." }, 400);
    if (String(body.mediaUrl || "").trim()) return noStore({ error: "Media attachments are not supported by the verified direct-message workflow." }, 400);

    const leads = await getCampaignAudienceLeads(organizationId, 10000);
    const selected = new Set((body.selectedLeadIds || []).map(String));
    const group = body.campaignGroupId ? await getRealEstateCampaignGroup(organizationId, String(body.campaignGroupId)) : null;
    if (body.campaignGroupId && !group) return noStore({ error: "Campaign group not found in this organization." }, 404);
    const groupIds = new Set(group?.leadIds || []);
    const mode = body.audienceMode || "all";
    const state = text(body.state);
    const interest = text(body.interest);
    const min = money(body.budgetMin);
    const max = money(body.budgetMax);
    const matched = leads.filter((lead) => {
      if (!contactable(lead, organizationId)) return false;
      if (mode === "manual") return selected.has(String(lead.id));
      if (mode === "group") return group ? group.groupType === "smart" ? matchesRealEstateCampaignGroupRules(lead, group.rules) : groupIds.has(String(lead.id)) : false;
      if (mode === "filters") {
        if (state && !text(lead.location_preference).includes(state)) return false;
        if (interest && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interest)) return false;
        const budget = money(lead.budget);
        if (min && (!budget || budget < min)) return false;
        if (max && (!budget || budget > max)) return false;
      }
      return true;
    });
    const openWindowPhones = await getRealEstateDirectWindowPhones(organizationId, matched.map((lead) => lead.phone));
    const inWindow = matched.filter((lead) => openWindowPhones.has(normalizeLeadPhone(lead.phone)));
    const windowSkipped = matched.length - inWindow.length;
    if (!inWindow.length) return noStore({ error: "No recipients have a server-verified inbound WhatsApp message within the last 24 hours. Use an approved template campaign instead.", attempted: matched.length, serviceWindowSkipped: windowSkipped }, 400);
    const cooldowns = await getMetaCooldownPhones(inWindow.map((lead) => lead.phone), 24);
    const recipients = inWindow.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone)));
    const cooldownSkipped = inWindow.length - recipients.length;
    if (!recipients.length) return noStore({ error: "All recipients with an open 24-hour window are in provider cooldown.", serviceWindowSkipped: windowSkipped, cooldownSkipped }, 400);
    const message = String(body.message).trim();
    const parts = splitWhatsAppMessage(message);
    if (!parts.length) return noStore({ error: "Direct message is required." }, 400);
    const topic = String(body.topic || "Direct WhatsApp Message").trim();
    const skipped = windowSkipped + cooldownSkipped;
    const approvalArguments = campaignApprovalArguments({ organizationId, requestId, campaignType: "direct_message", topic, message, messageParts: parts, templateName: null, mediaUrl: null, audienceMode: mode, selectedLeadIds: [...selected], campaignGroup: group, property: null, recipients, skipped });
    const identity = campaignApprovalIdentity(session);
    const sessionId = campaignApprovalSessionId(session, organizationId, requestId);
    if (body.approvalStage === "prepare") {
      const approval = await createLeoActionApproval({ identity, organizationId, sessionId, channel: "api", toolKey: REAL_ESTATE_CAMPAIGN_SEND_TOOL, arguments: approvalArguments, realEstateOptIn: true });
      return noStore({ ok: true, status: "confirmation_required", requestId, preview: { campaignType: "direct_message", topic, message, recipientPreview: recipients.slice(0, 20).map((lead) => ({ name: String(lead.name || "Client").slice(0, 80), phone: `••••${normalizeLeadPhone(lead.phone).slice(-4)}` })), moreRecipients: Math.max(0, recipients.length - 20), attemptedRecipients: recipients.length, serviceWindowSkipped: windowSkipped, cooldownSkipped, messageParts: parts.length, expiresAt: approval.expiresAt }, approval: { approvalId: approval.approvalId, token: approval.token, expiresAt: approval.expiresAt } });
    }

    const approvalId = String(body.approvalId || "").trim();
    const approvalToken = String(body.approvalToken || "").trim();
    if (!approvalId || !approvalToken) return noStore({ error: "The exact direct-message preview must be approved before sending." }, 409);
    const consumed = await consumeLeoActionApproval({ identity, organizationId, sessionId, channel: "api", toolKey: REAL_ESTATE_CAMPAIGN_SEND_TOOL, arguments: approvalArguments, approvalId, token: approvalToken, realEstateOptIn: true });
    if (!consumed.accepted) return noStore({ ok: false, status: consumed.status, error: "The approval is invalid, expired, already used, or the audience/message changed. Preview again before any retry." }, 409);

    trackingAdmin = createAdminClient();
    parentKey = `campaign:direct:${requestId}`;
    const claim = await claimOutboundTracking(trackingAdmin, { organizationId, outboundKind: "campaign", idempotencyKey: parentKey, campaignId: requestId, lifecycleStatus: "approved", deliveryStatus: "unknown", metadata: { requestId, campaignType: "direct_message", topic, attempted: recipients.length * parts.length, approvalId, approvalStatus: "consumed" } });
    if (claim.duplicate) {
      const stored = claim.row.metadata && typeof claim.row.metadata.response === "object" ? claim.row.metadata.response as Record<string, unknown> : null;
      if (stored) return noStore({ ...stored, duplicatePrevented: true });
      return noStore({ ok: false, requestId, status: claim.row.lifecycle_status === "failed" ? "failed" : "unknown", deliveryStatus: claim.row.delivery_status || "unknown", duplicatePrevented: true, message: "This direct-message request was already claimed. Reconcile its delivery before retrying." }, 202);
    }
    await updateOutboundTracking(trackingAdmin, organizationId, parentKey, { lifecycle_status: "executing", delivery_status: "unknown" });
    const dispatches: Array<Awaited<ReturnType<typeof dispatchMaiaCampaignAction>>> = [];
    try {
      for (let index = 0; index < parts.length; index += 1) dispatches.push(await dispatchMaiaCampaignAction({ commandId: parts.length === 1 ? requestId : `${requestId}-part-${index + 1}`, campaignType: "direct_message", topic, message: parts[index], recipients, createdBy: session.email }));
    } catch (dispatchError) {
      const detail = dispatchError instanceof Error ? dispatchError.message.slice(0, 1000) : "Provider execution returned an ambiguous failure.";
      await updateOutboundTracking(trackingAdmin, organizationId, parentKey, { lifecycle_status: "unknown", delivery_status: "unknown", error_message: detail }).catch(() => undefined);
      return noStore({ ok: false, requestId, status: "unknown", deliveryStatus: "unknown", message: "Provider outcome is uncertain. Do not resend; reconcile this request first." }, 502);
    }

    const attempted = recipients.length * dispatches.length;
    const accepted = dispatches.reduce((total, item) => total + Number(item.accepted || 0), 0);
    const failed = dispatches.reduce((total, item) => total + Number(item.failed || 0), 0);
    const skippedCount = skipped * dispatches.length + dispatches.reduce((total, item) => total + Number(item.skipped || 0), 0);
    const pendingDelivery = dispatches.reduce((total, item) => total + Number(item.pendingDelivery || 0), 0);
    const delivered = dispatches.reduce((total, item) => total + Number((item.summary as Record<string, unknown>).delivered || 0), 0);
    const read = dispatches.reduce((total, item) => total + Number((item.summary as Record<string, unknown>).read || 0), 0);
    const deliveryStatus = delivered > 0 && (pendingDelivery > 0 || failed > 0) ? "partial" : delivered > 0 ? (read >= delivered ? "read" : "delivered") : accepted > 0 && failed > 0 ? "partial" : accepted > 0 ? "accepted" : failed > 0 ? "failed" : "unknown";
    const status = accepted > 0 ? "executed" : failed > 0 ? "failed" : "unknown";
    const acceptedRecipients = dispatches.flatMap((item) => Array.isArray(item.acceptedRecipients) ? item.acceptedRecipients : []).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    const failedRecipients = dispatches.flatMap((item) => item.failedRecipients || []);
    const executionId = dispatches.map((item) => item.executionId).join(",");
    const workflowPath = [...new Set(dispatches.flatMap((item) => item.path || []))];
    const payload = { ok: accepted > 0, campaignId: requestId, requestId, campaignType: "direct_message", topic, attempted, recipientCount: recipients.length, sent: accepted, accepted, delivered, read, pendingDelivery, failed, skipped: skippedCount, serviceWindowSkipped: windowSkipped, cooldownSkipped, messageParts: parts.length, status, campaignStatus: status, approvalStatus: "consumed", deliveryStatus, executionId, workflowPath, message: "Submitted to the verified provider workflow; delivery remains pending until provider receipt confirmation." };

    for (let index = 0; index < dispatches.length; index += 1) {
      for (const recipient of dispatches[index].acceptedRecipients || []) {
        if (!recipient || typeof recipient !== "object") continue;
        const leadId = String(recipient.leadId || recipient.id || "").trim();
        if (!leadId) continue;
        const recipientKey = `campaign:direct:${requestId}:part:${index + 1}:recipient:${leadId}`;
        const providerMessageId = String(recipient.providerMessageId || recipient.provider_message_id || recipient.messageId || recipient.message_id || "").trim() || null;
        const delivery = perRecipientStatus(recipient, Boolean(providerMessageId));
        const providerRaw = text(recipient.provider);
        const provider = providerRaw.includes("twilio") ? "twilio" : "meta";
        const lifecycle = delivery === "delivered" || delivery === "read" ? "received" : delivery === "failed" ? "failed" : providerMessageId ? "executed" : "unknown";
        const row = await claimOutboundTracking(trackingAdmin, { organizationId, outboundKind: "campaign_recipient", idempotencyKey: recipientKey, campaignId: requestId, leadId, recipient: String(recipient.phone || recipient.recipient || ""), lifecycleStatus: lifecycle, deliveryStatus: delivery, metadata: { leadId, partIndex: index + 1, provider } });
        if (!row.duplicate) await updateOutboundTracking(trackingAdmin, organizationId, recipientKey, { provider_message_id: providerMessageId, provider, lifecycle_status: lifecycle, delivery_status: delivery });
      }
    }
    await updateOutboundTracking(trackingAdmin, organizationId, parentKey, { lifecycle_status: accepted > 0 ? "executed" : failed > 0 ? "failed" : "unknown", delivery_status: deliveryStatus, metadata: { requestId, campaignType: "direct_message", topic, attempted, response: payload } });
    await saveCampaignDeliveryReport({ id: requestId, campaign_type: "direct_message", campaign_topic: topic, command_id: requestId, execution_id: executionId, status, attempted, accepted, delivered, read, failed, skipped: skippedCount, pending_delivery: pendingDelivery, accepted_recipients: acceptedRecipients, failed_recipients: failedRecipients, workflow_path: workflowPath, created_by: session.email, created_at: new Date().toISOString() }).catch((error) => console.error("Direct campaign delivery ledger save failed.", error));
    return noStore(payload);
  } catch (error) {
    console.error("Direct WhatsApp campaign failed.", { organizationId, requestId, errorType: error instanceof Error ? error.name : "unknown" });
    const code = String((error as { code?: unknown })?.code || "");
    const detail = error instanceof Error ? error.message : "";
    if (code === "42P01" || code === "PGRST202" || detail.includes("real_estate_customer_service_windows") || detail.includes("record_real_estate_customer_service_window")) {
      return noStore({ error: "Direct messages are disabled until the server-verified 24-hour window migration is installed. Use an approved template campaign." }, 503);
    }
    return noStore({ error: error instanceof Error ? error.message : "Direct campaign failed." }, 500);
  }
}
