import { logger, schedules, task } from "@trigger.dev/sdk";
import { processSystemEvent } from "@/lib/system-orchestrator";
import { processDueAppointmentReminders } from "@/lib/system-event-adapters";

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
