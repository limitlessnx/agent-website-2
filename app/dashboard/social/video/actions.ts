"use server";

import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import { generateReelPlanForPost } from "@/lib/social-video-plan";
import { requireTenant } from "@/lib/tenant";

export async function generateReelPlanAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");

  await generateReelPlanForPost(postId);
  revalidatePath("/dashboard/social/posts");
}

export async function renderReelAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");

  const { supabase, organizationId } = await requireTenant();
  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,format,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (!["reel", "video"].includes(post.format)) throw new Error("Only Reel/video posts can be rendered.");

  const metadata = (post.metadata || {}) as Record<string, unknown>;
  if (!metadata.reel_plan) throw new Error("Generate the Reel storyboard before rendering.");

  const run = await tasks.trigger("flux-social-render-reel", { organizationId, postId });

  await supabase
    .from("social_posts")
    .update({ metadata: { ...metadata, reel_render_status: "queued", reel_render_run_id: run.id } })
    .eq("organization_id", organizationId)
    .eq("id", postId);

  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/assets");
}
