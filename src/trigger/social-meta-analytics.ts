import { createClient } from "@supabase/supabase-js";
import { logger, schedules, task } from "@trigger.dev/sdk";
import { collectMetaAnalytics, metaConfigFromEnvironment, metaConfigFromIntegration } from "@/lib/social-meta-analytics";
import { ingestSocialMetricBatch } from "@/lib/social-metric-ingestion";
import { buildSocialLearningSnapshot } from "@/lib/social-learning";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";

function createSocialAdminClient() {
  const url = process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ACTIVE_SUPABASE_URL;
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Flux Social Meta analytics requires a Supabase service-role key in Trigger.dev.");
  return createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveMetaConfig(supabase: ReturnType<typeof createSocialAdminClient>, organizationId: string) {
  try {
    return await metaConfigFromIntegration(supabase, organizationId);
  } catch (error) {
    if (process.env.META_ACCESS_TOKEN) {
      logger.warn("Using temporary Meta environment fallback because no dashboard integration credential is available.", {
        organizationId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return metaConfigFromEnvironment();
    }
    throw error;
  }
}

async function runMetaCollection(input: { organizationId: string; brandId: string }) {
  const supabase = createSocialAdminClient();
  const config = await resolveMetaConfig(supabase, input.organizationId);
  const collected = await collectMetaAnalytics({ supabase, organizationId: input.organizationId, brandId: input.brandId, config });
  const ingestion = await ingestSocialMetricBatch({
    supabase,
    organizationId: input.organizationId,
    brandId: input.brandId,
    provider: "meta",
    postSamples: collected.postSamples,
    accountSamples: collected.accountSamples,
    metadata: { source: "meta_graph_api", captured_at: collected.capturedAt },
  });

  let learning: unknown = null;
  if (ingestion.status === "succeeded" || ingestion.status === "partial") {
    learning = await buildSocialLearningSnapshot({ supabase, organizationId: input.organizationId, brandId: input.brandId });
  }

  logger.info("Flux Social Meta analytics collection finished", {
    organizationId: input.organizationId,
    brandId: input.brandId,
    postSamples: collected.postSamples.length,
    accountSamples: collected.accountSamples.length,
    ingestionStatus: ingestion.status,
  });

  return { ingestion, learning };
}

export const fluxSocialMetaAnalytics = task({
  id: "flux-social-meta-analytics",
  maxDuration: 300,
  retry: { maxAttempts: 3, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (payload: { organizationId: string; brandId: string }) => runMetaCollection(payload),
});

export const fluxSocialMetaAnalyticsSchedule = schedules.task({
  id: "flux-social-meta-analytics-schedule",
  cron: "15 */6 * * *",
  maxDuration: 300,
  run: async () => {
    const organizationId = process.env.FLUX_SOCIAL_ORGANIZATION_ID;
    const brandId = process.env.FLUX_SOCIAL_BRAND_ID;
    if (!organizationId || !brandId) {
      logger.warn("Skipping scheduled Meta analytics collection because Flux Social tenant identifiers are not configured.");
      return { skipped: true };
    }
    return runMetaCollection({ organizationId, brandId });
  },
});
