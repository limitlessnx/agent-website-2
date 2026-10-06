import { schedules } from "@trigger.dev/sdk";
import { runLimitlessInstallmentReminderSweep } from "@/lib/limitless-installment-reminder-runtime";

export const limitlessInstallmentReminderSweep = schedules.task({
  id: "limitless-installment-reminder-sweep",
  cron: {
    pattern: "*/15 * * * *",
    timezone: "Africa/Lagos",
  },
  run: async () => {
    return runLimitlessInstallmentReminderSweep();
  },
});
