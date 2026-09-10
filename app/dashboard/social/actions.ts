"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_STATUSES,
  createSocialPost,
  scheduleSocialPost,
  transitionSocialPost,
  updateSocialBrand,
  type SocialPlatform,
  type SocialPostFormat,
  type SocialPostStatus,
} from "@/lib/social";

function splitLines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export async function transitionSocialPostAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "");
  const nextStatus = String(formData.get("next_status") || "") as SocialPostStatus;
  if (!postId) throw new Error("Post ID is missing.");
  if (!SOCIAL_POST_STATUSES.includes(nextStatus)) throw new Error("Invalid post status.");

  await transitionSocialPost(postId, nextStatus);
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/calendar");
}

export async function scheduleSocialPostAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "");
  const scheduledFor = String(formData.get("scheduled_for") || "");
  const timezone = String(formData.get("timezone") || "Africa/Lagos");
  if (!postId) throw new Error("Post ID is missing.");

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
