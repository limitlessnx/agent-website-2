import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate = readFileSync("lib/voice-activation-gate.ts", "utf8");
const readiness = readFileSync("app/api/integrations/voice/readiness/route.ts", "utf8");
const webhook = readFileSync("app/api/webhooks/elevenlabs/post-call/route.ts", "utf8");
const helper = readFileSync("lib/elevenlabs-webhooks.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261012090000_phase7_elevenlabs_voice_runtime.sql", "utf8");
const config = readFileSync("app/api/admin/clients/voice-config/route.ts", "utf8");

test("ElevenLabs is the canonical Voice provider", () => {
  assert.match(gate, /eq\("provider", "elevenlabs"\)/);
  assert.match(readiness, /provider: existing\?\.provider === "twilio_voice" \? "elevenlabs"/);
  assert.match(readiness, /provider: "elevenlabs"/);
});

test("Voice configuration stores non-secret ElevenLabs references", () => {
  for (const key of ["elevenlabs_agent_id", "elevenlabs_version_id", "elevenlabs_phone_number_id", "elevenlabs_webhook_id"]) {
    assert.match(config, new RegExp(key));
  }
  assert.doesNotMatch(config, /api[_-]?key|auth[_-]?token|secret/i);
});

test("ElevenLabs webhook verifies signatures before parsing and processing", () => {
  assert.match(helper, /ElevenLabs-Signature|signatureHeader/);
  assert.match(helper, /createHmac\("sha256"/);
  assert.match(helper, /timingSafeEqual/);
  assert.match(webhook, /verifyElevenLabsSignature/);
  assert.match(webhook, /return NextResponse\.json\(\{ error: "Invalid ElevenLabs webhook signature\." \}, \{ status: 401 \}\)/);
});

test("ElevenLabs webhook is tenant-scoped and idempotent", () => {
  assert.match(webhook, /elevenlabs_voice_webhook_events/);
  assert.match(webhook, /23505/);
  assert.match(webhook, /configuration->>elevenlabs_agent_id/);
  assert.match(webhook, /organization_id: organizationId/);
  assert.match(webhook, /elevenlabs_voice_calls/);
  assert.match(migration, /unique \(organization_id, conversation_id\)/);
  assert.match(migration, /event_key text not null unique/);
});

test("Completed ElevenLabs calls meter by rounded-up duration and create failed-transfer handoffs", () => {
  assert.match(webhook, /Math\.ceil\(duration \/ 60\)/);
  assert.match(webhook, /action: "leo_voice_minute"/);
  assert.match(webhook, /source: "elevenlabs_voice_call"/);
  assert.match(webhook, /handoff_requests/);
  assert.match(webhook, /transfer_failed/);
  assert.match(webhook, /conversation_id: conversation\.id/);
});
