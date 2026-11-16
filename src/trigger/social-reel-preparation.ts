import { AbortTaskRunError, task } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReelStoryboard } from "@/lib/social-video-plan-core";
import { fluxSocialRenderReel } from "./social-reel-renderer";

// Weekly videos use the same structured visuals, narration, logo and licensed
// music pipeline as manually prepared Reels. This task cannot approve or publish.
export const fluxSocialPrepareReel = task({
  id: "flux-social-prepare-reel",
  maxDuration: 900,
  retry: { maxAttempts: 2 },
  run: async (payload: { organizationId: string; postId: string }) => {
    const supabase = createAdminClient();
    const { data: post, error } = await supabase.from("social_posts")
      .select("id,organization_id,brand_id,title,caption,format,status,content,metadata")
      .eq("organization_id", payload.organizationId).eq("id", payload.postId).single();
    if (error) throw error;
    if (post.format !== "reel" || !["draft", "review"].includes(post.status)) {
      throw new AbortTaskRunError("Weekly video preparation requires an unapproved Reel draft.");
    }
    if (post.metadata?.reel_render_status === "ready" && post.metadata?.reel_asset_id) {
      return { postId: post.id, existing: true };
    }
    const { data: organization, error: organizationError } = await supabase.from("organizations")
      .select("status").eq("id", payload.organizationId).single();
    if (organizationError) throw organizationError;
    if (organization.status !== "active") throw new AbortTaskRunError("Organization is not active.");
    const { data: brand, error: brandError } = await supabase.from("social_brands").select("*")
      .eq("organization_id", payload.organizationId).eq("id", post.brand_id).single();
    if (brandError) throw brandError;
    try {
      const storyboard = post.metadata?.reel_plan
        ? { plan: post.metadata.reel_plan, model: post.metadata.reel_plan_model }
        : await generateReelStoryboard(brand, post);
      const { data: queued, error: saveError } = await supabase.from("social_posts").update({
        approved_at: null,
        metadata: { ...post.metadata, reel_plan: storyboard.plan, reel_plan_model: storyboard.model,
          reel_plan_generated_at: new Date().toISOString(), reel_render_status: "queued", reel_render_error: null,
          reel_audio_verified: false, reel_voice_review_status: "pending" },
      }).eq("organization_id", payload.organizationId).eq("id", post.id).in("status", ["draft", "review"]).select("id").maybeSingle();
      if (saveError) throw saveError;
      if (!queued) throw new AbortTaskRunError("Post moved out of draft review while preparing video.");
      const rendered = await fluxSocialRenderReel.triggerAndWait({ organizationId: payload.organizationId, postId: post.id });
      if (!rendered.ok) throw new AbortTaskRunError("Weekly video render failed; inspect the renderer error in Review.");
      return { postId: post.id, rendered: true };
    } catch (error) {
      const { data: current } = await supabase.from("social_posts").select("metadata")
        .eq("organization_id", payload.organizationId).eq("id", post.id).maybeSingle();
      if (current && current.metadata?.reel_render_status !== "ready") {
        const { error: markError } = await supabase.from("social_posts").update({
          metadata: { ...current.metadata, reel_render_status: "failed", reel_render_error: current.metadata?.reel_render_error || (error instanceof Error ? error.message : String(error)) },
        }).eq("organization_id", payload.organizationId).eq("id", post.id).in("status", ["draft", "review"]);
        if (markError) throw markError;
      }
      throw error;
    }
  },
});
