import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import { ingestSocialMetricBatch, type SocialAccountMetricSample, type SocialPostMetricSample } from "@/lib/social-metric-ingestion";
import { buildSocialLearningSnapshot } from "@/lib/social-learning";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";

function createSocialAdminClient() {
  const url = process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ACTIVE_SUPABASE_URL;
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Flux Social metric ingestion requires a Supabase service-role key in Trigger.dev.");
  return createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const fluxSocialMetricIngestion = task({
  id: "flux-social-metric-ingestion",
  maxDuration: 300,
  retry: { maxAttempts: 3, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (payload: {
    organizationId: string;
    brandId?: string;
    provider: string;
    postSamples?: SocialPostMetricSample[];
    accountSamples?: SocialAccountMetricSample[];
    metadata?: Record<string, unknown>;
    refreshLearning?: boolean;
  }) => {
    const supabase = createSocialAdminClient();
    const result = await ingestSocialMetricBatch({
      supabase,
      organizationId: payload.organizationId,
      brandId: payload.brandId || null,
      provider: payload.provider,
      postSamples: payload.postSamples,
      accountSamples: payload.accountSamples,
      metadata: payload.metadata,
    });

    let learning: unknown = null;
    if (payload.refreshLearning !== false && payload.brandId && result.status !== "failed" && result.status !== "skipped") {
      learning = await buildSocialLearningSnapshot({
        supabase,
        organizationId: payload.organizationId,
        brandId: payload.brandId,
      });
    }

    logger.info("Flux Social metric ingestion finished", {
      organizationId: payload.organizationId,
      brandId: payload.brandId,
      provider: payload.provider,
      status: result.status,
      rowsReceived: result.rowsReceived,
    });

    return { ...result, learning };
  },
});
