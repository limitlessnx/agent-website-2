import { task } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FLUX_SOCIAL_CAROUSEL_TEMPLATE, HEIGHT, WIDTH,
  generateCarouselPlan, renderSlide,
} from "@/lib/social-carousels";

const BUCKET = "flux-social-assets";

export const fluxSocialRenderCarousel = task({
  id: "flux-social-render-carousel",
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  run: async (payload: { organizationId: string; postId: string }) => {
    const supabase = createAdminClient();
    const { data: post, error: postError } = await supabase.from("social_posts")
      .select("id,brand_id,organization_id,title,caption,format,status,content,metadata")
      .eq("organization_id", payload.organizationId)
      .eq("id", payload.postId).single();
    if (postError) throw postError;
    if (post.format !== "carousel") throw new Error("This task renders only carousel posts.");
    if (!["draft", "review"].includes(post.status)) {
      return { skipped: true, reason: `Post is ${post.status}; approved or published content is immutable.` };
    }
    const originalMetadata = (post.metadata || {}) as Record<string, unknown>;
    if (originalMetadata.carousel_render_status === "ready" &&
        Array.isArray(originalMetadata.carousel_asset_ids) &&
        originalMetadata.carousel_asset_ids.length >= 2) {
      return { skipped: true, reason: "Carousel already generated" };
    }
    const { data: brand, error: brandError } = await supabase.from("social_brands")
      .select("id,name,audience").eq("organization_id", payload.organizationId)
      .eq("id", post.brand_id).single();
    if (brandError) throw brandError;

    const { error: startedError } = await supabase.from("social_posts").update({
      metadata: { ...originalMetadata, carousel_render_status: "rendering", carousel_render_error: null },
    }).eq("organization_id", payload.organizationId).eq("id", post.id);
    if (startedError) throw startedError;

    try {
      const content = (post.content || {}) as Record<string, unknown>;
      const { plan, model } = await generateCarouselPlan({
        title: post.title || "",
        hook: String(content.hook || post.title || ""),
        caption: post.caption || "",
        cta: String(content.cta || "See how Fluxknight works"),
        contentPillar: String(content.content_pillar || "Business automation"),
        objective: String(content.objective || ""),
        creativeBrief: String(content.creative_brief || ""),
        audience: brand.audience || "",
      });

      const { data: registeredLogo, error: logoRefError } = await supabase.from("social_brand_assets")
        .select("social_asset_id")
        .eq("organization_id", payload.organizationId)
        .eq("brand_id", brand.id)
        .eq("asset_role", "logo_primary")
        .eq("is_active", true)
        .limit(1).maybeSingle();
      if (logoRefError) throw logoRefError;
      let logoUrl: string | null = null;
      if (registeredLogo?.social_asset_id) {
        const { data: logoAsset, error: logoError } = await supabase.from("social_assets")
          .select("bucket_id,storage_path")
          .eq("organization_id", payload.organizationId)
          .eq("id", registeredLogo.social_asset_id).single();
        if (logoError) throw logoError;
        const { data: signed, error: signedError } = await supabase.storage
          .from(logoAsset.bucket_id).createSignedUrl(logoAsset.storage_path, 3600);
        if (signedError) throw signedError;
        logoUrl = signed.signedUrl;
      }

      const ids: string[] = [];
      for (let i = 0; i < plan.slides.length; i += 1) {
        const slide = plan.slides[i];
        const response = renderSlide({
          brandName: brand.name, logoUrl, slide, index: i + 1,
          total: plan.slides.length,
          pillar: String(content.content_pillar || "Business automation"),
        });
        const bytes = new Uint8Array(await response.arrayBuffer());
        const storagePath = `${payload.organizationId}/${post.id}/${crypto.randomUUID()}-carousel-${i + 1}.png`;
        const { error: uploadError } = await supabase.storage.from(BUCKET)
          .upload(storagePath, bytes, { contentType: "image/png", upsert: false });
        if (uploadError) throw uploadError;
        const { data: asset, error: assetError } = await supabase.from("social_assets")
          .insert({
            organization_id: payload.organizationId,
            post_id: post.id,
            brand_id: post.brand_id,
            asset_type: "carousel_slide",
            source: "system",
            status: "ready",
            bucket_id: BUCKET,
            storage_path: storagePath,
            mime_type: "image/png",
            size_bytes: bytes.byteLength,
            width: WIDTH,
            height: HEIGHT,
            metadata: {
              renderer: "next-image-response-v1",
              template: FLUX_SOCIAL_CAROUSEL_TEMPLATE,
              carousel_index: i + 1,
              position: i + 1,
              carousel_total: plan.slides.length,
              slide_type: slide.type,
              generated_from: slide,
              model,
              storage_policy: "supabase-only",
            },
          }).select("id").single();
        if (assetError) {
          await supabase.storage.from(BUCKET).remove([storagePath]);
          throw assetError;
        }
        ids.push(asset.id);
      }

      // Never silently approve/publish. Generated slides must be reviewed as a set.
      const { data: latest, error: latestError } = await supabase.from("social_posts")
        .select("status,metadata").eq("organization_id", payload.organizationId)
        .eq("id", post.id).single();
      if (latestError) throw latestError;
      if (!["draft", "review"].includes(latest.status)) {
        throw new Error("Post status changed while rendering; refusing to replace approved media.");
      }
      const current = (latest.metadata || {}) as Record<string, unknown>;
      const prior = Array.isArray(current.media_assets) ? current.media_assets : [];
      const { error: updateError } = await supabase.from("social_posts").update({
        status: "review", approved_at: null,
        metadata: {
          ...current,
          media_assets: [...prior, ...ids],
          carousel_asset_ids: ids,
          primary_asset_id: ids[0],
          carousel_plan: plan,
          carousel_template: FLUX_SOCIAL_CAROUSEL_TEMPLATE,
          carousel_render_status: "ready",
          carousel_render_error: null,
          carousel_generated_at: new Date().toISOString(),
        },
      }).eq("organization_id", payload.organizationId).eq("id", post.id)
        .in("status", ["draft", "review"]);
      if (updateError) throw updateError;
      return { postId: post.id, carouselAssetIds: ids, template: FLUX_SOCIAL_CAROUSEL_TEMPLATE };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Retain the prior approved asset set, if any. A failed new render never passes review.
      const { data: currentPost } = await supabase.from("social_posts").select("metadata")
        .eq("organization_id", payload.organizationId).eq("id", post.id).maybeSingle();
      await supabase.from("social_posts").update({
        metadata: {
          ...((currentPost?.metadata || {}) as Record<string, unknown>),
          carousel_render_status: "failed",
          carousel_render_error: message,
        },
      }).eq("organization_id", payload.organizationId).eq("id", post.id)
        .in("status", ["draft", "review"]);
      throw error;
    }
  },
});
