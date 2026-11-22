import {isRealtySocialBrand} from "@/lib/social-real-estate-policy";
import {realtyBrandReadiness} from "@/lib/social-realty-brand";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";
import { socialWeeklyFormatMix } from "@/lib/social-week";
import { generateWeeklySocialPlan } from "@/lib/social-ai";
import type { SocialBrand } from "@/lib/social";

// Saves review-only drafts and queues the verified carousel and narrated Reel pipelines.
// This module never approves, schedules or publishes content.
export async function prepareSocialReviewWeek(supabase: SupabaseClient, organizationId: string, weekStart: string, brandId?: string) {
  let brandQuery = supabase
    .from("social_brands")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true }).limit(1);
  if (brandId) brandQuery = brandQuery.eq("id", brandId);
  const { data: brand, error: brandError } = await brandQuery.maybeSingle();

  if (brandError) throw brandError;
  if (!brand) throw new Error("Create a Social Brand before generating content.");
  const realty=isRealtySocialBrand(brand);
  if(realty){const readiness=await realtyBrandReadiness(supabase,brand);if(!readiness.ready)throw Error(readiness.blockers.join(" "));}

  const { data: existingPlan, error: existingPlanError } = await supabase
    .from("social_content_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("brand_id", brand.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingPlanError) throw existingPlanError;
  if (existingPlan) return { planId: existingPlan.id, existing: true };

  const { data: recentPosts, error: recentError } = await supabase.from("social_posts")
    .select("id,title,format,content,status,published_at").eq("organization_id", organizationId).eq("brand_id", brand.id)
    .order("created_at", { ascending: false }).limit(30);
  if (recentError) throw recentError;
  const { data: metricRows, error: metricError } = recentPosts?.length
    ? await supabase.from("social_post_metrics").select("post_id,platform,captured_at,impressions,reach,views,likes,comments,shares,saves,clicks,conversions,revenue_attributed")
      .eq("organization_id", organizationId).in("post_id", recentPosts.map((post) => post.id)).order("captured_at", { ascending: false }).limit(250)
    : { data: [], error: null };
  if (metricError) throw metricError;
  const latestMetrics = [...new Map((metricRows || []).slice().reverse().map((row) => [`${row.post_id}:${row.platform}`, row])).values()];
  const isFluxknight = organizationId === "15046426-e520-438b-8694-7662a6986efb" && brand.id === "a330b65a-d5b2-45f3-b211-451616f2fa8d";
  const formatMix = isFluxknight ? socialWeeklyFormatMix(brand.metadata || {}, weekStart) : null;
  const planningBrand = { ...brand, visual_rules: { ...brand.visual_rules,
    weekly_context: { recent_posts: recentPosts, latest_metrics: latestMetrics,
      instruction: "Avoid repeated hooks and angles. Treat small samples as exploratory; do not infer sales or revenue without tracked attribution." },
    ...(isFluxknight ? { weekly_format_guidance: formatMix
      ? "Create exactly four Instagram carousels and three narrated Instagram Reels (format reel). Make the workflow demo one of the Reels; vary industry coverage across the other formats. All seven retain Leo CTAs and relevant hashtags. Reels need structured illustrative diagrams, readable text and voiceover; use licensed brand background music when available. Never invent results. Human approval is required before scheduling or publishing."
      : "For this review batch use Instagram carousels. The workflow demo can be a step-by-step illustrative walkthrough with no invented results. Preserve human approval before scheduling or publishing." } : {}) } } as SocialBrand;
  const { plan, model } = await generateWeeklySocialPlan(planningBrand);
  if (isFluxknight) {
    const carousels = plan.posts.filter((post) => post.format === "carousel").length;
    const reels = plan.posts.filter((post) => post.format === "reel").length;
    if (formatMix ? (plan.posts.length !== 7 || carousels !== 4 || reels !== 3) : carousels !== plan.posts.length) {
      throw new Error(formatMix ? "Weekly review requires exactly four carousels and three narrated Reels." : "Weekly review batches currently require Instagram carousels.");
    }
    if (plan.posts.some((post) => post.platforms.some((platform) => platform !== "instagram"))) {
      throw new Error("Fluxknight weekly review supports Instagram only.");
    }
  }
  if(realty && (plan.posts.length!==7||plan.posts.some(post=>post.format!=="carousel"||post.platforms.some(platform=>platform!=="instagram")||!post.source_links?.length)))throw Error("Limitless Realty needs seven sourced Instagram carousels.");
  const generatedAt = new Date().toISOString();

  const { data: savedPlan, error: planError } = await supabase
    .from("social_content_plans")
    .insert({
      organization_id: organizationId,
      brand_id: brand.id,
      week_start: weekStart,
      status: "review",
      strategy: {
        strategy_summary: plan.strategy_summary,
        weekly_objective: plan.weekly_objective,
        audience_angle: plan.audience_angle,
      },
      model,
      generated_at: generatedAt,
      metadata: { source: "flux_social_ai", phase: "3.1", post_count: plan.posts.length, ...(formatMix ? { format_mix: formatMix } : {}) },
    })
    .select("id")
    .single();

  if (planError) {
    // Another planner may have won the unique brand/week constraint.
    if (planError.code === "23505") return { existing: true };
    throw planError;
  }

  const posts = plan.posts.map((post, index) => ({
    organization_id: organizationId,
    brand_id: brand.id,
    content_plan_id: savedPlan.id,
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
      ...(realty ? {source_links:post.source_links,research_observed_at:post.research_observed_at} : {}),
    },
    media: [],
    metadata: {
      ai_generated: true,
      ...(realty ? {requires_human_review:true,popularity_verified:false,generation_mode:"weekly_research"} : {}),
      model,
      generation_phase: "3.1",
      generated_at: generatedAt,
      ...(post.format === "carousel" ? {
        carousel_render_status: "queued",
        carousel_template: "fluxknight-social-carousel-v1",
      } : {}),
      ...(post.format === "reel" && formatMix ? { reel_render_status: "queued", reel_audio_verified: false, reel_voice_review_status: "pending" } : {}),
    },
  }));

  const { data: createdPosts, error: postsError } = await supabase.from("social_posts")
    .insert(posts).select("id,format");
  if (postsError) {
    await supabase.from("social_content_plans").delete().eq("organization_id", organizationId).eq("id", savedPlan.id);
    throw postsError;
  }

  // Media preparation runs in the background and leaves each completed post in
  // Review. A queue failure must never discard the saved weekly plan.
  for (const created of createdPosts || []) {
    if (created.format !== "carousel" && !(created.format === "reel" && formatMix)) continue;
    try {
      const options = { idempotencyKey: `weekly-${created.format}:${created.id}` };
      if (created.format === "reel") {
        await tasks.trigger("flux-social-prepare-reel", { organizationId, postId: created.id }, options);
      } else {
        await tasks.trigger("flux-social-render-carousel", { organizationId, postId: created.id }, options);
      }
    } catch (queueError) {
      const message = queueError instanceof Error ? queueError.message : String(queueError);
      const source = posts.find((post) => post.format === created.format)?.metadata || {};
      const { error: markError } = await supabase.from("social_posts").update({
        metadata: {
          ...source,
          ...(created.format === "reel" ? { reel_render_status: "failed", reel_render_error: message } : {
            carousel_render_status: "queue_failed", carousel_render_error: message,
          }),
        },
      }).eq("organization_id", organizationId).eq("id", created.id);
      if (markError) throw markError;
    }
  }

  return { planId: savedPlan.id, existing: false, postIds: (createdPosts || []).map((post) => post.id) };
}
