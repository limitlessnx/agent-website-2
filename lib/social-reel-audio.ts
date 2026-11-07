import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReelPlan } from "@/lib/social-video-plan";

/** Private storage only. Each clip belongs to the same post, brand and organization. */
const BUCKET = "flux-social-assets";

type TimingResponse = {
  audio_base64?: string;
  alignment?: { character_end_times_seconds?: number[] } | null;
  normalized_alignment?: { character_end_times_seconds?: number[] } | null;
};

export type ReelAudioClip = {
  sceneIndex: number;
  assetId: string;
  durationSeconds: number;
  storagePath: string;
  signedUrl: string;
};

function speechDuration(data: TimingResponse) {
  const times = data.normalized_alignment?.character_end_times_seconds || data.alignment?.character_end_times_seconds || [];
  const seconds = times.length ? times[times.length - 1] : 0;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("ElevenLabs returned no usable speech alignment.");
  return seconds;
}

async function storeAudio(supabase: SupabaseClient, input: {
  organizationId: string;
  brandId: string;
  postId: string;
  bytes: Buffer;
  sceneIndex: number;
  durationSeconds: number;
  voiceId: string;
}) {
  const storagePath = `${input.organizationId}/${input.postId}/${crypto.randomUUID()}-scene-${input.sceneIndex + 1}-narration.mp3`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.bytes, {
    contentType: "audio/mpeg", cacheControl: "31536000", upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data: asset, error: assetError } = await supabase.from("social_assets").insert({
    organization_id: input.organizationId,
    brand_id: input.brandId,
    post_id: input.postId,
    asset_type: "audio",
    source: "elevenlabs",
    status: "ready",
    bucket_id: BUCKET,
    storage_path: storagePath,
    mime_type: "audio/mpeg",
    size_bytes: input.bytes.length,
    duration_ms: Math.round(input.durationSeconds * 1000),
    metadata: {
      purpose: "reel_voiceover",
      scene_index: input.sceneIndex,
      voice_profile: "premium-male",
      provider_voice_id: input.voiceId,
      generated_with_alignment: true,
      approved_for_publishing: false,
    },
  }).select("id").single();
  if (assetError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw assetError;
  }
  const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (signedError) throw signedError;
  return { assetId: asset.id as string, storagePath, signedUrl: signed.signedUrl };
}

/** Generate before rendering. Never expose provider credentials to the browser. */
export async function createReelNarration(supabase: SupabaseClient, input: {
  organizationId: string;
  brandId: string;
  postId: string;
  plan: ReelPlan;
}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_FLUX_SOCIAL_PREMIUM_MALE_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new Error("Configure ELEVENLABS_API_KEY and ELEVENLABS_FLUX_SOCIAL_PREMIUM_MALE_VOICE_ID in Trigger.dev before automatic Reel narration.");
  }

  const clips: ReelAudioClip[] = [];
  const scenes = [];
  for (let index = 0; index < input.plan.scenes.length; index++) {
    const scene = input.plan.scenes[index];
    const script = scene.voiceover.trim();
    if (!script) throw new Error(`Scene ${index + 1} needs narration text before automatic Reel rendering.`);
    if (script.length > 1700) throw new Error(`Scene ${index + 1} voiceover exceeds the per-scene character limit.`);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        text: script,
        model_id: process.env.ELEVENLABS_SOCIAL_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.62, similarity_boost: 0.8, style: 0.16, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`ElevenLabs narration failed for scene ${index + 1} (HTTP ${response.status}).`);
    const data = await response.json() as TimingResponse;
    if (!data.audio_base64) throw new Error(`ElevenLabs returned no audio for scene ${index + 1}.`);
    const durationSeconds = speechDuration(data);
    const bytes = Buffer.from(data.audio_base64, "base64");
    if (bytes.length < 1024) throw new Error(`Scene ${index + 1} narration contains insufficient audio data.`);

    // Allow the scene to finish after narration, never cut a spoken word to meet the AI's estimated length.
    const sceneDuration = Math.max(scene.duration_seconds, Math.ceil((durationSeconds + 0.3) * 30) / 30);
    if (sceneDuration > 24) throw new Error(`Scene ${index + 1} narration is too long; shorten its script.`);
    const saved = await storeAudio(supabase, {
      organizationId: input.organizationId, brandId: input.brandId, postId: input.postId,
      bytes, sceneIndex: index, durationSeconds, voiceId,
    });
    clips.push({ sceneIndex: index, durationSeconds, ...saved });
    scenes.push({ ...scene, duration_seconds: sceneDuration });
  }
  const total = scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);
  if (total > 90) throw new Error("Synchronized Reel narration exceeds 90 seconds; shorten the storyboard.");
  return { plan: { ...input.plan, scenes }, clips, totalDurationSeconds: total };
}

/** Music must already be stored by this organization and explicitly marked as licensed. */
export async function getLicensedReelMusic(supabase: SupabaseClient, organizationId: string) {
  const musicAssetId = process.env.FLUX_SOCIAL_MUSIC_ASSET_ID;
  if (!musicAssetId) throw new Error("Background music is enabled but FLUX_SOCIAL_MUSIC_ASSET_ID is not configured with a licensed track.");
  const { data: asset, error } = await supabase.from("social_assets")
    .select("id,bucket_id,storage_path,mime_type,metadata,status,asset_type")
    .eq("organization_id", organizationId).eq("id", musicAssetId).single();
  if (error) throw error;
  const meta = (asset.metadata || {}) as Record<string, unknown>;
  if (asset.status !== "ready" || asset.asset_type === "video") throw new Error("Configured Reel music asset is not ready.");
  if (!["audio/mpeg", "audio/wav", "audio/mp4"].includes(asset.mime_type)) throw new Error("Background music must be a supported audio asset.");
  if (meta.licensed_for_social_usage !== true) throw new Error("Music asset must be explicitly licensed for social use.");
  const { data: signed, error: urlError } = await supabase.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 3600);
  if (urlError) throw urlError;
  return { assetId: asset.id as string, signedUrl: signed.signedUrl };
}
