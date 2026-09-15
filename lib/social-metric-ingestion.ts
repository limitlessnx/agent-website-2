import type { SupabaseClient } from "@supabase/supabase-js";

export type SocialMetricPlatform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "x" | "other";

export type SocialPostMetricSample = {
  postId: string;
  platform: SocialMetricPlatform;
  capturedAt: string;
  externalSnapshotKey: string;
  impressions?: number;
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  profileVisits?: number;
  followersGained?: number;
  watchTimeMs?: number;
  averageWatchTimeMs?: number;
  conversions?: number;
  revenueAttributed?: number;
  metadata?: Record<string, unknown>;
};

export type SocialAccountMetricSample = {
  brandId: string;
  platform: SocialMetricPlatform;
  capturedAt: string;
  externalSnapshotKey: string;
  followers?: number;
  following?: number;
  profileViews?: number;
  impressions?: number;
  reach?: number;
  engagements?: number;
  websiteClicks?: number;
  metadata?: Record<string, unknown>;
};

const num = (value: number | undefined) => Number.isFinite(value) ? Number(value) : 0;

export async function ingestSocialMetricBatch(input: {
  supabase: SupabaseClient;
  organizationId: string;
  brandId?: string | null;
  provider: string;
  postSamples?: SocialPostMetricSample[];
  accountSamples?: SocialAccountMetricSample[];
  metadata?: Record<string, unknown>;
}) {
  const postSamples = input.postSamples || [];
  const accountSamples = input.accountSamples || [];
  const received = postSamples.length + accountSamples.length;

  const { data: run, error: runError } = await input.supabase.from("social_metric_ingestion_runs").insert({
    organization_id: input.organizationId,
    brand_id: input.brandId || null,
    provider: input.provider,
    status: received === 0 ? "skipped" : "running",
    rows_received: received,
    metadata: input.metadata || {},
    completed_at: received === 0 ? new Date().toISOString() : null,
  }).select("id").single();
  if (runError) throw runError;
  if (received === 0) return { runId: run.id, status: "skipped", rowsReceived: 0 };

  const failures: Array<{ scope: string; key: string; message: string }> = [];
  let postRows = 0;
  let accountRows = 0;

  for (const sample of postSamples) {
    try {
      const { data: post, error: postError } = await input.supabase.from("social_posts").select("id,brand_id").eq("organization_id", input.organizationId).eq("id", sample.postId).maybeSingle();
      if (postError) throw postError;
      if (!post) throw new Error("Unknown social post for this organization.");
      if (input.brandId && post.brand_id !== input.brandId) throw new Error("Social post belongs to another brand.");

      const { error } = await input.supabase.from("social_post_metrics").upsert({
        organization_id: input.organizationId,
        post_id: sample.postId,
        platform: sample.platform,
        source: "platform_api",
        captured_at: sample.capturedAt,
        external_snapshot_key: sample.externalSnapshotKey,
        impressions: num(sample.impressions), reach: num(sample.reach), views: num(sample.views),
        likes: num(sample.likes), comments: num(sample.comments), shares: num(sample.shares), saves: num(sample.saves), clicks: num(sample.clicks),
        profile_visits: num(sample.profileVisits), followers_gained: num(sample.followersGained), watch_time_ms: num(sample.watchTimeMs),
        average_watch_time_ms: num(sample.averageWatchTimeMs), conversions: num(sample.conversions), revenue_attributed: num(sample.revenueAttributed),
        metadata: { ...(sample.metadata || {}), provider: input.provider },
      }, { onConflict: "organization_id,platform,external_snapshot_key" });
      if (error) throw error;
      postRows += 1;
    } catch (error) {
      failures.push({ scope: "post", key: sample.externalSnapshotKey, message: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const sample of accountSamples) {
    try {
      const { data: brand, error: brandError } = await input.supabase.from("social_brands").select("id").eq("organization_id", input.organizationId).eq("id", sample.brandId).maybeSingle();
      if (brandError) throw brandError;
      if (!brand) throw new Error("Unknown social brand for this organization.");
      const { error } = await input.supabase.from("social_account_metrics").upsert({
        organization_id: input.organizationId,
        brand_id: sample.brandId,
        platform: sample.platform,
        source: "platform_api",
        captured_at: sample.capturedAt,
        external_snapshot_key: sample.externalSnapshotKey,
        followers: num(sample.followers), following: num(sample.following), profile_views: num(sample.profileViews),
        impressions: num(sample.impressions), reach: num(sample.reach), engagements: num(sample.engagements), website_clicks: num(sample.websiteClicks),
        metadata: { ...(sample.metadata || {}), provider: input.provider },
      }, { onConflict: "organization_id,platform,external_snapshot_key" });
      if (error) throw error;
      accountRows += 1;
    } catch (error) {
      failures.push({ scope: "account", key: sample.externalSnapshotKey, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const status = failures.length === 0 ? "succeeded" : (postRows + accountRows > 0 ? "partial" : "failed");
  const { error: finalError } = await input.supabase.from("social_metric_ingestion_runs").update({
    status,
    post_rows_upserted: postRows,
    account_rows_upserted: accountRows,
    error_count: failures.length,
    errors: failures,
    completed_at: new Date().toISOString(),
  }).eq("id", run.id);
  if (finalError) throw finalError;
  return { runId: run.id, status, rowsReceived: received, postRowsUpserted: postRows, accountRowsUpserted: accountRows, failures };
}
