import { logger, schedules, task } from "@trigger.dev/sdk";
import { processSystemEvent } from "@/lib/system-orchestrator";
import { processDueAppointmentReminders } from "@/lib/system-event-adapters";
import { recoverFailedSystemEvents } from "@/lib/orchestration-operations";
import { processDueHandoffFollowups } from "@/lib/handoff-followup";
import { scanAnalyticsAnomalies } from "@/lib/analytics-phase-e";
import { syncDueFluxSubscriptionWallets } from "@/lib/flux-commercial";

export const systemEventDispatch = task({
  id: "system-event-dispatch",
  maxDuration: 300,
  retry: {
    maxAttempts: 4,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  run: async (payload: { eventId: string }) => {
    if (!payload.eventId) throw new Error("eventId is required.");
    const result = await processSystemEvent(payload.eventId);
    logger.info("System event dispatch completed", { eventId: payload.eventId, result });
    if (result.status === "failed") throw new Error(result.error || "System event dispatch failed.");
    return result;
  },
});

export const systemEventDrain = schedules.task({
  id: "system-event-drain",
  cron: "* * * * *",
  maxDuration: 300,
  run: async () => {
    const results = [];
    for (let index = 0; index < 25; index += 1) {
      const result = await processSystemEvent();
      if (result.status === "idle") break;
      results.push(result);
    }
    logger.info("System event drain completed", { processed: results.length });
    return { processed: results.length, results };
  },
});


export const appointmentReminderDrain = schedules.task({
  id: "appointment-reminder-drain",
  cron: "* * * * *",
  maxDuration: 300,
  run: async () => {
    const result = await processDueAppointmentReminders(100);
    logger.info("Appointment reminder drain completed", result);
    return result;
  },
});


export const orchestrationRecoverySweep = schedules.task({
  id: "orchestration-recovery-sweep",
  cron: "*/5 * * * *",
  maxDuration: 300,
  run: async () => {
    const result = await recoverFailedSystemEvents(50);
    logger.info("Orchestration recovery sweep completed", result);
    return result;
  },
});


export const handoffFollowupDrain = schedules.task({
  id: "handoff-followup-drain",
  cron: "* * * * *",
  maxDuration: 300,
  run: async () => {
    const result = await processDueHandoffFollowups(100);
    logger.info("Handoff follow-up drain completed", result);
    return result;
  },
});


export const platformHourlyMaintenanceSweep = schedules.task({
  id: "platform-hourly-maintenance-sweep",
  cron: "15 * * * *",
  maxDuration: 300,
  run: async () => {
    const [analytics, commercial] = await Promise.all([
      scanAnalyticsAnomalies(),
      syncDueFluxSubscriptionWallets(),
    ]);
    logger.info("Platform hourly maintenance sweep completed", { analytics, commercial });
    return { analytics, commercial };
  },
});
