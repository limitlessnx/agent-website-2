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


test("Public Leo tolerates transient bad networks without exposing internals", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  assert.match(consultant, /connectionstatechange/);
  assert.match(consultant, /iceconnectionstatechange/);
  assert.match(consultant, /getStats\(\)/);
  assert.match(consultant, /currentRoundTripTime/);
  assert.match(consultant, /report\.jitter/);
  assert.match(consultant, /7000/);
  assert.match(consultant, /Connection interrupted\. Trying to recover/);
  assert.match(consultant, /Tap Talk to Leo to reconnect/);
  assert.match(consultant, /cleanupNetworkMonitoring/);
});


test("Public Leo never exposes raw internal tool status to the voice model", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  const policy = await readFile(new URL("../lib/leo-public-policy.ts", import.meta.url), "utf8");
  const output = await readFile(new URL("../lib/leo-public-voice-output.ts", import.meta.url), "utf8");
  assert.match(consultant, /publicLeoVoiceToolOutput/);
  assert.doesNotMatch(consultant, /output: JSON\.stringify\(data\)/);
  assert.match(policy, /INTERNAL STATUS FIREWALL/);
  assert.match(policy, /never mention or narrate tools/i);
  assert.match(policy, /Never say hold on/i);
  assert.doesNotMatch(output, /tool_key\s*:/);
  assert.doesNotMatch(output, /localExecution/);
  assert.doesNotMatch(output, /leadId/);
  assert.doesNotMatch(output, /diagnosticId/);
  assert.doesNotMatch(output, /error:/);
});


test("Public Leo cannot persist a voice email before a later explicit confirmation turn", async () => {
  const consultant = await readFile(new URL("../components/PublicLeoConsultant.tsx", import.meta.url), "utf8");
  const toolRoute = await readFile(new URL("../app/api/leo/public/tool/route.ts", import.meta.url), "utf8");
  const sessionStore = await readFile(new URL("../lib/leo-session-store.ts", import.meta.url), "utf8");
  const policy = await readFile(new URL("../lib/leo-public-policy.ts", import.meta.url), "utf8");
  assert.match(consultant, /voiceTurnId: voiceEpochRef\.current\.turnId/);
  assert.match(consultant, /invalidateVoiceGeneration\(true\)/);
  assert.match(toolRoute, /args\.email_confirmed === true/);
  assert.match(toolRoute, /voiceTurnId > session\.pendingEmailTurnId/);
  assert.match(toolRoute, /email_confirmation_required/);
  assert.match(sessionStore, /public_leo_pending_email/);
  assert.match(sessionStore, /public_leo_pending_email_turn_id/);
  assert.match(policy, /VOICE EMAIL SAFETY/);
  assert.match(policy, /wait for the visitor's next spoken turn/i);
});


test("Public Leo realtime route is public-only and contains no operational task machinery", async () => {
  const realtime = await readFile(new URL("../app/api/leo/public/realtime/route.ts", import.meta.url), "utf8");
  assert.match(realtime, /const PUBLIC_IDENTITY/);
  assert.match(realtime, /publicLeoVoiceInstructions/);
  assert.match(realtime, /publicContinuityContext/);
  assert.match(realtime, /type: "server_vad"/);
  assert.doesNotMatch(realtime, /ACTIVE OPERATIONAL TASK/);
  assert.doesNotMatch(realtime, /VOICE WORKING CONTEXT/);
  assert.doesNotMatch(realtime, /leo_manage_task/);
  assert.doesNotMatch(realtime, /superAdminVoiceRules/);
  assert.doesNotMatch(realtime, /resolveLeoIdentity/);
  assert.doesNotMatch(realtime, /loadActiveLeoOperationalTask/);
  assert.doesNotMatch(realtime, /preflightChargeableFluxAi/);
  assert.doesNotMatch(realtime, /recordChargeableFluxAiUsage/);
});
