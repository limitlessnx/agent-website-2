import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import type { ClientSession } from "@/lib/client-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { resolveActiveRealEstateOrganization } from "@/lib/real-estate-organization";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function normalizePhone(value: unknown) { const phone = text(value).replace(/[^0-9]/g, ""); return phone.length >= 8 && phone.length <= 15 ? phone : ""; }
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function masked(value: string) { return `••••${value.slice(-4)}`; }

function classifyFailure(error: unknown) {
  const detail = error && typeof error === "object" ? error as { status?: unknown; code?: unknown } : {};
  const status = Number(detail.status);
  const providerCode = String(detail.code || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const code = providerCode || (Number.isInteger(status) ? `HTTP_${status}` : null);
  const definitive = Number.isInteger(status) && status >= 400 && status < 500 && ![408, 409, 425].includes(status);
  return {
    status: definitive ? "failed" : "unknown",
    errorCode: code,
    errorMessage: definitive
      ? `WhatsApp provider rejected the notification (HTTP ${status}${providerCode ? `, code ${providerCode}` : ""}).`
      : `WhatsApp provider acceptance is uncertain${Number.isInteger(status) ? ` (HTTP ${status})` : ""}. Verify delivery manually before any further attempt.`,
  };
}

async function loadRetryContext(session: ClientSession, handoffId: string, notificationId: string) {
  const access = await getOrganizationAccessContext(session.organizationId, session.userId);
  assertAnyOrganizationPermission(access, ["handoffs.manage"]);
  const admin = createAdminClient();
  const organization = await resolveActiveRealEstateOrganization(admin, session.organizationId);
  if (!organization) throw new Error("Notification retry is available only for an active real-estate organization.");

  const { data: handoff, error: handoffError } = await admin.from("human_handoffs")
    .select("id,status,conversation_id,customer_id,conversation_summary,reason,next_action,stage_id_at_handoff")
    .eq("organization_id", organization.id).eq("id", handoffId).maybeSingle();
  if (handoffError) throw handoffError;
  if (!handoff) throw new Error("Handoff not found.");
  if (["resolved", "closed"].includes(String(handoff.status || ""))) throw new Error("A closed handoff cannot be re-notified.");

  const { data: notification, error: notificationError } = await admin.from("handoff_notifications")
    .select("id,status,channel,recipient,membership_id,error_code,retry_count,metadata")
    .eq("organization_id", organization.id).eq("handoff_id", handoffId).eq("id", notificationId).eq("channel", "whatsapp").maybeSingle();
  if (notificationError) throw notificationError;
  if (!notification || notification.status !== "failed") throw new Error("Only a definitively rejected notification can be retried.");
  if (!notification.error_code) throw new Error("This older failure has no verified provider rejection code; verify delivery manually instead of retrying.");
  const retryCount = Number(notification.retry_count || 0);
  if (!Number.isInteger(retryCount) || retryCount >= 3) throw new Error("The maximum of three explicit notification retries has been reached.");

  const metadata = record(notification.metadata);
  if (String(notification.error_code) === "131047") throw new Error("The provider closed the 24-hour free-form window. Do not retry a text; use the approved staff template fallback or verify its delivery manually.");
  if (metadata.fallback_template_attempted === true) throw new Error("The approved service-window template fallback was already attempted. Do not retry a free-form message; verify delivery manually.");
  const destinationSource = text(metadata.destination_source);
  const originalRecipient = normalizePhone(notification.recipient);
  if (!originalRecipient) throw new Error("The original staff recipient is missing.");
  let recipient = originalRecipient;

  if (notification.membership_id) {
    if (destinationSource !== "membership") throw new Error("The original notification destination cannot be verified.");
    const { data: member, error: memberError } = await admin.from("organization_memberships").select("id,status")
      .eq("organization_id", organization.id).eq("id", notification.membership_id).maybeSingle();
    if (memberError) throw memberError;
    if (!member || member.status !== "active") throw new Error("The original staff recipient is no longer an active organization member.");
    const { data: preference, error: preferenceError } = await admin.from("organization_member_notification_preferences")
      .select("whatsapp_phone,notify_whatsapp_handoffs,metadata").eq("organization_id", organization.id).eq("membership_id", notification.membership_id).maybeSingle();
    if (preferenceError) throw preferenceError;
    if (record(preference?.metadata).supervisor !== true || preference?.notify_whatsapp_handoffs !== true) throw new Error("The staff member is no longer an enabled handoff supervisor.");
    recipient = normalizePhone(preference.whatsapp_phone);
    if (!recipient || recipient !== originalRecipient) throw new Error("The current supervisor number differs from the failed notification; review assignment before retrying.");
  } else {
    const sourceAgentId = text(metadata.source_agent_id);
    if (destinationSource !== "agent_configuration" || !sourceAgentId) throw new Error("A phone-only staff destination cannot be verified for retry.");
    const { data: agent, error: agentError } = await admin.from("agents").select("human_handoff_destination")
      .eq("organization_id", organization.id).eq("id", sourceAgentId).maybeSingle();
    if (agentError) throw agentError;
    const destination = record(agent?.human_handoff_destination);
    const currentPhone = normalizePhone(destination.phone || destination.whatsapp_phone || destination.whatsappPhone || destination.number || destination.destination || agent?.human_handoff_destination);
    if (!currentPhone || currentPhone !== originalRecipient) throw new Error("The configured staff destination has changed; verify it before retrying.");
  }

  const { data: customer, error: customerError } = await admin.from("crm_customers").select("full_name,company_name,phone,current_stage_id")
    .eq("organization_id", organization.id).eq("id", handoff.customer_id).maybeSingle();
  if (customerError) throw customerError;
  const stageId = handoff.stage_id_at_handoff || customer?.current_stage_id;
  const { data: stage, error: stageError } = stageId
    ? await admin.from("organization_customer_stages").select("name").eq("organization_id", organization.id).eq("id", stageId).maybeSingle()
    : { data: null, error: null };
  if (stageError) throw stageError;
  const customerName = String(customer?.full_name || customer?.company_name || "Customer");
  const message = `New customer handoff: ${customerName}\nCustomer WhatsApp: ${normalizePhone(customer?.phone) || "Not recorded"}\nStage: ${stage?.name || "Not set"}\nSummary: ${String(handoff.conversation_summary || handoff.reason || "Review customer conversation").slice(0, 2000)}\nNext action: ${String(handoff.next_action || "Review customer conversation").slice(0, 500)}`;

  return { access, admin, organizationId: organization.id, handoffId, notification, retryCount, recipient, message, actorUserId: session.userId };
}

export async function prepareFailedHumanHandoffNotificationRetry(session: ClientSession, handoffId: string, notificationId: string) {
  const context = await loadRetryContext(session, handoffId, notificationId);
  const cleanupBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await context.admin.from("handoff_notification_retry_approvals").delete()
    .eq("organization_id", context.organizationId).lt("expires_at", cleanupBefore);
  if (cleanupError) throw cleanupError;
  const approvalId = randomUUID();
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const { error } = await context.admin.from("handoff_notification_retry_approvals").insert({
    id: approvalId,
    organization_id: context.organizationId,
    handoff_id: handoffId,
    notification_id: notificationId,
    actor_user_id: context.actorUserId,
    actor_membership_id: context.access.membershipId,
    message_digest: digest(context.message),
    recipient_digest: digest(context.recipient),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { approvalId, expiresAt, recipientPreview: masked(context.recipient), message: context.message };
}

export async function confirmFailedHumanHandoffNotificationRetry(session: ClientSession, handoffId: string, notificationId: string, approvalId: string) {
  const context = await loadRetryContext(session, handoffId, notificationId);
  if (!/^[0-9a-f-]{36}$/i.test(approvalId)) throw new Error("A valid one-time retry approval is required.");
  const messageDigest = digest(context.message);
  const recipientDigest = digest(context.recipient);
  const { data: claim, error: claimError } = await context.admin.rpc("claim_real_estate_handoff_notification_retry", {
    p_approval_id: approvalId,
    p_organization_id: context.organizationId,
    p_handoff_id: handoffId,
    p_notification_id: notificationId,
    p_actor_user_id: context.actorUserId,
    p_actor_membership_id: context.access.membershipId,
    p_message_digest: messageDigest,
    p_recipient_digest: recipientDigest,
    p_recipient: context.recipient,
  });
  if (claimError) throw claimError;
  if (claim?.claimed !== true || String(claim.notificationId) !== notificationId || Number(claim.retryCount) !== context.retryCount + 1) {
    throw new Error("The retry approval expired, changed, or was already used. Prepare a new preview.");
  }

  try {
    const result = await sendWhatsAppMessage({ organizationId: context.organizationId, to: context.recipient, text: context.message, deliveryMode: "direct", recipientType: "internal_staff" });
    const { data: updated, error: updateError } = await context.admin.from("handoff_notifications").update({
      status: "sent", provider_message_id: result.providerMessageId || null, sent_at: new Date().toISOString(), error_message: null, error_code: null,
    }).eq("organization_id", context.organizationId).eq("id", notificationId).eq("status", "pending").select("id,status").maybeSingle();
    if (updateError) throw new Error("The provider may have accepted the notification, but status persistence failed. Verify delivery manually; do not retry.");
    if (!updated) throw new Error("The provider may have accepted the notification, but its current status changed. Verify delivery manually; do not retry.");
    return { notificationId, status: "sent", retryCount: context.retryCount + 1, providerMessageId: result.providerMessageId || null };
  } catch (error) {
    const failure = classifyFailure(error);
    const { error: updateError } = await context.admin.from("handoff_notifications").update({ status: failure.status, error_code: failure.errorCode, error_message: failure.errorMessage })
      .eq("organization_id", context.organizationId).eq("id", notificationId).eq("status", "pending");
    if (updateError) throw new Error("Provider result could not be recorded. Verify delivery manually before any retry.");
    return { notificationId, status: failure.status, retryCount: context.retryCount + 1, errorCode: failure.errorCode, errorMessage: failure.errorMessage };
  }
}
