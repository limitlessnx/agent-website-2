import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import { getRecentWhatsAppStatuses } from "@/lib/whatsapp-status-log";

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

// Match the existing canonical receipt ordering. The WHERE predicate is evaluated
// by Postgres when the row is updated, including after concurrent row-lock waits.
const deliveryStates = ["accepted", "sent", "failed", "delivered", "read"] as const;
function precedingStates(status: string) {
  const rank = deliveryStates.indexOf(status as typeof deliveryStates[number]);
  return rank < 0 ? [] : ["pending", "unknown", ...deliveryStates.slice(0, rank)];
}

export async function applyLegacyWhatsAppReceipt(input: {
  organizationId: string;
  providerMessageId: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  responsePayload?: Record<string, unknown>;
}) {
  if (!input.organizationId || !input.providerMessageId) return false;
  const states = precedingStates(input.status);
  if (!states.length) return false;
  const { data, error } = await createAdminClient().from("whatsapp_delivery_attempts").update({
    status: input.status,
    error_code: input.status === "failed" ? input.errorCode || null : null,
    error_message: input.status === "failed" ? input.errorMessage || null : null,
    response_payload: input.responsePayload || null,
  }).eq("organization_id", input.organizationId).eq("provider_message_id", input.providerMessageId)
    .in("status", states).select("id");
  if (error) throw new Error("WhatsApp delivery receipt could not be stored.");
  return Boolean(data?.length);
}

export async function recordLimitlessCampaignDeliveryAttempts(input: {
  organizationId: string;
  campaignId: string;
  executionId?: string;
  campaignType?: string;
  templateName?: string;
  topic?: string;
  acceptedRecipients?: RecipientResult[];
  failedRecipients?: RecipientResult[];
  createdBy?: string;
}) {
  if (!input.organizationId) throw new Error("Organization ID is required for campaign delivery evidence.");
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
      const lookup = await supabase.from("whatsapp_delivery_attempts").select("id").eq("organization_id", input.organizationId).eq("provider_message_id", providerMessageId).maybeSingle();
      if (lookup.error) throw lookup.error;
      existing = lookup.data || null;
    }
    if (existing) {
      const update = await supabase.from("whatsapp_delivery_attempts").update({
        status: entry.status,
        error_message: entry.status === "failed" ? errorMessage(entry.item) || null : null,
        request_payload: requestPayload,
        response_payload: responsePayload,
      }).eq("id", existing.id).eq("organization_id", input.organizationId)
        .in("status", precedingStates(entry.status)).select("id");
      if (update.error) throw update.error;
      updated += update.data?.length || 0;
      continue;
    }
    // A stable primary key makes concurrent campaign-report replays harmless
    // without adding a second uniqueness constraint or rewriting historical rows.
    const digest = createHash("sha256").update(JSON.stringify([
      input.organizationId, providerMessageId,
      providerMessageId ? null : input.campaignId,
      providerMessageId ? null : input.executionId || null, recipient,
    ])).digest("hex").slice(0, 32);
    const attemptId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
    const insert = await supabase.from("whatsapp_delivery_attempts").upsert({
      id: attemptId,
      organization_id: input.organizationId,
      recipient,
      message_type: "template",
      template_name: input.templateName || null,
      provider_message_id: providerMessageId,
      status: entry.status,
      error_message: entry.status === "failed" ? errorMessage(entry.item) || null : null,
      request_payload: requestPayload,
      response_payload: responsePayload,
    }, { onConflict: "id", ignoreDuplicates: true }).select("id");
    if (insert.error) throw insert.error;
    inserted += insert.data?.length || 0;
  }
  return { inserted, updated };
}

export async function reconcileLimitlessDeliveryLedger(limit = 1500) {
  const supabase = createAdminClient();
  const [statuses, attemptsResult] = await Promise.all([
    getRecentWhatsAppStatuses(limit),
    supabase.from("whatsapp_delivery_attempts").select("*").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).order("created_at", { ascending: false }).limit(Math.max(100, Math.min(limit, 5000))),
  ]);
  if (attemptsResult.error) throw attemptsResult.error;
  const attempts = (attemptsResult.data || []) as DeliveryAttemptRow[];
  const messageIds = new Set(attempts.map(attempt => attempt.provider_message_id).filter(Boolean));
  if (statuses.some(status => messageIds.has(status.message_id))) {
    // These historical bot_sessions rows lack verified organization/provider
    // provenance. Matching a message ID alone is not authority to mutate a row.
    throw new Error("Legacy WhatsApp receipt identity is unverified. Delivery evidence requires a verified provider callback.");
  }
  return { checked: attempts.length, updated: 0 };
}

export async function getLimitlessCampaignDeliveryLedger(campaignId?: string, limit = 500) {
  const supabase = createAdminClient();
  await reconcileLimitlessDeliveryLedger(1500);
  let query = supabase.from("whatsapp_delivery_attempts").select("*").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).order("created_at", { ascending: false }).limit(Math.max(1, Math.min(limit, 5000)));
  if (campaignId) query = query.contains("request_payload", { campaign_id: campaignId });
  const result = await query;
  if (result.error) throw result.error;
  return (result.data || []) as DeliveryAttemptRow[];
}
