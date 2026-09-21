import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/leo-public-voice-state.ts", import.meta.url), "utf8");

test("Public Leo voice defines an explicit deterministic state machine", () => {
  for (const state of [
    "idle",
    "connecting",
    "listening",
    "user_speaking",
    "endpointing",
    "generating",
    "tool_pending",
    "assistant_speaking",
    "interrupting",
    "degraded",
    "reconnecting",
    "ending",
  ]) {
    assert.match(source, new RegExp(`"${state}"`));
  }
  assert.match(source, /Invalid Public Leo voice transition/);
});

test("Public Leo voice epochs bind async work to call turn and generation", () => {
  assert.match(source, /callEpoch/);
  assert.match(source, /turnId/);
  assert.match(source, /generationId/);
  assert.match(source, /isCurrentPublicLeoEpoch/);
});


test("Public Leo aborts stale async tool work and rejects old epochs", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  assert.match(consultant, /AbortController/);
  assert.match(consultant, /toolAbortControllersRef/);
  assert.match(consultant, /signal: controller\.signal/);
  assert.match(consultant, /isCurrentPublicLeoEpoch\(epoch, voiceEpochRef\.current\)/);
  assert.match(consultant, /input_audio_buffer\.speech_started/);
  assert.match(consultant, /invalidateVoiceGeneration/);
});


test("Public Leo executes each realtime function call id at most once", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  assert.match(consultant, /processedToolCallIdsRef/);
  assert.match(consultant, /has\(callId\)/);
  assert.match(consultant, /add\(callId\)/);
  assert.match(consultant, /processedToolCallIdsRef\.current\.clear\(\)/);
});


test("Public Leo has one continuation owner after all tool calls settle", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  assert.match(consultant, /pendingVoiceToolCountRef/);
  assert.match(consultant, /toolResponseDoneRef/);
  assert.match(consultant, /toolContinuationIssuedRef/);
  assert.match(consultant, /maybeContinueAfterVoiceTools/);
  assert.match(consultant, /event\.type === "response\.done"/);
  const responseCreates = consultant.match(/type: "response\.create"/g) || [];
  assert.equal(responseCreates.length, 2, "only the opening and centralized tool continuation may create responses");
});


test("Public Leo WebRTC barge-in clears buffered speech and invalidates stale generation", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  assert.match(consultant, /activeResponseIdRef/);
  assert.match(consultant, /assistantAudioActiveRef/);
  assert.match(consultant, /input_audio_buffer\.speech_started/);
  assert.match(consultant, /input_audio_buffer\.speech_stopped/);
  assert.match(consultant, /output_audio_buffer\.clear/);
  assert.match(consultant, /response\.output_audio\.delta/);
  assert.match(consultant, /response\.output_audio\.done/);
  assert.match(consultant, /invalidateVoiceGeneration/);
  assert.doesNotMatch(consultant, /conversation\.item\.truncate/);
});


test("Public Leo endpointing uses bounded adaptive server VAD", async () => {
  const state = await readFile(new URL("../lib/leo-public-voice-state.ts", import.meta.url), "utf8");
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  const realtime = await readFile(new URL("../app/api/leo/public/realtime/route.ts", import.meta.url), "utf8");
  assert.match(state, /PUBLIC_LEO_SILENCE_DEFAULT_MS = 850/);
  assert.match(state, /PUBLIC_LEO_SILENCE_MIN_MS = 600/);
  assert.match(state, /PUBLIC_LEO_SILENCE_MAX_MS = 1450/);
  assert.match(state, /adaptPublicLeoSilenceMs/);
  assert.match(consultant, /type: "session\.update"/);
  assert.match(consultant, /silence_duration_ms: next/);
  assert.match(consultant, /premature_endpoint/);
  assert.match(consultant, /clean_turn/);
  assert.match(realtime, /type: "server_vad"/);
  assert.match(realtime, /threshold: 0\.5/);
  assert.match(realtime, /prefix_padding_ms: 300/);
  assert.match(realtime, /silence_duration_ms: 850/);
  assert.doesNotMatch(realtime, /semantic_vad/);
});
