import { task } from "@trigger.dev/sdk";
import { bundle } from "@remotion/bundler";
import { getVideoMetadata, renderMedia, selectComposition } from "@remotion/renderer";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReelPlan } from "@/lib/social-video-plan";
import { createReelNarration, getLicensedReelMusic } from "@/lib/social-reel-audio";

const SOCIAL_ASSET_BUCKET = "flux-social-assets";

export const fluxSocialRenderReel = task({
  id: "flux-social-render-reel",
  machine: "large-1x",
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (payload: { organizationId: string; postId: string }) => {
    const supabase = createAdminClient();

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("id,organization_id,brand_id,title,format,status,metadata")
      .eq("organization_id", payload.organizationId)
      .eq("id", payload.postId)
      .single();
    if (postError) throw postError;
    if (!["reel", "video"].includes(post.format)) throw new Error("Only Reel/video posts can be rendered.");
    if (!["draft", "review", "approved"].includes(post.status)) throw new Error("Scheduled and published Reels cannot be regenerated.");

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

    // Narration is automatically generated before each draft render. The voice preview
    // is stored privately and remains unapproved until reviewed by a human.
    const narration = await createReelNarration(supabase, {
      organizationId: payload.organizationId, brandId: brand.id, postId: post.id, plan,
    });
    const music = await getLicensedReelMusic(supabase, payload.organizationId, brand.id, typeof metadata.reel_music_asset_id === "string" ? metadata.reel_music_asset_id : null);
    const workingMetadata = {
      ...metadata,
      reel_plan: narration.plan,
      reel_narration_asset_ids: narration.clips.map((clip) => clip.assetId),
      reel_narration_duration_seconds: narration.totalDurationSeconds,
      reel_voice_profile: "premium-male",
      reel_captions_enabled: false,
      reel_music_enabled: true,
      reel_music_status: music ? "ready" : "missing_licensed_track",
      reel_music_asset_id: music?.assetId ?? null,
      reel_voice_review_status: "pending",
      reel_audio_verified: false,
      reel_render_status: "rendering",
      reel_asset_id: null,
      primary_asset_id: null,
    };
    const { error: pendingError } = await supabase.from("social_posts").update({
      status: "review", approved_at: null, metadata: workingMetadata,
    }).eq("organization_id", payload.organizationId).eq("id", post.id);
    if (pendingError) throw pendingError;

    const inputProps = {
      plan: narration.plan,
      narrationClips: narration.clips.map(({ sceneIndex, durationSeconds, signedUrl }) => ({ sceneIndex, durationSeconds, signedUrl })),
      musicUrl: music?.signedUrl ?? null,
      captionsEnabled: false,
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
        crf: 20,
        x264Preset: "veryfast",
        concurrency: 1,
        logLevel: "info",
      });

      const mediaInfo = await getVideoMetadata(outputLocation);
      if (!mediaInfo.audioCodec || mediaInfo.audioCodec === "unknown") throw new Error("Rendered Reel has no verifiable audio track; refusing to mark it ready.");
      if (mediaInfo.durationInSeconds == null || !Number.isFinite(mediaInfo.durationInSeconds) || Math.abs(mediaInfo.durationInSeconds - narration.totalDurationSeconds) > 1.2) {
        throw new Error("Rendered Reel duration does not match the synchronized narration timeline.");
      }
      const bytes = await readFile(outputLocation);
      if (bytes.byteLength < 20_000) throw new Error("Rendered Reel output is unexpectedly small.");
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
          duration_ms: Math.round(narration.totalDurationSeconds * 1000),
          metadata: {
            renderer: "remotion-4.0.523",
            composition: "FluxSocialReel",
            brand_asset_policy: "canonical-logo-only",
            storage_policy: "supabase-only",
            illustrative_scenarios_allowed: true,
            render_machine: "large-1x",
            render_concurrency: 1,
            voice_profile: "premium-male",
            voice_track_asset_ids: narration.clips.map((clip) => clip.assetId),
            audio_codec: mediaInfo.audioCodec,
            audio_duration_verified: true,
            music_asset_id: music?.assetId ?? null,
            captions_enabled: false,
            music_enabled: true,
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
            ...workingMetadata,
            media_assets: [...priorAssets, ...narration.clips.map((clip) => clip.assetId), asset.id],
            primary_asset_id: asset.id,
            reel_asset_id: asset.id,
            reel_render_status: "ready",
            reel_audio_verified: true,
            reel_voice_review_status: "pending",
            reel_rendered_at: new Date().toISOString(),
            reel_renderer: "remotion-4.0.523",
          },
        })
        .eq("organization_id", payload.organizationId)
        .eq("id", post.id);
      if (updateError) throw updateError;

      return { postId: post.id, assetId: asset.id, storagePath };
    } catch (renderError) {
      // Preserve generated voice clips for preview, but never mark a failed MP4
      // as ready or allow the previous approval to carry forward.
      const message = renderError instanceof Error ? renderError.message : String(renderError);
      await supabase.from("social_posts").update({
        status: "review",
        approved_at: null,
        metadata: {
          ...workingMetadata,
          reel_render_status: "failed",
          reel_audio_verified: false,
          reel_render_error: message,
          reel_voice_review_status: "pending",
        },
      }).eq("organization_id", payload.organizationId).eq("id", post.id);
      throw renderError;
    } finally {
      await rm(outputLocation, { force: true }).catch(() => undefined);
    }
  },
});
