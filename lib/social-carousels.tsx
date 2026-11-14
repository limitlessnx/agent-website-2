import { getSocialBrand } from "@/lib/social";
import { getPrimaryLogoAsset } from "@/lib/social-brand-assets";
import { uploadSocialAsset } from "@/lib/social-assets";
import { requireTenant } from "@/lib/tenant";
import {
  WIDTH, HEIGHT, FLUX_SOCIAL_CAROUSEL_TEMPLATE,
  generateCarouselPlan, renderSlide,
} from "@/lib/social-carousel-core";

export { WIDTH, HEIGHT, FLUX_SOCIAL_CAROUSEL_TEMPLATE, generateCarouselPlan, renderSlide };
export type { CarouselSlide } from "@/lib/social-carousel-core";

export async function generateCarouselForPost(postId: string) {
  const { supabase, organizationId } = await requireTenant();
  const brand = await getSocialBrand();
  if (!brand) throw new Error("A Social Brand is required before generating carousels.");

  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,brand_id,title,caption,format,content,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (post.format !== "carousel") throw new Error("This post is not configured as a carousel.");

  const content = (post.content || {}) as Record<string, unknown>;
  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const hook = String(content.hook || post.title || "");
  const cta = String(content.cta || "See how Fluxknight works");
  const contentPillar = String(content.content_pillar || "Business automation");
  const objective = String(content.objective || "");
  const creativeBrief = String(content.creative_brief || "");

  const { plan, model } = await generateCarouselPlan({
    title: post.title || "",
    hook,
    caption: post.caption || "",
    cta,
    contentPillar,
    objective,
    creativeBrief,
    audience: brand.audience,
  });

  const logo = await getPrimaryLogoAsset(brand.id);
  const assets = [];
  for (let i = 0; i < plan.slides.length; i += 1) {
    const slide = plan.slides[i];
    const response = await renderSlide({ brandName: brand.name, logoUrl: logo?.signed_url || null, slide, index: i + 1, total: plan.slides.length, pillar: contentPillar });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const asset = await uploadSocialAsset({
      postId: post.id,
      brandId: post.brand_id,
      assetType: "carousel_slide",
      source: "system",
      fileName: `fluxknight-carousel-${post.id}-${i + 1}.png`,
      mimeType: "image/png",
      body: bytes,
      sizeBytes: bytes.byteLength,
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
    });
    assets.push(asset);
  }

  const existingAssetIds = Array.isArray(metadata.media_assets) ? metadata.media_assets : [];
  const carouselAssetIds = assets.map((asset) => asset.id);
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      metadata: {
        ...metadata,
        media_assets: [...existingAssetIds, ...carouselAssetIds],
        carousel_asset_ids: carouselAssetIds,
        primary_asset_id: carouselAssetIds[0] || null,
        carousel_plan: plan,
        carousel_template: FLUX_SOCIAL_CAROUSEL_TEMPLATE,
        carousel_generated_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", post.id);
  if (updateError) throw updateError;

  return { assets, plan, model };
}
