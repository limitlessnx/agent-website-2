"use server";

import { revalidatePath } from "next/cache";
import {
  approveSocialPostReview,
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
