import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import { runMetaAnalyticsSync } from "@/lib/social-meta-sync";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";

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
      "Flux Social Meta analytics requires a Supabase service-role key in Trigger.dev.",
    );
  }

  return createClient(url.replace(/\/$/, ""), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function runMetaCollection(input: {
  organizationId: string;
  brandId: string;
}) {
  const supabase = createSocialAdminClient();
  const result = await runMetaAnalyticsSync({
    supabase,
    organizationId: input.organizationId,
    brandId: input.brandId,
  });

  logger.info("Flux Social Meta analytics collection finished", {
    organizationId: input.organizationId,
    brandId: input.brandId,
    postSamples: result.collected.postSamples,
    accountSamples: result.collected.accountSamples,
    ingestionStatus: result.ingestion.status,
  });

  return result;
}

export const fluxSocialMetaAnalytics = task({
  id: "flux-social-meta-analytics",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 60_000,
    factor: 2,
  },
  run: async (payload: { organizationId: string; brandId: string }) =>
    runMetaCollection(payload),
});
