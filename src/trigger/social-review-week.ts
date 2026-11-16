import { logger, schedules, task } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareSocialReviewWeek } from "@/lib/social-weekly-plan";
import { socialWeekStart } from "@/lib/social-week";
import { runMetaAnalyticsSync } from "@/lib/social-meta-sync";

const organizationId = "15046426-e520-438b-8694-7662a6986efb";
const brandId = "a330b65a-d5b2-45f3-b211-451616f2fa8d";

// Deliberately scoped to Fluxknight, with no publish or customer messaging task.
export const fluxSocialPrepareReviewWeek = task({
  id: "flux-social-prepare-review-week",
  queue: { concurrencyLimit: 1 },
  maxDuration: 900,
  retry: { maxAttempts: 2 },
  run: async () => {
    const supabase = createAdminClient();
    const { data: brand, error } = await supabase.from("social_brands").select("metadata")
      .eq("organization_id", organizationId).eq("id", brandId).single();
    if (error) throw error;
    if (brand.metadata?.weekly_review_enabled !== true) return { skipped: true, reason: "weekly_review_disabled" };
    const { data: organization, error: organizationError } = await supabase.from("organizations").select("status").eq("id", organizationId).single();
    if (organizationError) throw organizationError;
    if (organization.status !== "active") return { skipped: true, reason: "organization_inactive" };
    try {
      const metrics = await runMetaAnalyticsSync({ supabase, organizationId, brandId });
      logger.info("Weekly review metrics collected", { collected: metrics.collected, status: metrics.ingestion.status });
    } catch (error) {
      // A provider outage must not prevent review drafts; stale data is not new evidence.
      logger.warn("Weekly metrics refresh unavailable; using existing snapshots", { error: error instanceof Error ? error.message : String(error) });
    }
    return prepareSocialReviewWeek(supabase, organizationId, socialWeekStart(), brandId);
  },
});

export const fluxSocialMondayReview = schedules.task({
  id: "flux-social-monday-review",
  cron: { pattern: "0 7 * * 1", timezone: "UTC", environments: ["PRODUCTION"] },
  run: async () => fluxSocialPrepareReviewWeek.trigger(),
});
