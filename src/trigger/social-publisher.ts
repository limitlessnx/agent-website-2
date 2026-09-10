import { createClient } from "@supabase/supabase-js";
import { logger, schedules, task } from "@trigger.dev/sdk";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const SOCIAL_PLATFORMS = new Set(["instagram", "facebook", "linkedin"]);

type ScheduledPost = {
  id: string;
  organization_id: string;
  post_id: string;
  status: string;
  scheduled_for: string;
};

type SocialPost = {
  id: string;
  organization_id: string;
  title: string;
  caption: string;
  format: string;
  status: string;
  platforms: string[];
};

function createSocialAdminClient() {
  const url = process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ACTIVE_SUPABASE_URL;
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Flux Social requires a Supabase service-role key in Trigger.dev environment variables.");
  return createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function mockPublish(post: SocialPost, platform: string) {
  logger.info("Flux Social mock publish", {
    postId: post.id,
    platform,
    format: post.format,
    title: post.title,
  });

  return {
    externalPostId: `mock:${platform}:${post.id}`,
    publisher: "mock-v1",
  };
}

export const fluxSocialPublishPost = task({
  id: "flux-social-publish-post",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async (payload: { scheduleId: string }) => {
    const supabase = createSocialAdminClient();
    const now = new Date().toISOString();

    const { data: rawSchedule, error: scheduleError } = await supabase
      .from("social_schedules")
      .select("id,organization_id,post_id,status,scheduled_for")
      .eq("id", payload.scheduleId)
      .single();

    if (scheduleError) throw scheduleError;
    const schedule = rawSchedule as ScheduledPost;
    if (schedule.status === "completed" || schedule.status === "cancelled") {
      return { scheduleId: schedule.id, skipped: true, reason: schedule.status };
    }

    const { data: rawPost, error: postError } = await supabase
      .from("social_posts")
      .select("id,organization_id,title,caption,format,status,platforms")
      .eq("organization_id", schedule.organization_id)
      .eq("id", schedule.post_id)
      .single();

    if (postError) throw postError;
    const post = rawPost as SocialPost;
    if (post.status !== "scheduled") {
      await supabase.from("social_schedules").update({ status: "failed", last_error: `Post is ${post.status}, expected scheduled.` }).eq("id", schedule.id);
      return { scheduleId: schedule.id, skipped: true, reason: `post_${post.status}` };
    }

    const platforms = (Array.isArray(post.platforms) ? post.platforms : []).filter((platform) => SOCIAL_PLATFORMS.has(platform));
    if (!platforms.length) {
      await supabase.from("social_schedules").update({ status: "failed", last_error: "No supported publishing platforms selected." }).eq("id", schedule.id);
      throw new Error("No supported publishing platforms selected.");
    }

    for (const platform of platforms) {
      const { error: upsertError } = await supabase
        .from("social_publish_jobs")
        .upsert({
          organization_id: schedule.organization_id,
          post_id: post.id,
          schedule_id: schedule.id,
          platform,
          status: "queued",
          metadata: { publisher: "mock-v1" },
        }, { onConflict: "schedule_id,platform", ignoreDuplicates: true });
      if (upsertError) throw upsertError;

      const { data: job, error: jobError } = await supabase
        .from("social_publish_jobs")
        .select("id,status,attempt_count,max_attempts")
        .eq("schedule_id", schedule.id)
        .eq("platform", platform)
        .single();
      if (jobError) throw jobError;
      if (job.status === "succeeded") continue;
      if (job.attempt_count >= job.max_attempts) {
        await supabase.from("social_publish_jobs").update({ status: "failed", last_error: "Maximum publish attempts reached." }).eq("id", job.id);
        throw new Error(`${platform} publish attempts exhausted.`);
      }

      const nextAttempt = Number(job.attempt_count || 0) + 1;
      await supabase.from("social_publish_jobs").update({
        status: "running",
        attempt_count: nextAttempt,
        started_at: now,
        last_error: null,
      }).eq("id", job.id);

      try {
        const result = await mockPublish(post, platform);
        const { error: successError } = await supabase.from("social_publish_jobs").update({
          status: "succeeded",
          external_post_id: result.externalPostId,
          completed_at: new Date().toISOString(),
          next_attempt_at: null,
          last_error: null,
          metadata: { publisher: result.publisher },
        }).eq("id", job.id);
        if (successError) throw successError;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabase.from("social_publish_jobs").update({
          status: nextAttempt >= job.max_attempts ? "failed" : "retry_scheduled",
          last_error: message,
          next_attempt_at: nextAttempt >= job.max_attempts ? null : new Date(Date.now() + 60_000 * nextAttempt).toISOString(),
        }).eq("id", job.id);
        await supabase.from("social_schedules").update({ status: "pending", claimed_at: null, last_error: message }).eq("id", schedule.id);
        throw error;
      }
    }

    const completedAt = new Date().toISOString();
    const { error: scheduleCompleteError } = await supabase.from("social_schedules").update({
      status: "completed",
      completed_at: completedAt,
      last_error: null,
    }).eq("id", schedule.id);
    if (scheduleCompleteError) throw scheduleCompleteError;

    const { error: postCompleteError } = await supabase.from("social_posts").update({
      status: "published",
      published_at: completedAt,
    }).eq("organization_id", schedule.organization_id).eq("id", post.id);
    if (postCompleteError) throw postCompleteError;

    return { scheduleId: schedule.id, postId: post.id, platforms, publishedAt: completedAt, publisher: "mock-v1" };
  },
});

export const fluxSocialScheduler = schedules.task({
  id: "flux-social-scheduler",
  cron: "*/5 * * * *",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 120,
  run: async () => {
    const supabase = createSocialAdminClient();
    const now = new Date().toISOString();
    const { data: dueSchedules, error } = await supabase
      .from("social_schedules")
      .select("id,organization_id,post_id,status,scheduled_for")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(20);

    if (error) throw error;
    let queued = 0;

    for (const rawSchedule of dueSchedules || []) {
      const schedule = rawSchedule as ScheduledPost;
      const { data: claimed, error: claimError } = await supabase
        .from("social_schedules")
        .update({ status: "claimed", claimed_at: now, last_error: null })
        .eq("id", schedule.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (claimError) throw claimError;
      if (!claimed) continue;

      try {
        await fluxSocialPublishPost.trigger({ scheduleId: schedule.id });
        queued += 1;
      } catch (triggerError) {
        const message = triggerError instanceof Error ? triggerError.message : String(triggerError);
        await supabase.from("social_schedules").update({ status: "pending", claimed_at: null, last_error: message }).eq("id", schedule.id);
        throw triggerError;
      }
    }

    logger.info("Flux Social scheduler sweep complete", { due: dueSchedules?.length || 0, queued, checkedAt: now });
    return { due: dueSchedules?.length || 0, queued, checkedAt: now };
  },
});
