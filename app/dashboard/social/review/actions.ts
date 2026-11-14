"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { scheduleSocialPost } from "@/lib/social";
import {
  approveSocialPostReview,
  approveReelVoiceReview,
  rejectSocialPostReview,
  updateSocialPostReview,
} from "@/lib/social-review";

function revalidateReview() {
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/review");
  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/calendar");
}

export async function updateSocialPostReviewAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");

  await updateSocialPostReview({
    postId,
    title: String(formData.get("title") || ""),
    hook: String(formData.get("hook") || ""),
    caption: String(formData.get("caption") || ""),
    cta: String(formData.get("cta") || ""),
  });
  revalidateReview();
}

export async function rejectSocialPostReviewAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");
  await rejectSocialPostReview(postId, String(formData.get("reason") || ""));
  revalidateReview();
}

export async function approveSocialPostReviewAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");
  await approveSocialPostReview(postId);

  // Only a fresh human approval can start automatic scheduling. This is
  // deliberately not a backfill: old approved/scheduled posts stay untouched.
  const { supabase, organizationId } = await requireTenant();
  const { data: post, error: postError } = await supabase.from("social_posts")
    .select("id,brand_id,status,platforms,metadata")
    .eq("organization_id", organizationId).eq("id", postId).single();
  if (postError) throw postError;
  const { data: brand, error: brandError } = await supabase.from("social_brands")
    .select("id,name,metadata").eq("organization_id", organizationId)
    .eq("id", post.brand_id).single();
  if (brandError) throw brandError;

  // Roll out to the Fluxknight brand first. Other tenants retain their
  // existing manual workflow until their own publishing policy is configured.
  const settings = (brand.metadata || {}) as Record<string, unknown>;
  if (brand.name === "Fluxknight" && settings.auto_schedule_enabled !== false &&
      post.status === "approved") {
    const platforms = Array.isArray(post.platforms) ? post.platforms : [];
    if (platforms.includes("instagram")) {
      // Conservative next-day slot, using a brand-configurable Lagos hour.
      // Never schedule in the past or silently enable another platform.
      const requestedHour = Number(settings.preferred_publish_hour_lagos);
      const hour = Number.isInteger(requestedHour) && requestedHour >= 8 && requestedHour <= 20
        ? requestedHour : 11;
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(hour - 1, 0, 0, 0);
      try {
        await scheduleSocialPost({
          postId,
          scheduledFor: tomorrow.toISOString(),
          timezone: "Africa/Lagos",
          platforms: ["instagram"],
        });
      } catch (error) {
        // Approval remains valid, but scheduling is visibly recoverable.
        const message = error instanceof Error ? error.message : String(error);
        const metadata = (post.metadata || {}) as Record<string, unknown>;
        const { error: markError } = await supabase.from("social_posts").update({
          metadata: { ...metadata, auto_schedule_status: "failed", auto_schedule_error: message },
        }).eq("organization_id", organizationId).eq("id", postId).eq("status", "approved");
        if (markError) throw markError;
      }
    } else {
      const metadata = (post.metadata || {}) as Record<string, unknown>;
      const { error: markError } = await supabase.from("social_posts").update({
        metadata: { ...metadata, auto_schedule_status: "unsupported_platform",
          auto_schedule_error: "Automatic publishing currently supports Instagram only." },
      }).eq("organization_id", organizationId).eq("id", postId).eq("status", "approved");
      if (markError) throw markError;
    }
  }
  revalidateReview();
}

export async function approveReelVoiceReviewAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");
  await approveReelVoiceReview(postId);
  revalidateReview();
}

/** Selecting a new soundtrack invalidates all previous render and voice approvals. */
export async function selectReelMusicAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  const assetId = String(formData.get("music_asset_id") || "").trim();
  if (!postId || !assetId) throw new Error("Choose a Reel and licensed music track.");

  const { supabase, organizationId } = await requireTenant();
  const { data: post, error: postError } = await supabase.from("social_posts")
    .select("id,brand_id,format,status,metadata")
    .eq("organization_id", organizationId).eq("id", postId).single();
  if (postError) throw postError;
  if (!["reel", "video"].includes(post.format) || !["draft", "review", "approved"].includes(post.status)) {
    throw new Error("This Reel cannot be changed in its current state.");
  }

  const { data: asset, error: assetError } = await supabase.from("social_assets")
    .select("id,brand_id,asset_type,status,mime_type,metadata")
    .eq("organization_id", organizationId).eq("id", assetId).single();
  if (assetError) throw assetError;
  const assetMetadata = (asset.metadata || {}) as Record<string, unknown>;
  if (asset.brand_id !== post.brand_id || asset.asset_type !== "audio" || asset.status !== "ready" ||
      assetMetadata.licensed_for_social_usage !== true ||
      !["audio/mpeg", "audio/wav", "audio/mp4"].includes(asset.mime_type)) {
    throw new Error("This track is not approved for the current social brand.");
  }

  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const { error } = await supabase.from("social_posts").update({
    status: "review",
    approved_at: null,
    metadata: {
      ...metadata,
      reel_music_asset_id: asset.id,
      reel_music_status: "pending_render",
      reel_voice_review_status: "pending",
      reel_audio_verified: false,
      reel_render_status: "needs_rerender",
      reel_asset_id: null,
      primary_asset_id: null,
    },
  }).eq("organization_id", organizationId).eq("id", postId);
  if (error) throw error;
  revalidateReview();
}
