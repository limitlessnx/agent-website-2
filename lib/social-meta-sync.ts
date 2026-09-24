import type { SupabaseClient } from "@supabase/supabase-js";
import { collectMetaAnalytics, metaConfigFromIntegration } from "@/lib/social-meta-analytics";
import { ingestSocialMetricBatch } from "@/lib/social-metric-ingestion";
import { buildSocialLearningSnapshot } from "@/lib/social-learning";

export async function runMetaAnalyticsSync(input: {
  supabase: SupabaseClient;
  organizationId: string;
  brandId: string;
}) {
  const config = await metaConfigFromIntegration(
    input.supabase,
    input.organizationId,
  );

  const collected = await collectMetaAnalytics({
    supabase: input.supabase,
    organizationId: input.organizationId,
    brandId: input.brandId,
    config,
  });

  const ingestion = await ingestSocialMetricBatch({
    supabase: input.supabase,
    organizationId: input.organizationId,
    brandId: input.brandId,
    provider: "meta",
    postSamples: collected.postSamples,
    accountSamples: collected.accountSamples,
    metadata: {
      source: "meta_graph_api",
      captured_at: collected.capturedAt,
      api_version: config.apiVersion,
    },
  });

  let learning: unknown = null;
  if (ingestion.status === "succeeded" || ingestion.status === "partial") {
    learning = await buildSocialLearningSnapshot({
      supabase: input.supabase,
      organizationId: input.organizationId,
      brandId: input.brandId,
    });
  }

  return {
    ingestion,
    learning,
    collected: {
      capturedAt: collected.capturedAt,
      postSamples: collected.postSamples.length,
      accountSamples: collected.accountSamples.length,
    },
  };
}
