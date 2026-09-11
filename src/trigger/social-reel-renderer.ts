import { task } from "@trigger.dev/sdk";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReelPlan } from "@/lib/social-video-plan";

const SOCIAL_ASSET_BUCKET = "flux-social-assets";

export const fluxSocialRenderReel = task({
  id: "flux-social-render-reel",
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (payload: { organizationId: string; postId: string }) => {
    const supabase = createAdminClient();

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("id,organization_id,brand_id,title,format,metadata")
      .eq("organization_id", payload.organizationId)
      .eq("id", payload.postId)
      .single();
    if (postError) throw postError;
    if (!["reel", "video"].includes(post.format)) throw new Error("Only Reel/video posts can be rendered.");

    const metadata = (post.metadata || {}) as Record<string, unknown>;
    const plan = metadata.reel_plan as ReelPlan | undefined;
    if (!plan?.scenes?.length) throw new Error("Generate a Reel storyboard before rendering.");

    const { data: brand, error: brandError } = await supabase
      .from("social_brands")
      .select("id,name")
      .eq("organization_id", payload.organizationId)
      .eq("id", post.brand_id)
      .single();
    if (brandError) throw brandError;

    const { data: registry, error: registryError } = await supabase
      .from("social_brand_assets")
      .select("social_asset_id")
      .eq("organization_id", payload.organizationId)
      .eq("brand_id", brand.id)
      .eq("asset_role", "logo_primary")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (registryError) throw registryError;
    if (!registry?.social_asset_id) throw new Error("A canonical primary logo must be registered before rendering a Reel.");

    const { data: logoAsset, error: logoAssetError } = await supabase
      .from("social_assets")
      .select("bucket_id,storage_path")
      .eq("organization_id", payload.organizationId)
      .eq("id", registry.social_asset_id)
      .single();
    if (logoAssetError) throw logoAssetError;

    const { data: signedLogo, error: signedLogoError } = await supabase.storage
      .from(logoAsset.bucket_id)
      .createSignedUrl(logoAsset.storage_path, 3600);
    if (signedLogoError) throw signedLogoError;

    const inputProps = {
      plan,
      logoUrl: signedLogo.signedUrl,
      brandName: brand.name,
      website: "Fluxknight.space",
    };

    const serveUrl = await bundle({
      entryPoint: path.join(process.cwd(), "src/remotion/index.tsx"),
      onProgress: (progress) => console.log(`Remotion bundle ${Math.round(progress * 100)}%`),
    });

    const composition = await selectComposition({
      serveUrl,
      id: "FluxSocialReel",
      inputProps,
    });

    const outputLocation = path.join(tmpdir(), `flux-social-${post.id}-${Date.now()}.mp4`);

    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation,
        inputProps,
        crf: 18,
        x264Preset: "veryfast",
        concurrency: "50%",
        logLevel: "info",
      });

      const bytes = await readFile(outputLocation);
      const storagePath = `${payload.organizationId}/${post.id}/${crypto.randomUUID()}-fluxknight-reel.mp4`;
      const { error: uploadError } = await supabase.storage
        .from(SOCIAL_ASSET_BUCKET)
        .upload(storagePath, bytes, { contentType: "video/mp4", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;

      const { data: asset, error: assetError } = await supabase
        .from("social_assets")
        .insert({
          organization_id: payload.organizationId,
          post_id: post.id,
          brand_id: brand.id,
          asset_type: "reel",
          source: "remotion",
          status: "ready",
          bucket_id: SOCIAL_ASSET_BUCKET,
          storage_path: storagePath,
          mime_type: "video/mp4",
          size_bytes: bytes.byteLength,
          width: 1080,
          height: 1920,
          duration_ms: Math.round(plan.scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0) * 1000),
          metadata: {
            renderer: "remotion-4.0.523",
            composition: "FluxSocialReel",
            brand_asset_policy: "canonical-logo-only",
            storage_policy: "supabase-only",
            illustrative_scenarios_allowed: true,
          },
        })
        .select("id")
        .single();
      if (assetError) {
        await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([storagePath]);
        throw assetError;
      }

      const priorAssets = Array.isArray(metadata.media_assets) ? metadata.media_assets : [];
      const { error: updateError } = await supabase
        .from("social_posts")
        .update({
          metadata: {
            ...metadata,
            media_assets: [...priorAssets, asset.id],
            primary_asset_id: asset.id,
            reel_asset_id: asset.id,
            reel_render_status: "ready",
            reel_rendered_at: new Date().toISOString(),
            reel_renderer: "remotion-4.0.523",
          },
        })
        .eq("organization_id", payload.organizationId)
        .eq("id", post.id);
      if (updateError) throw updateError;

      return { postId: post.id, assetId: asset.id, storagePath };
    } finally {
      await rm(outputLocation, { force: true }).catch(() => undefined);
    }
  },
});
