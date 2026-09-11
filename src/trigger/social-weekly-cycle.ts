import { createClient } from "@supabase/supabase-js";
import { logger, schedules, task } from "@trigger.dev/sdk";
import { generateWeeklySocialPlan } from "@/lib/social-ai";
import type { SocialBrand, SocialPostFormat } from "@/lib/social";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";

function createSocialAdminClient() {
  const url = process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ACTIVE_SUPABASE_URL;
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Flux Social weekly automation requires a Supabase service-role key in Trigger.dev.");
  return createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function weekStartUtc(input = new Date()) {
  const day = input.getUTCDay();
  const mondayOffset = day === 0 ? 1 : 1 - day;
  const monday = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate() + mondayOffset));
  return monday.toISOString().slice(0, 10);
}

function generationJobForFormat(format: SocialPostFormat) {
  if (format === "text") return "none" as const;
  if (format === "image" || format === "story") return "static" as const;
  if (format === "carousel") return "carousel" as const;
  return "reel_plan" as const;
}

function summarizeMetricRows(rows: Array<Record<string, unknown>>) {
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = `${String(row.post_id || "")}:${String(row.platform || "")}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].slice(0, 40).map((row) => ({
    post_id: row.post_id,
    platform: row.platform,
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    comments: Number(row.comments || 0),
    shares: Number(row.shares || 0),
    saves: Number(row.saves || 0),
    clicks: Number(row.clicks || 0),
    conversions: Number(row.conversions || 0),
    revenue_attributed: Number(row.revenue_attributed || 0),
  }));
}

export const fluxSocialWeeklyCycle = task({
  id: "flux-social-weekly-cycle",
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 15_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (payload: { organizationId: string; brandId: string; weekStart?: string }) => {
    const supabase = createSocialAdminClient();
    const weekStart = payload.weekStart || weekStartUtc();

    const { data: existingRun, error: existingRunError } = await supabase
      .from("social_weekly_runs")
      .select("id,status,post_ids")
      .eq("organization_id", payload.organizationId)
      .eq("brand_id", payload.brandId)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (existingRunError) throw existingRunError;
    if (existingRun && ["planning", "generating", "review_ready"].includes(existingRun.status)) {
      return { runId: existingRun.id, weekStart, skipped: true, reason: `already_${existingRun.status}`, postIds: existingRun.post_ids || [] };
    }

    const { data: brandRow, error: brandError } = await supabase
      .from("social_brands")
      .select("*")
      .eq("organization_id", payload.organizationId)
      .eq("id", payload.brandId)
      .single();
    if (brandError) throw brandError;
    const brand = brandRow as SocialBrand;

    const [{ data: recentPosts, error: recentPostsError }, { data: metricRows, error: metricsError }] = await Promise.all([
      supabase
        .from("social_posts")
        .select("id,title,caption,format,status,platforms,content,published_at,created_at")
        .eq("organization_id", payload.organizationId)
        .eq("brand_id", payload.brandId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("social_post_metrics")
        .select("post_id,platform,captured_at,impressions,reach,views,likes,comments,shares,saves,clicks,conversions,revenue_attributed")
        .eq("organization_id", payload.organizationId)
        .order("captured_at", { ascending: false })
        .limit(250),
    ]);
    if (recentPostsError) throw recentPostsError;
    if (metricsError) throw metricsError;

    const recentContent = (recentPosts || []).map((post) => ({
      id: post.id,
      title: post.title,
      hook: post.content && typeof post.content === "object" ? (post.content as Record<string, unknown>).hook : null,
      pillar: post.content && typeof post.content === "object" ? (post.content as Record<string, unknown>).content_pillar : null,
      format: post.format,
      status: post.status,
      published_at: post.published_at,
    }));
    const analyticsContext = summarizeMetricRows((metricRows || []) as Array<Record<string, unknown>>);

    const context = {
      recent_content: recentContent,
      analytics: analyticsContext,
      instruction: "Avoid repeating recent hooks, angles and content pillars unless analytics strongly justify a deliberate variation. Prefer specific operational insights. Competitor intelligence will be added to this same context in Phase 3.9.",
    };

    const { data: run, error: runError } = await supabase
      .from("social_weekly_runs")
      .upsert({
        organization_id: payload.organizationId,
        brand_id: payload.brandId,
        week_start: weekStart,
        status: "planning",
        generation_summary: { context, total: 0, queued: 0, skipped: 0, succeeded: 0, failed: 0 },
        started_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "organization_id,brand_id,week_start" })
      .select("id")
      .single();
    if (runError) throw runError;

    try {
      const planningBrand: SocialBrand = {
        ...brand,
        visual_rules: { ...(brand.visual_rules || {}), weekly_context: context },
      };
      const { plan, model } = await generateWeeklySocialPlan(planningBrand);
      const generatedAt = new Date().toISOString();

      const { data: existingPlan, error: existingPlanError } = await supabase
        .from("social_content_plans")
        .select("id")
        .eq("organization_id", payload.organizationId)
        .eq("brand_id", payload.brandId)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (existingPlanError) throw existingPlanError;

      let contentPlanId = existingPlan?.id as string | undefined;
      if (!contentPlanId) {
        const { data: savedPlan, error: planError } = await supabase
          .from("social_content_plans")
          .insert({
            organization_id: payload.organizationId,
            brand_id: payload.brandId,
            week_start: weekStart,
            status: "review",
            strategy: {
              strategy_summary: plan.strategy_summary,
              weekly_objective: plan.weekly_objective,
              audience_angle: plan.audience_angle,
            },
            model,
            generated_at: generatedAt,
            metadata: { source: "flux_social_weekly_cycle", phase: "3.8", post_count: 5, weekly_run_id: run.id },
          })
          .select("id")
          .single();
        if (planError) throw planError;
        contentPlanId = savedPlan.id;
      }

      const postIds: string[] = [];
      const generationJobs: Array<Record<string, unknown>> = [];

      for (let index = 0; index < plan.posts.length; index += 1) {
        const post = plan.posts[index];
        const { data: createdPost, error: postError } = await supabase
          .from("social_posts")
          .insert({
            organization_id: payload.organizationId,
            brand_id: payload.brandId,
            content_plan_id: contentPlanId,
            title: post.title.trim(),
            caption: post.caption.trim(),
            format: post.format,
            status: "review",
            platforms: post.platforms,
            content: {
              source: "ai_content_brain",
              version: 1,
              hook: post.hook.trim(),
              cta: post.cta.trim(),
              content_pillar: post.content_pillar.trim(),
              objective: post.objective.trim(),
              creative_brief: post.creative_brief.trim(),
              weekly_strategy: plan.strategy_summary,
              weekly_objective: plan.weekly_objective,
              audience_angle: plan.audience_angle,
              planned_index: index + 1,
              week_start: weekStart,
            },
            media: [],
            metadata: {
              ai_generated: true,
              model,
              generation_phase: "3.8",
              generated_at: generatedAt,
              weekly_run_id: run.id,
              generation_status: post.format === "text" ? "ready" : "queued",
            },
          })
          .select("id")
          .single();
        if (postError) throw postError;

        postIds.push(createdPost.id);
        const jobType = generationJobForFormat(post.format);
        generationJobs.push({
          organization_id: payload.organizationId,
          weekly_run_id: run.id,
          post_id: createdPost.id,
          job_type: jobType,
          status: jobType === "none" ? "skipped" : "queued",
          metadata: { format: post.format, planned_index: index + 1 },
          completed_at: jobType === "none" ? generatedAt : null,
        });
      }

      const { error: jobsError } = await supabase.from("social_generation_jobs").insert(generationJobs);
      if (jobsError) throw jobsError;

      const queued = generationJobs.filter((job) => job.status === "queued").length;
      const skipped = generationJobs.filter((job) => job.status === "skipped").length;
      const { error: runUpdateError } = await supabase
        .from("social_weekly_runs")
        .update({
          status: queued > 0 ? "generating" : "review_ready",
          post_ids: postIds,
          generation_summary: {
            context,
            strategy: {
              strategy_summary: plan.strategy_summary,
              weekly_objective: plan.weekly_objective,
              audience_angle: plan.audience_angle,
              model,
            },
            total: generationJobs.length,
            queued,
            skipped,
            succeeded: skipped,
            failed: 0,
          },
          completed_at: queued > 0 ? null : generatedAt,
          last_error: null,
        })
        .eq("id", run.id);
      if (runUpdateError) throw runUpdateError;

      logger.info("Flux Social weekly plan generated", { runId: run.id, weekStart, postCount: postIds.length, queuedMediaJobs: queued });
      return { runId: run.id, weekStart, postIds, queuedMediaJobs: queued, status: queued > 0 ? "generating" : "review_ready" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("social_weekly_runs").update({ status: "failed", last_error: message, completed_at: new Date().toISOString() }).eq("id", run.id);
      throw error;
    }
  },
});

export const fluxSocialWeeklyPlanner = schedules.task({
  id: "flux-social-weekly-planner",
  cron: "0 17 * * 0",
  maxDuration: 300,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async () => {
    const supabase = createSocialAdminClient();
    const { data: brands, error } = await supabase
      .from("social_brands")
      .select("id,organization_id,name")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const weekStart = weekStartUtc();
    const triggered: Array<{ organizationId: string; brandId: string; runId: string }> = [];
    for (const brand of brands || []) {
      const run = await fluxSocialWeeklyCycle.trigger({ organizationId: brand.organization_id, brandId: brand.id, weekStart });
      triggered.push({ organizationId: brand.organization_id, brandId: brand.id, runId: run.id });
    }

    logger.info("Flux Social weekly planner queued brands", { weekStart, count: triggered.length });
    return { weekStart, triggered };
  },
});
