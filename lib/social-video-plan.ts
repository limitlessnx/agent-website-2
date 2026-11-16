import { requireTenant } from "@/lib/tenant";
import { getSocialBrand } from "@/lib/social";
import { generateReelStoryboard } from "@/lib/social-video-plan-core";
export type { ReelScene, ReelPlan } from "@/lib/social-video-plan-core";

export async function generateReelPlanForPost(postId: string) {
  const { supabase, organizationId } = await requireTenant();
  const brand = await getSocialBrand();
  if (!brand) throw new Error("A Social Brand is required before generating a Reel plan.");

  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,title,caption,format,status,content,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (!["reel", "video"].includes(post.format)) throw new Error("Only Reel/video posts can generate a video plan.");
  if (!["draft", "review", "approved"].includes(post.status)) throw new Error("Scheduled and published Reels cannot be edited.");

  const { plan, model } = await generateReelStoryboard(brand, post);

  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      status: "review",
      approved_at: null,
      metadata: {
        ...(post.metadata || {}),
        reel_asset_id: null,
        primary_asset_id: null,
        reel_render_status: "needs_rerender",
        reel_voice_review_status: "pending",
        reel_audio_verified: false,
        reel_plan: plan,
        reel_plan_model: model,
        reel_plan_phase: "3.5",
        reel_plan_generated_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", postId);
  if (updateError) throw updateError;

  return plan;
}
