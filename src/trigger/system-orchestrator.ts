import { logger, task } from "@trigger.dev/sdk";
import { processSystemEvent } from "@/lib/system-orchestrator";
import { processDueAppointmentReminders } from "@/lib/system-event-adapters";
import { recoverFailedSystemEvents } from "@/lib/orchestration-operations";
import { processDueHandoffFollowups } from "@/lib/handoff-followup";
import { scanAnalyticsAnomalies } from "@/lib/analytics-phase-e";
import { syncDueFluxSubscriptionWallets } from "@/lib/flux-commercial";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

async function processDueLimitlessFollowups(limit = 25) {
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id").eq("slug", "limitless-realty").maybeSingle();
  if (!organization) return { processed: 0, sent: 0, failed: 0, cancelled: 0, reason: "organization_not_found" };

  const { data: rows, error } = await admin.from("follow_ups")
    .select("id,organization_id,lead_id,scheduled_at,message_sent,status,template_name,leads!follow_ups_lead_id_fkey(phone,name,opted_out)")
    .eq("organization_id", organization.id).eq("status", "pending").lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true }).limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw error;

  let sent = 0, failed = 0, cancelled = 0;
  for (const row of rows || []) {
    const claim = await admin.from("follow_ups").update({ status: "processing" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "pending").select("id").maybeSingle();
    if (claim.error || !claim.data) continue;
    try {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const phone = String((lead as any)?.phone || "").replace(/[^\d]/g, "");
      if (!phone || Boolean((lead as any)?.opted_out)) {
        await admin.from("follow_ups").update({ status: "cancelled" }) .eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing");
        cancelled++;
        continue;
      }
      const conversation = await admin.from("crm_conversations").select("id").eq("organization_id", organization.id).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle();
      let lastInboundAt: string | null = null;
      if (conversation.data?.id) {
        const inbound = await admin.from("crm_messages").select("created_at").eq("conversation_id", conversation.data.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
        lastInboundAt = inbound.data?.created_at || null;
      }
      const withinWindow = Boolean(lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000);
      await sendWhatsAppMessage({
        organizationId: organization.id,
        to: phone,
        text: String(row.message_sent || ""),
        deliveryMode: withinWindow ? "direct" : "template",
        templatePurpose: "follow_up_outside_24h",
        lastCustomerMessageAt: lastInboundAt,
        variables: { lead_name: String((lead as any)?.name || ""), conversation_summary: String(row.message_sent || "") },
      });
      await admin.from("follow_ups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", organization.id) .eq("status", "processing");
      sent++;
    } catch {
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
    if (result.status === "failed") throw new Error(result.error || "System event dispatch failed.");
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
