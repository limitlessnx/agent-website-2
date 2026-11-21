import { schedules, task, logger } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyPublishing } from "@/lib/social-daily-publishing";
import { fluxSocialPublishPost } from "./social-publisher";
import { dispatchRealtySocialSchedules } from "@/lib/social-realty-dispatch";

export const fluxSocialDailyPublishing = task({
  id: "flux-social-daily-publishing-cycle",
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async (payload: { scheduleOnly?: boolean }) => {
    const db=createAdminClient(),now=new Date();
    const result=await runDailyPublishing(db,now,payload.scheduleOnly===true,
      (scheduleId)=>fluxSocialPublishPost.trigger({scheduleId},{idempotencyKey:`daily-instagram:${scheduleId}`}));
    if(!payload.scheduleOnly){
      try{await dispatchRealtySocialSchedules(db,now,(scheduleId,intent)=>fluxSocialPublishPost.trigger({scheduleId},{idempotencyKey:`realty-manual:${scheduleId}:${intent}`}));}
      catch{logger.error("Limitless Realty's explicit social queue needs attention; the Fluxknight cycle result is preserved.");}
    }
    return result;
  },
});

export const fluxSocialDailyPublishingSweep = schedules.task({
  id: "flux-social-daily-publishing-sweep",
  cron: { pattern: "*/5 * * * *", timezone: "Africa/Lagos", environments: ["PRODUCTION"], window: "1m" },
  run: async () => fluxSocialDailyPublishing.trigger({}),
});
