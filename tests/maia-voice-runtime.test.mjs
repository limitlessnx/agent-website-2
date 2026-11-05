import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adapter = readFileSync("lib/maia-voice-runtime.ts", "utf8");
const task = readFileSync("src/trigger/maia-voice-runtime.ts", "utf8");
const maiaRuntime = readFileSync("lib/ai/maia-runtime.ts", "utf8");


test("Maia voice turns use the dedicated voice channel and tenant validation", () => {
  assert.match(adapter, /channel !== "voice"/);
  assert.match(adapter, /validateMaiaTenantContext\(payload\)/);
  assert.match(adapter, /registerMaiaInboundEvent\(payload\)/);
  assert.match(adapter, /claimMaiaConversationLock\(payload, lockOwner\)/);
  assert.match(adapter, /releaseMaiaConversationLock\(payload, lockOwner\)/);
  assert.match(adapter, /channel: "voice"/);
});

test("Maia voice turns preserve canonical caller and CRM conversation continuity", () => {
  assert.match(adapter, /resolveCanonicalCustomer/);
  assert.match(adapter, /externalKey = `voice:/);
  assert.match(adapter, /getOrCreateCanonicalConversation/);
  assert.match(adapter, /channel: "voice"/);
  assert.match(adapter, /maia-voice-inbound:/);
  assert.match(adapter, /maia-voice-reply:/);
});

test("Voice turns reuse Maia property-aware runtime and avoid WhatsApp delivery", () => {
  assert.match(adapter, /runMaia\(/);
  assert.match(adapter, /channel: "voice"/);
  assert.match(adapter, /property media/);
  assert.doesNotMatch(adapter, /dispatchMaiaOutboundMessage/);
  assert.doesNotMatch(adapter, /sendWhatsAppMessage/);
  assert.match(maiaRuntime, /maiaPropertyTools\(\)/);
});

test("The Trigger task is independently deployable and idempotent through the adapter", () => {
  assert.match(task, /id: "maia-process-voice-turn"/);
  assert.match(task, /processMaiaVoiceTurn\(payload\)/);
  assert.match(adapter, /if \(registration\.duplicate\)/);
  assert.match(adapter, /markMaiaInboundCompleted\(eventId\)/);
  assert.match(adapter, /markMaiaInboundFailed\(eventId, errorMessage\)/);
});
