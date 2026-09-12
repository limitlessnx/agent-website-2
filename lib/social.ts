import { requireTenant } from "@/lib/tenant";

export const SOCIAL_POST_STATUSES = ["idea", "draft", "review", "approved", "scheduled", "published", "failed"] as const;
export const SOCIAL_POST_FORMATS = ["text", "image", "carousel", "video", "reel", "story"] as const;
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "linkedin"] as const;

export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];
export type SocialPostFormat = (typeof SOCIAL_POST_FORMATS)[number];
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialBrand = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  tone: string;
  audience: string;
  content_pillars: string[];
  ctas: string[];
  products: string[];
  visual_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SocialPost = {
  id: string;
  organization_id: string;
  brand_id: string;
  content_plan_id: string | null;
  title: string;
  caption: string;
  format: SocialPostFormat;
  status: SocialPostStatus;
  platforms: SocialPlatform[];
  content: Record<string, unknown>;
  media: unknown[];
  metadata: Record<string, unknown>;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialSchedule = {
  id: string;
  organization_id: string;
  post_id: string;
  scheduled_for: string;
  timezone: string;
  status: "pending" | "claimed" | "completed" | "cancelled" | "failed";
  claimed_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPublishJob = {
  id: string;
  organization_id: string;
  post_id: string;
  schedule_id: string;
  platform: SocialPlatform;
  status: "queued" | "running" | "retry_scheduled" | "succeeded" | "failed";
  attempt_count: number;
  max_attempts: number;
  external_post_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function getSocialBrand(): Promise<SocialBrand | null> {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_brands")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as SocialBrand | null;
}

export async function listSocialPosts(limit = 100): Promise<SocialPost[]> {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SocialPost[];
}

export async function listSocialSchedules(limit = 100): Promise<SocialSchedule[]> {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SocialSchedule[];
}

export async function listSocialPublishJobs(limit = 100): Promise<SocialPublishJob[]> {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_publish_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SocialPublishJob[];
}

export async function createSocialPost(input: {
  title: string;
  caption: string;
  format: SocialPostFormat;
  platforms: SocialPlatform[];
}) {
  const { supabase, organizationId } = await requireTenant();
  const { data: brand, error: brandError } = await supabase
    .from("social_brands")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (brandError) throw brandError;
  if (!brand) throw new Error("Create a Social Brand before creating posts.");

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      organization_id: organizationId,
      brand_id: brand.id,
      title: input.title,
      caption: input.caption,
      format: input.format,
      status: "draft",
      platforms: input.platforms,
      content: { source: "dashboard", version: 1 },
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SocialPost;
}

const MANUAL_TRANSITIONS: Record<SocialPostStatus, SocialPostStatus[]> = {
  idea: ["draft"],
  draft: ["review"],
  review: ["draft", "approved"],
  approved: ["review"],
  scheduled: ["approved"],
  published: [],
  failed: ["approved"],
};

export async function transitionSocialPost(postId: string, nextStatus: SocialPostStatus) {
  const { supabase, organizationId } = await requireTenant();
  const { data: post, error: readError } = await supabase
    .from("social_posts")
    .select("id,status")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();

  if (readError) throw readError;
  const currentStatus = post.status as SocialPostStatus;
  if (!MANUAL_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw new Error(`Invalid social post transition: ${currentStatus} -> ${nextStatus}`);
  }

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "approved") patch.approved_at = new Date().toISOString();
  if (nextStatus === "draft" || nextStatus === "review") patch.approved_at = null;

  const { error } = await supabase
    .from("social_posts")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", postId);

  if (error) throw error;
}

export async function scheduleSocialPost(input: {
  postId: string;
  scheduledFor: string;
  timezone: string;
}) {
  const { supabase, organizationId } = await requireTenant();
  const scheduledAt = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Choose a valid publication time.");

  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("id,status,platforms")
    .eq("organization_id", organizationId)
    .eq("id", input.postId)
    .single();

  if (postError) throw postError;
  if (!(["approved", "scheduled"] as string[]).includes(post.status)) {
    throw new Error("Only approved posts can be scheduled.");
  }
  if (!asStringArray(post.platforms).length) throw new Error("Choose at least one publishing platform.");

  const { error: scheduleError } = await supabase
    .from("social_schedules")
    .upsert({
      organization_id: organizationId,
      post_id: input.postId,
      scheduled_for: scheduledAt.toISOString(),
      timezone: input.timezone || "UTC",
      status: "pending",
      claimed_at: null,
      completed_at: null,
      last_error: null,
    }, { onConflict: "organization_id,post_id" });

  if (scheduleError) throw scheduleError;

  const { error: postUpdateError } = await supabase
    .from("social_posts")
    .update({ status: "scheduled" })
    .eq("organization_id", organizationId)
    .eq("id", input.postId);

  if (postUpdateError) throw postUpdateError;
}

export async function updateSocialBrand(input: {
  tone: string;
  audience: string;
  contentPillars: string[];
  ctas: string[];
  products: string[];
}) {
  const { supabase, organizationId } = await requireTenant();
  const { error } = await supabase
    .from("social_brands")
    .update({
      tone: input.tone,
      audience: input.audience,
      content_pillars: input.contentPillars,
      ctas: input.ctas,
      products: input.products,
    })
    .eq("organization_id", organizationId)
    .eq("slug", "fluxknight");

  if (error) throw error;
}
