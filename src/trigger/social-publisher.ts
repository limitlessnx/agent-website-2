import { createClient } from "@supabase/supabase-js";
import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import {
  metaPublisherConfigFromIntegration,
  publishMetaPost,
  type MetaPublishAsset,
} from "@/lib/social-meta-publisher";

import { DAILY_SOURCE, DAILY_BRAND, DAILY_ORGANIZATION, dailyPolicy, eligibleDailyPost, lagosDay, sameApproval, type DailyPost } from "@/lib/social-daily-policy";
import {REALTY_SOCIAL_ORGANIZATION,REALTY_SOCIAL_PROFILE,REALTY_SOCIAL_SCHEDULE_SOURCE} from "@/lib/social-real-estate-policy";

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
  approved_at: string | null;
  published_at: string | null;
  content: Record<string, unknown>;
  created_at: string;
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
  const value = Number(asset.metadata?.position ?? asset.metadata?.carousel_index);
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

    if (!Number.isFinite(Date.parse(schedule.scheduled_for))) throw new AbortTaskRunError("Invalid publication time.");
    if (Date.parse(schedule.scheduled_for) > Date.now()) return { scheduleId: schedule.id, skipped: true, reason: "not_due" };
    const automatic = schedule.metadata?.source === DAILY_SOURCE;
    const explicitRealty = schedule.metadata?.source === REALTY_SOCIAL_SCHEDULE_SOURCE;
    const guardedDelivery = automatic || explicitRealty;
    if(explicitRealty&&schedule.organization_id!==REALTY_SOCIAL_ORGANIZATION)throw new AbortTaskRunError("Real estate schedules must belong to Limitless Realty.");
    if(explicitRealty&&schedule.status!=="claimed")return {scheduleId:schedule.id,skipped:true,reason:"explicit_schedule_not_claimed"};

    const { data: rawPost, error: postError } = await supabase
      .from("social_posts")
      .select(
        "id,organization_id,brand_id,title,caption,format,status,platforms,metadata,approved_at,published_at,content,created_at",
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

    if (automatic) {
      if (schedule.organization_id !== DAILY_ORGANIZATION || post.brand_id !== DAILY_BRAND) throw new AbortTaskRunError("Automatic publishing is scoped to Fluxknight only.");
      const [{ data: brand, error: brandError }, { data: organization, error: organizationError }] = await Promise.all([
        supabase.from("social_brands").select("metadata").eq("organization_id", DAILY_ORGANIZATION).eq("id", DAILY_BRAND).single(),
        supabase.from("organizations").select("status").eq("id", DAILY_ORGANIZATION).single(),
      ]);
      if (brandError) throw brandError;
      if (organizationError) throw organizationError;
      const policy = dailyPolicy(brand.metadata || {});
      if (!policy || organization.status !== "active") throw new AbortTaskRunError("Automatic publishing is disabled for this brand or organization.");
      if (lagosDay(new Date(schedule.scheduled_for)) !== lagosDay(new Date())) throw new AbortTaskRunError("Missed daily slots must be rescheduled, not published in a catch-up burst.");
      if (!eligibleDailyPost(post as DailyPost, policy) || !sameApproval(post as DailyPost, schedule)) throw new AbortTaskRunError("The approved media or approval snapshot changed. Return this post to Review.");
    }
    if(schedule.organization_id===REALTY_SOCIAL_ORGANIZATION){
      const [{data:brand,error:brandError},{data:organization,error:organizationError}]=await Promise.all([
        supabase.from("social_brands").select("metadata").eq("organization_id",schedule.organization_id).eq("id",post.brand_id).single(),
        supabase.from("organizations").select("status").eq("id",schedule.organization_id).single(),
      ]);
      if(brandError)throw brandError;if(organizationError)throw organizationError;
      if(schedule.metadata?.source!==REALTY_SOCIAL_SCHEDULE_SOURCE||brand?.metadata?.strategy_profile!==REALTY_SOCIAL_PROFILE||organization?.status!=="active"||!post.approved_at||post.published_at||!sameApproval(post as DailyPost,schedule))throw new AbortTaskRunError("Limitless Realty requires a current explicit schedule and unchanged human approval.");
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
    const availableAssets = (rawAssets || []) as SocialAssetRow[];
    const activeCarouselIds = stringArray(post.metadata?.carousel_asset_ids);
    if (post.format === "carousel" && activeCarouselIds.length < 2) {
      throw new Error("Carousel has no approved active slide set. Return it to Review.");
    }
    // Regenerations may leave old slide objects in storage for rollback. Publish
    // only the slide IDs attached to the approved post, in their planned order.
    const selectedAssets = post.format === "carousel"
      ? availableAssets.filter((asset) => activeCarouselIds.includes(asset.id))
      : ["reel", "video"].includes(post.format)
        ? availableAssets.filter((asset) => asset.id === post.metadata?.reel_asset_id)
        : ["image", "story"].includes(post.format)
          ? availableAssets.filter((asset) => asset.id === post.metadata?.primary_asset_id)
          : availableAssets;
    const assets = normalizeAssets(selectedAssets);
    if (post.format === "carousel" && assets.length !== activeCarouselIds.length) {
      throw new Error("The approved carousel slide set is incomplete; refusing to publish stale slides.");
    }

    if (["reel", "video", "image"].includes(post.format) && assets.length !== 1) throw new AbortTaskRunError("The approved active media asset is unavailable.");

    let metaConfig;
    try { metaConfig=await metaPublisherConfigFromIntegration(supabase,schedule.organization_id); }
    catch(error){
      if(explicitRealty){await supabase.from("social_schedules").update({status:"failed",last_error:"The organization's Instagram connection is unavailable. Reconnect, review and explicitly schedule again."}).eq("organization_id",schedule.organization_id).eq("id",schedule.id);throw new AbortTaskRunError("Limitless Realty Instagram connection needs attention.");}
      throw error;
    }
    if(explicitRealty&&(!schedule.metadata?.instagram_account_id||schedule.metadata.instagram_account_id!==metaConfig.instagramBusinessAccountId)){
      await supabase.from("social_schedules").update({status:"failed",last_error:"Authorized Instagram account changed. Review and explicitly schedule for the new account."}).eq("organization_id",schedule.organization_id).eq("id",schedule.id);
      throw new AbortTaskRunError("The scheduled Instagram account changed.");
    }

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

      if (guardedDelivery && (job.metadata?.automatic_delivery_started_at || job.metadata?.manual_delivery_started_at)) {
        // A crash or ambiguous provider response may have already published.
        // Do not create a second public post automatically.
        await supabase.from("social_schedules").update({ status: "failed", last_error: "A previous delivery started. Check Instagram before retrying to avoid a duplicate." }).eq("id", schedule.id);
        throw new AbortTaskRunError("Previous automatic delivery requires reconciliation before another attempt.");
      }
      const nextAttempt = Number(job.attempt_count || 0) + 1;
      const runningQuery = supabase
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
            ...(automatic ? { automatic_delivery_started_at: now } : {}),
            ...(explicitRealty ? { manual_delivery_started_at: now } : {}),
          },
        })
        .eq("id", job.id).eq("status", job.status).eq("attempt_count", job.attempt_count)
        .select("id").maybeSingle();
      const { data: running, error: runningError } = await runningQuery;
      if (runningError) throw runningError;
      if (!running) throw new AbortTaskRunError("Publish job was already claimed.");

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
              guardedDelivery || nextAttempt >= job.max_attempts
                ? "failed"
                : "retry_scheduled",
            last_error: message,
            next_attempt_at:
              guardedDelivery || nextAttempt >= job.max_attempts
                ? null
                : new Date(
                    Date.now() + 60_000 * nextAttempt,
                  ).toISOString(),
          })
          .eq("id", job.id);

        await supabase
          .from("social_schedules")
          .update({
            status: guardedDelivery ? "failed" : "pending",
            claimed_at: null,
            last_error: message,
          })
          .eq("id", schedule.id);

        if (automatic) throw new AbortTaskRunError(`Automatic delivery stopped: ${message}. Check Instagram before retrying.`);
        if (explicitRealty) throw new AbortTaskRunError("Scheduled delivery stopped. Check Instagram before retrying to avoid a duplicate.");
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
