import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Reel narrator synthesizes timestamped ElevenLabs audio and keeps tracks private", () => {
  const source = read("lib/social-reel-audio.ts");
  assert.match(source, /\/with-timestamps/);
  assert.match(source, /character_end_times_seconds/);
  assert.match(source, /ELEVENLABS_API_KEY/);
  assert.match(source, /ELEVENLABS_FLUX_SOCIAL_PREMIUM_MALE_VOICE_ID/);
  assert.match(source, /storagePath =.*organizationId.*postId/);
  assert.match(source, /licensed_for_social_usage !== true/);
  assert.match(source, /\.eq\("brand_id", brandId\)/);
});

test("Reel Remotion render uses narration and licensed music and verifies the MP4", () => {
  const render = read("src/trigger/social-reel-renderer.ts");
  const composition = read("src/remotion/FluxSocialReel.tsx");
  assert.match(render, /createReelNarration/);
  assert.match(render, /getLicensedReelMusic/);
  assert.match(render, /getVideoMetadata\(outputLocation\)/);
  assert.match(render, /mediaInfo\.audioCodec/);
  assert.match(render, /reel_voice_review_status: "pending"/);
  assert.match(render, /approved_at: null/);
  assert.match(composition, /<Audio/);
  assert.match(composition, /musicUrl \? <Audio/);
  assert.match(composition, /captionsEnabled = false/);
});

test("Voice previews require human approval and cannot bypass the general post transition", () => {
  const review = read("lib/social-review.ts");
  const transitions = read("lib/social.ts");
  const reviewPage = read("app/dashboard/social/review/page.tsx");
  assert.match(review, /reel_audio_verified !== true/);
  assert.match(review, /reel_music_status !== "ready"/);
  assert.match(review, /reel_voice_review_status !== "approved"/);
  assert.match(review, /approveReelVoiceReview/);
  assert.match(transitions, /Approve verified Reel narration/);
  assert.match(reviewPage, /Voice previews/);
  assert.match(reviewPage, /Approve narration and music/);
});

test("ElevenLabs 402 is actionable and terminal; rate limits remain retryable", () => {
  const narration = read("lib/social-reel-audio.ts");
  const renderer = read("src/trigger/social-reel-renderer.ts");
  assert.match(narration, /statusCode === 402/);
  assert.match(narration, /remaining credits and API-key credit limits/);
  assert.match(narration, /parseProviderErrorCode\(response\)/);
  assert.match(narration, /statusCode === 429 \|\| statusCode >= 500/);
  assert.match(renderer, /ReelNarrationProviderError/);
  assert.match(renderer, /AbortTaskRunError\(message\)/);
  assert.match(renderer, /reel_render_status: "failed"/);
});


test("Reel narration uses the free-plan built-in George voice by default", () => {
  const narration = read("lib/social-reel-audio.ts");
  const renderer = read("src/trigger/social-reel-renderer.ts");
  assert.match(narration, /JBFqnCBsd6RMkjVDRZzb/);
  assert.match(narration, /ELEVENLABS_FLUX_SOCIAL_VOICE_ID/);
  assert.match(narration, /Do not reuse the legacy PREMIUM_MALE_VOICE_ID/);
  assert.match(renderer, /voice_profile: "standard-male"/);
});
