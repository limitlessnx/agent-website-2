import {refreshRealtyWeekStatus} from "@/lib/social-realty-week-status";
import {REALTY_SOCIAL_ORGANIZATION,isRealtySocialBrand} from "@/lib/social-real-estate-policy";
import {validSocialWeek} from "@/lib/social-week";
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
  run: async (payload?:{organizationId?:string;brandId?:string;weekStart?:string;manual?:boolean}) => {
    const supabase = createAdminClient();
    if(payload?.organizationId && payload.organizationId!==organizationId && payload.organizationId!==REALTY_SOCIAL_ORGANIZATION)throw Error("Unsupported review workspace.");
    if(payload?.organizationId===REALTY_SOCIAL_ORGANIZATION){
      const brand=await supabase.from("social_brands").select("*").eq("organization_id",REALTY_SOCIAL_ORGANIZATION).eq("id",payload.brandId||"").single();
      if(brand.error)throw brand.error;
      if(!isRealtySocialBrand(brand.data))throw Error("Realty content strategy is not configured.");
      if(!payload.manual&&brand.data.metadata?.weekly_review_enabled!==true)return{skipped:true,reason:"weekly_review_disabled"};
      const org=await supabase.from("organizations").select("status").eq("id",REALTY_SOCIAL_ORGANIZATION).single();
      if(org.error)throw org.error;if(org.data?.status!=="active")return{skipped:true,reason:"organization_inactive"};
      const week=payload.weekStart||socialWeekStart();if(!validSocialWeek(week))throw Error("Choose a valid starting Monday.");
      const record=await supabase.from("social_weekly_runs").upsert({organization_id:REALTY_SOCIAL_ORGANIZATION,brand_id:brand.data.id,week_start:week,status:"planning",last_error:null,started_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"organization_id,brand_id,week_start"});
      if(record.error)throw record.error;
      try{
        const result=await prepareSocialReviewWeek(supabase,REALTY_SOCIAL_ORGANIZATION,week,brand.data.id);
        await refreshRealtyWeekStatus(supabase,REALTY_SOCIAL_ORGANIZATION,brand.data.id,week);
        return result;
      }catch(error){
        await supabase.from("social_weekly_runs").update({status:"failed",last_error:error instanceof Error?error.message.slice(0,240):"Weekly preparation failed. Retry without changing the saved drafts.",updated_at:new Date().toISOString()}).eq("organization_id",REALTY_SOCIAL_ORGANIZATION).eq("brand_id",brand.data.id).eq("week_start",week);
        throw error;
      }
    }

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
  run: async () => {
    const existing=await fluxSocialPrepareReviewWeek.trigger({});
    // Reuse the existing Monday schedule. This opt-in only prepares review media.
    try{
      const db=createAdminClient();const brand=await db.from("social_brands").select("id,organization_id,metadata").eq("organization_id",REALTY_SOCIAL_ORGANIZATION).eq("slug","limitless-realty").maybeSingle();
      if(brand.error)throw brand.error;
      if(isRealtySocialBrand(brand.data)&&brand.data?.metadata?.weekly_review_enabled===true)await fluxSocialPrepareReviewWeek.trigger({organizationId:REALTY_SOCIAL_ORGANIZATION,brandId:brand.data.id});
    }catch(error){logger.error("Realty weekly preparation needs attention",{message:error instanceof Error?error.message:"Weekly preparation unavailable"});}
    return existing;
  },
});
