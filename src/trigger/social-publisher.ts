import { createClient } from "@supabase/supabase-js";
import { logger, schedules, task } from "@trigger.dev/sdk";
import {
  metaPublisherConfigFromIntegration,
  publishMetaPost,
  type MetaPublishAsset,
} from "@/lib/social-meta-publisher";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const META_PLATFORMS = new Set(["instagram"]);

type ScheduledPost = {
  id: string;
  organization_id: string;
  post_id: string;
  status: string;
  scheduled_for: string;
  metadata: Record<string, unknown>;
};

type SocialPost = {
  id: string;
  organization_id: string;
  brand_id: string;
  title: string;
  caption: string;
  format: string;
  status: string;
  platforms: string[];
  metadata: Record<string, unknown>;
};

type SocialAssetRow = {
  id: string;
  asset_type: string;
  mime_type: string | null;
  bucket_id: string;
  storage_path: string;
  status: string;
  metadata: Record<string, unknown>;
};

function createSocialAdminClient() {
  const url =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ACTIVE_SUPABASE_URL;
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Flux Social requires a Supabase service-role key in Trigger.dev environment variables.",
    );
  }

  return createClient(url.replace(/\/$/, ""), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function publishTargets(schedule: ScheduledPost, post: SocialPost) {
  const scheduledTargets = stringArray(schedule.metadata?.publish_platforms);
  const targets = scheduledTargets.length ? scheduledTargets : post.platforms;
  return targets.filter((platform) => META_PLATFORMS.has(platform));
}

function assetPosition(asset: SocialAssetRow) {
  const value = Number(asset.metadata?.position);
  return Number.isFinite(value) ? value : 0;
}

function normalizeAssets(rows: SocialAssetRow[]): MetaPublishAsset[] {
  return rows
    .filter((asset) => asset.status === "ready")
    .map((asset) => ({
      id: asset.id,
      assetType: asset.asset_type,
      mimeType: asset.mime_type,
      bucketId: asset.bucket_id,
      storagePath: asset.storage_path,
      position: assetPosition(asset),
    }))
    .sort((a, b) => a.position - b.position);
}

async function upsertPlatformRef(input: {
  supabase: ReturnType<typeof createSocialAdminClient>;
  post: SocialPost;
  result: Awaited<ReturnType<typeof publishMetaPost>>;
}) {
  const { error } = await input.supabase
    .from("social_post_platform_refs")
    .upsert(
      {
        organization_id: input.post.organization_id,
        brand_id: input.post.brand_id,
        post_id: input.post.id,
        platform: input.result.platform,
        external_post_id: input.result.externalPostId,
        external_account_id: input.result.externalAccountId,
        published_url: input.result.publishedUrl,
        metadata: {
          provider: input.result.provider,
          ...input.result.metadata,
        },
      },
      { onConflict: "post_id,platform" },
    );

  if (error) throw error;
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
  maxDuration: 600,
  run: async (payload: { scheduleId: string }) => {
    const supabase = createSocialAdminClient();
    const now = new Date().toISOString();

    const { data: rawSchedule, error: scheduleError } = await supabase
      .from("social_schedules")
      .select("id,organization_id,post_id,status,scheduled_for,metadata")
      .eq("id", payload.scheduleId)
      .single();

    if (scheduleError) throw scheduleError;
    const schedule = rawSchedule as ScheduledPost;

    if (schedule.status === "completed" || schedule.status === "cancelled") {
      return {
        scheduleId: schedule.id,
        skipped: true,
        reason: schedule.status,
      };
    }

    const { data: rawPost, error: postError } = await supabase
      .from("social_posts")
      .select(
        "id,organization_id,brand_id,title,caption,format,status,platforms,metadata",
      )
      .eq("organization_id", schedule.organization_id)
      .eq("id", schedule.post_id)
      .single();

    if (postError) throw postError;
    const post = rawPost as SocialPost;

    if (post.status !== "scheduled") {
      await supabase
        .from("social_schedules")
        .update({
          status: "failed",
          last_error: `Post is ${post.status}, expected scheduled.`,
        })
        .eq("id", schedule.id);

      return {
        scheduleId: schedule.id,
        skipped: true,
        reason: `post_${post.status}`,
      };
    }

    const platforms = publishTargets(schedule, post);
    if (!platforms.length) {
      await supabase
        .from("social_schedules")
        .update({
          status: "failed",
          last_error: "No Instagram publishing target selected.",
        })
        .eq("id", schedule.id);
      throw new Error("No Instagram publishing target selected.");
    }

    const { data: rawAssets, error: assetError } = await supabase
      .from("social_assets")
      .select(
        "id,asset_type,mime_type,bucket_id,storage_path,status,metadata",
      )
      .eq("organization_id", schedule.organization_id)
      .eq("post_id", post.id)
      .eq("status", "ready");

    if (assetError) throw assetError;
    const assets = normalizeAssets((rawAssets || []) as SocialAssetRow[]);

    const metaConfig = await metaPublisherConfigFromIntegration(
      supabase,
      schedule.organization_id,
    );

    for (const platform of platforms) {
      const { error: upsertError } = await supabase
        .from("social_publish_jobs")
        .upsert(
          {
            organization_id: schedule.organization_id,
            post_id: post.id,
            schedule_id: schedule.id,
            platform,
            status: "queued",
            metadata: { publisher: "meta-graph-api" },
          },
          { onConflict: "schedule_id,platform", ignoreDuplicates: true },
        );

      if (upsertError) throw upsertError;

      const { data: job, error: jobError } = await supabase
        .from("social_publish_jobs")
        .select(
          "id,status,attempt_count,max_attempts,external_post_id,metadata",
        )
        .eq("schedule_id", schedule.id)
        .eq("platform", platform)
        .single();

      if (jobError) throw jobError;
      if (job.status === "succeeded") continue;

      if (job.attempt_count >= job.max_attempts) {
        await supabase
          .from("social_publish_jobs")
          .update({
            status: "failed",
            last_error: "Maximum publish attempts reached.",
          })
          .eq("id", job.id);
        throw new Error(`${platform} publish attempts exhausted.`);
      }

      const nextAttempt = Number(job.attempt_count || 0) + 1;
      await supabase
        .from("social_publish_jobs")
        .update({
          status: "running",
          attempt_count: nextAttempt,
          started_at: now,
          last_error: null,
          metadata: {
            ...(job.metadata || {}),
            publisher: "meta-graph-api",
            attempt: nextAttempt,
          },
        })
        .eq("id", job.id);

      try {
        const result = await publishMetaPost({
          supabase,
          config: metaConfig,
          post: {
            id: post.id,
            organizationId: post.organization_id,
            brandId: post.brand_id,
            title: post.title,
            caption: post.caption,
            format: post.format,
          },
          platform: platform as "facebook" | "instagram",
          assets,
        });

        await upsertPlatformRef({ supabase, post, result });

        const { error: successError } = await supabase
          .from("social_publish_jobs")
          .update({
            status: "succeeded",
            external_post_id: result.externalPostId,
            completed_at: new Date().toISOString(),
            next_attempt_at: null,
            last_error: null,
            metadata: {
              publisher: result.provider,
              external_account_id: result.externalAccountId,
              published_url: result.publishedUrl,
              ...result.metadata,
            },
          })
          .eq("id", job.id);

        if (successError) throw successError;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        await supabase
          .from("social_publish_jobs")
          .update({
            status:
              nextAttempt >= job.max_attempts
                ? "failed"
                : "retry_scheduled",
            last_error: message,
            next_attempt_at:
              nextAttempt >= job.max_attempts
                ? null
                : new Date(
                    Date.now() + 60_000 * nextAttempt,
                  ).toISOString(),
          })
          .eq("id", job.id);

        await supabase
          .from("social_schedules")
          .update({
            status: "pending",
            claimed_at: null,
            last_error: message,
          })
          .eq("id", schedule.id);

        throw error;
      }
    }

    const { data: remainingJobs, error: remainingError } = await supabase
      .from("social_publish_jobs")
      .select("platform,status")
      .eq("schedule_id", schedule.id)
      .in("platform", platforms);

    if (remainingError) throw remainingError;

    const incomplete = (remainingJobs || []).filter(
      (job) => job.status !== "succeeded",
    );

    if (incomplete.length) {
      throw new Error(
        `Meta publishing incomplete: ${incomplete
          .map((job) => `${job.platform} ${job.status}`)
          .join(", ")}.`,
      );
    }

    const completedAt = new Date().toISOString();

    const { error: scheduleCompleteError } = await supabase
      .from("social_schedules")
      .update({
        status: "completed",
        completed_at: completedAt,
        last_error: null,
        metadata: {
          ...(schedule.metadata || {}),
          publish_platforms: platforms,
          publisher: "meta-graph-api",
        },
      })
      .eq("id", schedule.id);

    if (scheduleCompleteError) throw scheduleCompleteError;

    const { error: postCompleteError } = await supabase
      .from("social_posts")
      .update({
        status: "published",
        published_at: completedAt,
        metadata: {
          ...(post.metadata || {}),
          published_platforms: platforms,
          publisher: "meta-graph-api",
        },
      })
      .eq("organization_id", schedule.organization_id)
      .eq("id", post.id);

    if (postCompleteError) throw postCompleteError;

    logger.info("Flux Social Meta publish completed", {
      scheduleId: schedule.id,
      postId: post.id,
      platforms,
      publishedAt: completedAt,
    });

    return {
      scheduleId: schedule.id,
      postId: post.id,
      platforms,
      publishedAt: completedAt,
      publisher: "meta-graph-api",
    };
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
      .select("id,organization_id,post_id,status,scheduled_for,metadata")
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
        .update({
          status: "claimed",
          claimed_at: now,
          last_error: null,
        })
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
        const message =
          triggerError instanceof Error
            ? triggerError.message
            : String(triggerError);

        await supabase
          .from("social_schedules")
          .update({
            status: "pending",
            claimed_at: null,
            last_error: message,
          })
          .eq("id", schedule.id);

        throw triggerError;
      }
    }

    logger.info("Flux Social scheduler sweep complete", {
      due: dueSchedules?.length || 0,
      queued,
      checkedAt: now,
    });

    return {
      due: dueSchedules?.length || 0,
      queued,
      checkedAt: now,
    };
  },
});
