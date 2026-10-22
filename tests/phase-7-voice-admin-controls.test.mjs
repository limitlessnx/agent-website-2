import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const configRoute = readFileSync("app/api/admin/clients/voice-config/route.ts", "utf8");
const configPanel = readFileSync("app/dashboard/clients/VoiceConfigurationControl.tsx", "utf8");
const approvalRoute = readFileSync("app/api/admin/clients/request-approval/route.ts", "utf8");
const launchRoute = readFileSync("app/api/admin/clients/onboarding-status/route.ts", "utf8");

test("Voice Super Admin configuration is plan and tenant scoped", () => {
  assert.match(configRoute, /getAdminSession/);
  assert.match(configRoute, /planIncludesChannel\(plan\.code, "voice"\)/);
  assert.match(configRoute, /eq\("organization_id", organizationId\)/);
  assert.match(configRoute, /configuration: \{ \.\.\.configuration, voice: voiceConfiguration \}/);
  assert.match(configRoute, /maximum_call_duration_minutes/);
  assert.match(configRoute, /recording_policy/);
});

test("Voice configuration surface covers the Phase 7 operating controls", () => {
  for (const label of ["Agent identity", "Greeting", "Language", "Voice", "Human handoff number", "Maximum call duration", "Recording policy", "Voicemail behavior", "After-hours response", "Call summary format", "Qualification questions"]) {
    assert.match(configPanel, new RegExp(label));
  }
  assert.doesNotMatch(configPanel, /api[_-]?key|access[_-]?token|secret/i);
});

test("Voice approval requires the saved Voice configuration", () => {
  assert.match(approvalRoute, /requiredChannels\.some\(\(channel\) => channel\.toLowerCase\(\) === "voice"\)/);
  assert.match(approvalRoute, /Voice configuration is incomplete/);
  assert.match(approvalRoute, /call_summary_format/);
});

test("Business launch uses the centralized Voice activation gate", () => {
  assert.match(launchRoute, /getVoiceActivationGate/);
  assert.match(launchRoute, /planIncludesChannel\(voiceGate\.planCode, "voice"\)/);
  assert.match(launchRoute, /voiceActivationError\(voiceGate\)/);
});
