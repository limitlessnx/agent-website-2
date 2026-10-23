import { schedules } from "@trigger.dev/sdk";
import { runAppointmentNotificationOutboxSweep } from "@/lib/appointment-notification-outbox-runtime";

export const appointmentNotificationOutboxSweep = schedules.task({
  id: "appointment-notification-outbox-sweep",
  cron: { pattern: "*/2 * * * *", timezone: "Africa/Lagos" },
  run: async () => runAppointmentNotificationOutboxSweep(),
});
