import { createAdminClient } from "@/lib/supabase/admin";
import { getRecentWhatsAppStatuses, type WhatsAppStatusLog } from "@/lib/whatsapp-status-log";

const LIMITLESS_REALTY_ORGANIZATION_ID = process.env.LIMITLESS_REALTY_ORGANIZATION_ID || "b15f21b4-5697-4d21-9421-8a34eae3476d";

type RecipientResult = Record<string, unknown>;

type DeliveryAttemptRow = {
  id: string;
  organization_id: string;
  recipient: string;
  message_type: string;
  template_name: string | null;
  provider_message_id: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  created_at: string;
};

function text(value: unknown) { return String(value || "").trim(); }
function phone(value: unknown) { return text(value).replace(/[^\d]/g, ""); }
function messageId(item: RecipientResult) { return text(item.messageId || item.message_id || item.provider_message_id); }
function recipientPhone(item: RecipientResult) { return phone(item.phone || item.recipient || item.recipient_phone); }
function recipientName(item: RecipientResult) { return text(item.name || item.recipient_name) || "there"; }
function errorMessage(item: RecipientResult) { return text(item.error || item.failure || item.reason || item.message); }

export async function recordLimitlessCampaignDeliveryAttempts(input: {
  campaignId: string;
  executionId?: string;
  campaignType?: string;
  templateName?: string;
  topic?: string;
  acceptedRecipients?: RecipientResult[];
  failedRecipients?: RecipientResult[];
  createdBy?: string;
}) {
  const supabase = createAdminClient();
  const acceptedRecipients = Array.isArray(input.acceptedRecipients) ? input.acceptedRecipients : [];
  const failedRecipients = Array.isArray(input.failedRecipients) ? input.failedRecipients : [];
  const results = [...acceptedRecipients.map((item) => ({ item, status: "accepted" })), ...failedRecipients.map((item) => ({ item, status: "failed" }))];
  if (!results.length) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;
  for (const entry of results) {
    const providerMessageId = messageId(entry.item) || null;
    const recipient = recipientPhone(entry.item);
    if (!recipient) continue;
    const requestPayload = {
      campaign_id: input.campaignId,
      execution_id: input.executionId || null,
      campaign_type: input.campaignType || "limitless_realty_update",
      topic: input.topic || "WhatsApp campaign",
      recipient_name: recipientName(entry.item),
      created_by: input.createdBy || null,
    };
    const responsePayload = entry.item;
    let existing: { id: string } | null = null;
    if (providerMessageId) {
      const lookup = await supabase.from("whatsapp_delivery_attempts").select("id").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).eq("provider_message_id", providerMessageId).maybeSingle();
      if (lookup.error) throw lookup.error;
      existing = lookup.data || null;
    }
    if (existing) {
      const update = await supabase.from("whatsapp_delivery_attempts").update({
        status: entry.status,
        error_message: entry.status === "failed" ? errorMessage(entry.item) || null : null,
        request_payload: requestPayload,
        response_payload: responsePayload,
      }).eq("id", existing.id);
      if (update.error) throw update.error;
      updated += 1;
      continue;
    }
    const insert = await supabase.from("whatsapp_delivery_attempts").insert({
      organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
      recipient,
      message_type: "template",
      template_name: input.templateName || null,
      provider_message_id: providerMessageId,
      status: entry.status,
      error_message: entry.status === "failed" ? errorMessage(entry.item) || null : null,
      request_payload: requestPayload,
      response_payload: responsePayload,
    });
    if (insert.error) throw insert.error;
    inserted += 1;
  }
  return { inserted, updated };
}

function latestStatusByMessageId(statusLogs: WhatsAppStatusLog[]) {
  const latest = new Map<string, WhatsAppStatusLog>();
  for (const log of statusLogs) {
    if (!log.message_id || latest.has(log.message_id)) continue;
    latest.set(log.message_id, log);
  }
  return latest;
}

export async function reconcileLimitlessDeliveryLedger(limit = 1500) {
  const supabase = createAdminClient();
  const [statuses, attemptsResult] = await Promise.all([
    getRecentWhatsAppStatuses(limit),
    supabase.from("whatsapp_delivery_attempts").select("*").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).order("created_at", { ascending: false }).limit(Math.max(100, Math.min(limit, 5000))),
  ]);
  if (attemptsResult.error) throw attemptsResult.error;
  const attempts = (attemptsResult.data || []) as DeliveryAttemptRow[];
  const statusMap = latestStatusByMessageId(statuses);
  let updated = 0;
  for (const attempt of attempts) {
    if (!attempt.provider_message_id) continue;
    const latest = statusMap.get(attempt.provider_message_id);
    if (!latest) continue;
    const nextStatus = latest.status || attempt.status;
    const nextErrorCode = latest.error_code || null;
    const nextErrorMessage = latest.error_details || latest.error_title || null;
    if (attempt.status === nextStatus && (attempt.error_code || null) === nextErrorCode && (attempt.error_message || null) === nextErrorMessage) continue;
    const update = await supabase.from("whatsapp_delivery_attempts").update({
      status: nextStatus,
      error_code: nextErrorCode,
      error_message: nextErrorMessage,
      response_payload: { ...(attempt.response_payload || {}), latest_status_event: latest },
    }).eq("id", attempt.id);
    if (update.error) throw update.error;
    updated += 1;
  }
  return { checked: attempts.length, updated };
}

export async function getLimitlessCampaignDeliveryLedger(campaignId?: string, limit = 500) {
  const supabase = createAdminClient();
  await reconcileLimitlessDeliveryLedger(1500).catch((error) => console.error("Limitless delivery ledger reconciliation failed.", error));
  let query = supabase.from("whatsapp_delivery_attempts").select("*").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).order("created_at", { ascending: false }).limit(Math.max(1, Math.min(limit, 5000)));
  if (campaignId) query = query.contains("request_payload", { campaign_id: campaignId });
  const result = await query;
  if (result.error) throw result.error;
  return (result.data || []) as DeliveryAttemptRow[];
}
