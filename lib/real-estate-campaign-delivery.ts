import type { SupabaseClient } from "@supabase/supabase-js";

export type OutboundLifecycle = "prepared" | "approved" | "executing" | "executed" | "received" | "failed" | "unknown" | "cancelled";
export type OutboundDelivery = "unknown" | "accepted" | "sent" | "delivered" | "read" | "failed" | "partial";

export type OutboundTrackingRow = {
  id: string;
  organization_id: string;
  outbound_kind: "followup" | "campaign" | "campaign_recipient";
  idempotency_key: string;
  campaign_id?: string | null;
  follow_up_id?: string | null;
  lead_id?: string | null;
  recipient?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  lifecycle_status: OutboundLifecycle;
  delivery_status: OutboundDelivery;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AdminClientLike = Pick<SupabaseClient, "from">;

const STOP_STATUS = new Set([
  "reply", "replied", "responded", "response", "appointment", "appointment_requested", "booked",
  "handoff", "human_handoff", "human_active", "optout", "opted_out", "do_not_contact", "blocked",
  "purchase", "purchased", "won", "lost", "closed", "disqualified",
]);

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function followupStopReason(input: {
  lead?: { status?: unknown; opted_out?: unknown; campaign_eligible?: unknown } | null;
  handoff?: { ai_paused?: unknown; status?: unknown } | null;
  conversation?: { status?: unknown } | null;
  hasInboundReply?: boolean;
}) {
  if (!input.lead) return "missing_lead";
  if (!String(input.lead.status || "").trim()) return input.lead.opted_out ? "opted_out" : null;
  if (input.lead.opted_out === true) return "opted_out";
  if (input.lead.campaign_eligible === false) return "not_contactable";
  if (input.hasInboundReply) return "replied";
  if (input.handoff?.ai_paused) return "human_handoff";
  if ([normalized(input.handoff?.status), normalized(input.conversation?.status)].some((status) => ["handoff", "human_handoff", "human_active"].includes(status))) return "human_handoff";
  const status = normalized(input.lead.status);
  if (STOP_STATUS.has(status)) return status;
  return null;
}

export async function claimOutboundTracking(
  admin: AdminClientLike,
  input: {
    organizationId: string;
    outboundKind: OutboundTrackingRow["outbound_kind"];
    idempotencyKey: string;
    campaignId?: string | null;
    followUpId?: string | null;
    leadId?: string | null;
    recipient?: string | null;
    lifecycleStatus?: OutboundLifecycle;
    deliveryStatus?: OutboundDelivery;
    metadata?: Record<string, unknown>;
  },
) {
  const existing = await admin.from("real_estate_outbound_tracking").select("*")
    .eq("organization_id", input.organizationId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.data) return { row: existing.data, duplicate: true };
  if (existing.error && !String((existing.error as { code?: string })?.code || "").includes("PGRST116")) {
    // A missing row is normal for maybeSingle; other read errors must not send.
    const message = existing.error instanceof Error ? existing.error.message : String(existing.error);
    if (!/no rows|not found|PGRST116/i.test(message)) throw existing.error;
  }

  const inserted = await admin.from("real_estate_outbound_tracking").insert({
    organization_id: input.organizationId,
    outbound_kind: input.outboundKind,
    idempotency_key: input.idempotencyKey,
    campaign_id: input.campaignId || null,
    follow_up_id: input.followUpId || null,
    lead_id: input.leadId || null,
    recipient: input.recipient || null,
    lifecycle_status: input.lifecycleStatus || "approved",
    delivery_status: input.deliveryStatus || "unknown",
    metadata: input.metadata || {},
  }).select("*").maybeSingle();
  if (!inserted.error && inserted.data) return { row: inserted.data as OutboundTrackingRow, duplicate: false };

  // The unique key is the concurrency guard. A conflict is a duplicate, not permission to send again.
  const raced = await admin.from("real_estate_outbound_tracking").select("*")
    .eq("organization_id", input.organizationId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (raced.data) return { row: raced.data, duplicate: true };
  throw inserted.error || raced.error || new Error("Unable to claim outbound tracking row.");
}

export async function updateOutboundTracking(
  admin: AdminClientLike,
  organizationId: string,
  idempotencyKey: string,
  values: Partial<Pick<OutboundTrackingRow, "lifecycle_status" | "delivery_status" | "provider" | "provider_message_id" | "error_message" | "metadata">>,
) {
  const result = await admin.from("real_estate_outbound_tracking").update(values)
    .eq("organization_id", organizationId).eq("idempotency_key", idempotencyKey).select("*").maybeSingle();
  if (result.error) throw result.error;
  return result.data as OutboundTrackingRow | null;
}

export function summarizeCampaignDelivery(statuses: Array<{ lifecycleStatus?: unknown; deliveryStatus?: unknown; providerMessageId?: unknown }>) {
  const attempted = statuses.length;
  const accepted = statuses.filter((item) => Boolean(String(item.providerMessageId || "").trim()) || ["accepted", "sent", "delivered", "read"].includes(normalized(item.deliveryStatus))).length;
  const received = statuses.filter((item) => ["delivered", "read"].includes(normalized(item.deliveryStatus)) || normalized(item.lifecycleStatus) === "received").length;
  const failed = statuses.filter((item) => normalized(item.deliveryStatus) === "failed" || normalized(item.lifecycleStatus) === "failed").length;
  const unknown = statuses.filter((item) => normalized(item.deliveryStatus) === "unknown" || normalized(item.lifecycleStatus) === "unknown").length;
  const partial = accepted > 0 && (failed > 0 || unknown > 0 || (received > 0 && received < accepted));
  const lifecycleStatus: OutboundLifecycle = received === attempted && attempted > 0 ? "received" : accepted > 0 ? "executed" : failed === attempted && attempted > 0 ? "failed" : "unknown";
  const deliveryStatus: OutboundDelivery = received === attempted && attempted > 0 ? "delivered" : partial ? "partial" : failed === attempted && attempted > 0 ? "failed" : accepted > 0 ? "accepted" : "unknown";
  return { attempted, accepted, received, failed, unknown, partial, lifecycleStatus, deliveryStatus };
}
