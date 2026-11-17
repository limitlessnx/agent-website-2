import { schedules, task } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyPublishing } from "@/lib/social-daily-publishing";
import { fluxSocialPublishPost } from "./social-publisher";

export const fluxSocialDailyPublishing = task({
  id: "flux-social-daily-publishing-cycle",
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async (payload: { scheduleOnly?: boolean }) => runDailyPublishing(createAdminClient(), new Date(), payload.scheduleOnly === true,
    (scheduleId) => fluxSocialPublishPost.trigger({ scheduleId }, { idempotencyKey: `daily-instagram:${scheduleId}` })),
});

export const fluxSocialDailyPublishingSweep = schedules.task({
  id: "flux-social-daily-publishing-sweep",
  cron: { pattern: "*/5 * * * *", timezone: "Africa/Lagos", environments: ["PRODUCTION"], window: "1m" },
  run: async () => fluxSocialDailyPublishing.trigger({}),
});
