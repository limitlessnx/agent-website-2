import { createClient } from "@supabase/supabase-js";
import { logger, schedules, task } from "@trigger.dev/sdk";
import { buildSocialLearningSnapshot } from "@/lib/social-learning";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";

function createSocialAdminClient() {
  const url = process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ACTIVE_SUPABASE_URL;
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Flux Social learning requires a Supabase service-role key in Trigger.dev.");
  return createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const fluxSocialLearningSnapshot = task({
  id: "flux-social-learning-snapshot",
  maxDuration: 300,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 30_000, factor: 2 },
  run: async (payload: { organizationId: string; brandId: string; sourceWeeklyRunId?: string; lookbackDays?: number }) => {
    const supabase = createSocialAdminClient();
    const snapshot = await buildSocialLearningSnapshot({
      supabase,
      organizationId: payload.organizationId,
      brandId: payload.brandId,
      sourceWeeklyRunId: payload.sourceWeeklyRunId || null,
      lookbackDays: payload.lookbackDays,
    });
    logger.info("Flux Social learning snapshot generated", {
      organizationId: payload.organizationId,
      brandId: payload.brandId,
      snapshotId: snapshot.id,
      status: snapshot.status,
      postSampleCount: snapshot.post_sample_count,
      metricSampleCount: snapshot.metric_sample_count,
    });
    return {
      snapshotId: snapshot.id,
      status: snapshot.status,
      postSampleCount: snapshot.post_sample_count,
      metricSampleCount: snapshot.metric_sample_count,
    };
  },
});

export const fluxSocialLearningCycle = schedules.task({
  id: "flux-social-learning-cycle",
  cron: "30 16 * * 0",
  maxDuration: 600,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async () => {
    const supabase = createSocialAdminClient();
    const { data: brands, error } = await supabase
      .from("social_brands")
      .select("id,organization_id")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const results: Array<{ brandId: string; snapshotId: string; status: string }> = [];
    for (const brand of brands || []) {
      const snapshot = await buildSocialLearningSnapshot({
        supabase,
        organizationId: brand.organization_id,
        brandId: brand.id,
      });
      results.push({ brandId: brand.id, snapshotId: snapshot.id, status: snapshot.status });
    }

    logger.info("Flux Social weekly learning cycle completed", { brands: results.length, results });
    return { brands: results.length, results };
  },
});
