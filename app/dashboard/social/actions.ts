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
import { requireTenant } from "@/lib/tenant";

function splitLines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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
