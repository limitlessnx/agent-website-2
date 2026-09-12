"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateWeeklySocialPlan } from "@/lib/social-ai";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_STATUSES,
  createSocialPost,
  scheduleSocialPost,
  transitionSocialPost,
  updateSocialBrand,
  type SocialBrand,
  type SocialPlatform,
  type SocialPostFormat,
  type SocialPostStatus,
} from "@/lib/social";
import { requireTenant } from "@/lib/tenant";

function splitLines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  return monday.toISOString().slice(0, 10);
}

function zonedLocalToUtcIso(localValue: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localValue)) throw new Error("Choose a valid publication time.");
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const base = Date.UTC(year, month - 1, day, hour, minute, 0);

  const zoneParts = (instant: number) => Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );

  let candidate = base;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zoneParts(candidate);
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate = base - (representedAsUtc - candidate);
  }

  return new Date(candidate).toISOString();
}

export async function createSocialPostAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const caption = String(formData.get("caption") || "").trim();
  const format = String(formData.get("format") || "text") as SocialPostFormat;
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter((platform): platform is SocialPlatform => SOCIAL_PLATFORMS.includes(platform as SocialPlatform));

  if (!title) throw new Error("Post title is required.");
  if (!SOCIAL_POST_FORMATS.includes(format)) throw new Error("Invalid social post format.");
  if (!platforms.length) throw new Error("Choose at least one publishing platform.");

  await createSocialPost({ title, caption, format, platforms });
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/posts");
  redirect("/dashboard/social/posts?created=1");
}

export async function generateWeeklySocialPlanAction() {
  const { supabase, organizationId } = await requireTenant();
  const weekStart = currentWeekStart();

  const { data: brand, error: brandError } = await supabase
    .from("social_brands")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (brandError) throw brandError;
  if (!brand) throw new Error("Create a Social Brand before generating content.");

  const { data: existingPlan, error: existingPlanError } = await supabase
    .from("social_content_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("brand_id", brand.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingPlanError) throw existingPlanError;
  if (existingPlan) redirect("/dashboard/social/posts?weekly_plan=existing");

  const { plan, model } = await generateWeeklySocialPlan(brand as SocialBrand);
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
      metadata: { source: "flux_social_ai", phase: "3.1", post_count: 5 },
    })
    .select("id")
    .single();

  if (planError) throw planError;

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
    },
    media: [],
    metadata: {
      ai_generated: true,
      model,
      generation_phase: "3.1",
      generated_at: generatedAt,
    },
  }));

  const { error: postsError } = await supabase.from("social_posts").insert(posts);
  if (postsError) {
    await supabase.from("social_content_plans").delete().eq("organization_id", organizationId).eq("id", savedPlan.id);
    throw postsError;
  }

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/create");
  revalidatePath("/dashboard/social/posts");
  redirect("/dashboard/social/posts?weekly_plan=generated");
}

export async function transitionSocialPostAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "");
  const nextStatus = String(formData.get("next_status") || "") as SocialPostStatus;
  if (!postId) throw new Error("Post ID is missing.");
  if (!SOCIAL_POST_STATUSES.includes(nextStatus)) throw new Error("Invalid post status.");

  await transitionSocialPost(postId, nextStatus);

  if (nextStatus === "approved") {
    const { supabase, organizationId } = await requireTenant();
    const { error } = await supabase
      .from("social_schedules")
      .update({ status: "cancelled", claimed_at: null, last_error: null })
      .eq("organization_id", organizationId)
      .eq("post_id", postId)
      .in("status", ["pending", "claimed"]);
    if (error) throw error;
  }

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/calendar");
}

export async function scheduleSocialPostAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "");
  const scheduledForLocal = String(formData.get("scheduled_for") || "");
  const timezone = String(formData.get("timezone") || "Africa/Lagos");
  if (!postId) throw new Error("Post ID is missing.");

  let scheduledFor: string;
  try {
    scheduledFor = zonedLocalToUtcIso(scheduledForLocal, timezone);
  } catch {
    throw new Error("The selected publication time or timezone is invalid.");
  }

  await scheduleSocialPost({ postId, scheduledFor, timezone });
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/calendar");
  redirect("/dashboard/social/calendar?scheduled=1");
}

export async function updateSocialBrandAction(formData: FormData) {
  await updateSocialBrand({
    tone: String(formData.get("tone") || "").trim(),
    audience: String(formData.get("audience") || "").trim(),
    contentPillars: splitLines(formData.get("content_pillars")),
    ctas: splitLines(formData.get("ctas")),
    products: splitLines(formData.get("products")),
  });

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/brand");
}
