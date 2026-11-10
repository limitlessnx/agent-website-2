"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
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
