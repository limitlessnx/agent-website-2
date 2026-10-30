import { logger, task } from "@trigger.dev/sdk";
import { processSystemEvent } from "@/lib/system-orchestrator";
import { processDueAppointmentReminders } from "@/lib/system-event-adapters";
import { recoverFailedSystemEvents } from "@/lib/orchestration-operations";
import { processDueHandoffFollowups } from "@/lib/handoff-followup";
import { scanAnalyticsAnomalies } from "@/lib/analytics-phase-e";
import { syncDueFluxSubscriptionWallets } from "@/lib/flux-commercial";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { claimOutboundTracking, followupStopReason, updateOutboundTracking } from "@/lib/real-estate-campaign-delivery";

type FollowupLead = {
  phone: string | null;
  name: string | null;
  status: string | null;
  opted_out: boolean | null;
  campaign_eligible: boolean | null;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toFollowupLead(value: unknown): FollowupLead | null {
  const row = toRecord(value);
  if (!row) return null;
  return {
    phone: typeof row.phone === "string" ? row.phone : null,
    name: typeof row.name === "string" ? row.name : null,
    status: typeof row.status === "string" ? row.status : null,
    opted_out: typeof row.opted_out === "boolean" ? row.opted_out : null,
    campaign_eligible: typeof row.campaign_eligible === "boolean" ? row.campaign_eligible : null,
  };
}

async function processDueLimitlessFollowups(limit = 25) {
  const admin = createAdminClient();
  const { data: organization, error: organizationError } = await admin.from("organizations").select("id,status").eq("slug", "limitless-realty").maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization) return { processed: 0, sent: 0, failed: 0, cancelled: 0, reason: "organization_not_found" };
  if (organization.status !== "active") return { processed: 0, sent: 0, failed: 0, cancelled: 0, reason: "organization_not_active" };
  try {
    await assertFluxFeatureAccess(organization.id, "follow_ups");
  } catch (error) {
    return { processed: 0, sent: 0, failed: 0, cancelled: 0, reason: "not_entitled", error: error instanceof Error ? error.message : "Follow-up automation is not included in this plan." };
  }

  const { data: rows, error } = await admin.from("follow_ups")
    .select("id,organization_id,lead_id,created_at,scheduled_at,message_sent,status,template_name,stage,leads!follow_ups_lead_id_fkey(phone,name,opted_out,status,campaign_eligible)")
    .eq("organization_id", organization.id).eq("status", "pending").is("sequence_id", null).lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true }).limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw error;

  let sent = 0, failed = 0, cancelled = 0;
  for (const row of rows || []) {
    const claim = await admin.from("follow_ups").update({ status: "processing" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "pending").select("id").maybeSingle();
    if (claim.error || !claim.data) continue;
    try {
      const lead = toFollowupLead(Array.isArray(row.leads) ? row.leads[0] : row.leads);
      const phone = String(lead?.phone || "").replace(/[^\d]/g, "");
      const { data: handoffConversation } = phone
        ? await admin.from("agent_conversations").select("id,ai_paused,status").eq("organization_id", organization.id).eq("external_thread_key", phone).maybeSingle()
        : { data: null };
      const handoffRecord = toRecord(handoffConversation);
      const isHandoffStatus = String(handoffRecord?.status || "").toLowerCase() === "handoff" || handoffRecord?.ai_paused === true;
      const conversation = phone
        ? await admin.from("crm_conversations").select("id,status").eq("organization_id", organization.id).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle()
        : { data: null };
      let lastInboundAt: string | null = null;
      if (conversation.data?.id) {
        const inbound = await admin.from("crm_messages").select("created_at").eq("organization_id", organization.id).eq("conversation_id", conversation.data.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
        lastInboundAt = inbound.data?.created_at || null;
      }
      const queuedAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      const stopReason = followupStopReason({
        lead: lead ? { status: lead.status, opted_out: lead.opted_out, campaign_eligible: lead.campaign_eligible } : null,
        handoff: handoffRecord,
        conversation: conversation.data,
        hasInboundReply: Boolean(lastInboundAt && queuedAt > 0 && new Date(lastInboundAt).getTime() > queuedAt),
      });
      if (!phone || stopReason || isHandoffStatus) {
        const cancellation = await admin.from("follow_ups").update({ status: "cancelled" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing").select("id").maybeSingle();
        if (cancellation.error) throw cancellation.error;
        if (!cancellation.data) throw new Error("Could not confirm cancellation of the stale follow-up.");
        cancelled++;
        continue;
      }
      const withinWindow = Boolean(lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000);
      const tracking = await claimOutboundTracking(admin, {
        organizationId: organization.id,
        outboundKind: "followup",
        idempotencyKey: `followup:${row.id}`,
        followUpId: row.id,
        leadId: row.lead_id,
        recipient: phone,
        lifecycleStatus: "approved",
        metadata: { stage: row.stage || null },
      });
      if (tracking.duplicate) {
        if (tracking.row.provider_message_id && ["executed", "received"].includes(tracking.row.lifecycle_status)) {
          await admin.from("follow_ups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing");
          sent++;
        } else {
          await admin.from("follow_ups").update({ status: "unknown" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing");
          failed++;
        }
        continue;
      }
      await updateOutboundTracking(admin, organization.id, `followup:${row.id}`, { lifecycle_status: "executing", delivery_status: "unknown" });
      const delivery = await sendWhatsAppMessage({
        organizationId: organization.id,
        to: phone,
        text: String(row.message_sent || ""),
        deliveryMode: withinWindow ? "direct" : "template",
        templatePurpose: "follow_up_outside_24h",
        lastCustomerMessageAt: lastInboundAt,
        variables: { lead_name: String(lead?.name || ""), conversation_summary: String(row.message_sent || "") },
      });
      const providerMessageId = String(delivery.providerMessageId || "").trim() || null;
      await updateOutboundTracking(admin, organization.id, `followup:${row.id}`, { lifecycle_status: providerMessageId ? "executed" : "unknown", delivery_status: providerMessageId ? "accepted" : "unknown", provider: delivery.provider, provider_message_id: providerMessageId });
      await admin.from("follow_ups").update({ status: providerMessageId ? "sent" : "unknown", sent_at: providerMessageId ? new Date().toISOString() : null }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing");
      if (providerMessageId) sent++; else failed++;
    } catch (error) {
      await updateOutboundTracking(admin, organization.id, `followup:${row.id}`, { lifecycle_status: "failed", delivery_status: "failed", error_message: error instanceof Error ? error.message : "Follow-up failed" }).catch(() => undefined);
      await admin.from("follow_ups").update({ status: "failed" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing");
      failed++;
    }
  }
  return { processed: (rows || []).length, sent, failed, cancelled };
}

export const systemEventDispatch = task({
  id: "system-event-dispatch",
  maxDuration: 300,
  retry: { maxAttempts: 4, minTimeoutInMs: 2_000, maxTimeoutInMs: 30_000, factor: 2 },
  run: async (payload: { eventId: string }) => {
    if (!payload.eventId) throw new Error("eventId is required.");
    const result = await processSystemEvent(payload.eventId);
    logger.info("System event dispatch completed", { eventId: payload.eventId, result });
    if (result.status === "failed" && !("suppressed" in result && result.suppressed)) throw new Error(result.error || "System event dispatch failed.");
    return result;
  },
});

export const systemEventDrain = task({ id: "system-event-drain", maxDuration: 300, run: async () => {
  const results = [];
  for (let index = 0; index < 25; index += 1) {
    const result = await processSystemEvent();
    if (result.status === "idle") break;
    results.push(result);
  }
  logger.info("System event drain completed", { processed: results.length });
  return { processed: results.length, results };
}});

export const limitlessFollowupDrain = task({
  id: "limitless-followup-drain",
  maxDuration: 300,
  run: async () => {
    const result = await processDueLimitlessFollowups(25);
    logger.info("Limitless Realty follow-up drain completed", result);
    return result;
  },
});

export const appointmentReminderDrain = task({ id: "appointment-reminder-drain", maxDuration: 300, run: async () => {
  const result = await processDueAppointmentReminders(100);
  logger.info("Appointment reminder drain completed", result);
  return result;
}});

export const orchestrationRecoverySweep = task({ id: "orchestration-recovery-sweep", maxDuration: 300, run: async () => {
  const result = await recoverFailedSystemEvents(50);
  logger.info("Orchestration recovery sweep completed", result);
  return result;
}});

export const handoffFollowupDrain = task({ id: "handoff-followup-drain", maxDuration: 300, run: async () => {
  const result = await processDueHandoffFollowups(100);
  logger.info("Handoff follow-up drain completed", result);
  return result;
}});

export const platformHourlyMaintenanceSweep = task({ id: "platform-hourly-maintenance-sweep", maxDuration: 300, run: async () => {
  const [analytics, commercial] = await Promise.all([scanAnalyticsAnomalies(), syncDueFluxSubscriptionWallets()]);
  logger.info("Platform hourly maintenance sweep completed", { analytics, commercial });
  return { analytics, commercial };
}});
