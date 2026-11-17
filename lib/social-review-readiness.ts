import type { SocialPost, SocialPostFormat } from "@/lib/social";

export type SocialReviewReadiness = {
  ready: boolean;
  reason: string | null;
};

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function mediaReady(format: SocialPostFormat, metadata: Record<string, unknown>): SocialReviewReadiness {
  if (format === "text") return { ready: true, reason: null };

  if (format === "image") {
    return hasString(metadata.primary_asset_id)
      ? { ready: true, reason: null }
      : { ready: false, reason: "Generate or upload the final static graphic before approval." };
  }

  if (format === "carousel") {
    if (["queued", "rendering", "failed", "queue_failed"].includes(String(metadata.carousel_render_status || ""))) {
      return { ready: false, reason: "Carousel generation is not finished. Preview the final slides before approval." };
    }
    const ids = Array.isArray(metadata.carousel_asset_ids) ? metadata.carousel_asset_ids.filter(hasString) : [];
    return ids.length >= 2
      ? { ready: true, reason: null }
      : { ready: false, reason: "Generate the final carousel slides before approval." };
  }

  if (format === "reel" || format === "video") {
    const ready = hasString(metadata.reel_asset_id) && metadata.reel_render_status === "ready";
    if (!ready) return { ready: false, reason: "Render the final narrated Reel before approval." };
    if (metadata.reel_audio_verified !== true) return { ready: false, reason: "Render verification must confirm a playable narration track." };
    if (metadata.reel_music_status !== "ready") return { ready: false, reason: "Attach a licensed background music track before final approval." };
    if (metadata.reel_voice_review_status !== "approved") return { ready: false, reason: "Listen to the voice previews and approve Reel narration first." };
    return { ready: true, reason: null };
  }

  if (format === "story") {
    return hasString(metadata.primary_asset_id)
      ? { ready: true, reason: null }
      : { ready: false, reason: "Attach the final Story asset before approval." };
  }

  return { ready: false, reason: "This post format is not ready for approval." };
}

export function getSocialReviewReadiness(post: Pick<SocialPost, "format" | "metadata">): SocialReviewReadiness {
  return mediaReady(post.format, post.metadata || {});
}

