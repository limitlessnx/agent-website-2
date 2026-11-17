import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("lib/maia-whatsapp-calling.ts", "utf8");
const webhook = readFileSync("app/api/whatsapp/webhook/route.ts", "utf8");
const sideband = readFileSync("src/trigger/maia-whatsapp-call-sideband.ts", "utf8");
const env = readFileSync(".env.example", "utf8");
const docs = readFileSync("docs/maia-whatsapp-calling-transport.md", "utf8");

test("Maia WhatsApp Calling is disabled by default and only handles Meta calls", () => {
  assert.match(env, /MAIA_WHATSAPP_CALLING_ENABLED=false/);
  assert.match(helper, /process\.env\.MAIA_WHATSAPP_CALLING_ENABLED !== "true"/);
  assert.match(helper, /WhatsApp Calling requires a Meta Cloud API integration/);
  assert.match(webhook, /acceptMaiaWhatsAppCall/);
});

test("The call bridge performs the Meta offer to OpenAI answer to Meta accept flow", () => {
  assert.match(helper, /https:\/\/api\.openai\.com\/v1\/realtime\/calls/);
  assert.match(helper, /Accept: "application\/sdp"/);
  assert.match(helper, /action: "accept"/);
  assert.match(helper, /payload\.session = \{ sdp_type: "answer", sdp: input\.sdp \}/);
  assert.match(helper, /\/calls`/);
  assert.match(webhook, /callSession\(rawCall\)/);
});

test("The accepted call queues an OpenAI sideband with read-only Limitless tools", () => {
  assert.match(helper, /realtimeCallId/);
  assert.match(webhook, /maia-whatsapp-call-sideband/);
  assert.match(sideband, /maiaEstateTools\(\)/);
  assert.match(sideband, /maiaPropertyTools\(\)/);
  assert.match(sideband, /\["search_properties", "get_property_media"\]/);
  assert.doesNotMatch(sideband, /send_property_media/);
  assert.match(sideband, /organizationId: input\.organizationId/);
});

test("The OpenAI sideband starts Maia's spoken greeting after the session update is confirmed", () => {
  assert.match(sideband, /type === "session\.updated"/);
  assert.match(sideband, /type: "response\.create"/);
  assert.match(sideband, /Greet the caller warmly and briefly as Maia/);
});

test("The call bridge is tenant scoped and does not route through ElevenLabs", () => {
  assert.match(helper, /getWhatsAppCredentials\(target\.organizationId\)/);
  assert.match(helper, /eq\("organization_id", target\.organizationId\)/);
  assert.match(helper, /organizationId: target\.organizationId/);
  assert.doesNotMatch(helper, /elevenlabs/i);
  assert.match(helper, /leo_voice_minute/);
});

test("The transport documents the Maia server-side tool-control path", () => {
  assert.match(docs, /sideband task/);
  assert.match(docs, /feature-flagged/);
  assert.match(docs, /30–60 seconds/);
});


test("Maia voice sideband records tenant-scoped startup, audio and early termination milestones", () => {
  assert.match(sideband, /from\("whatsapp_webhook_event_logs"\)\.insert\(/);
  assert.match(sideband, /event_type: "maia_voice_sideband"/);
  assert.match(sideband, /organization_id: input\.organizationId/);
  assert.match(sideband, /"session_ready"/);
  assert.match(sideband, /"audio_started"/);
  assert.match(sideband, /"response_without_audio"/);
  assert.match(sideband, /"socket_closed"/);
  assert.match(sideband, /"failed"/);
  assert.match(sideband, /closed before greeting initialization/);
  assert.match(sideband, /closed before audio output/);
  assert.match(webhook, /taskRunId: sidebandRun\.id/);
});


test("Maia GA Realtime sideband does not send the legacy beta protocol header", () => {
  assert.match(sideband, /wss:\/\/api\.openai\.com\/v1\/realtime\?call_id=/);
  assert.doesNotMatch(sideband, /OpenAI-Beta.*realtime=v1/);
});


test("Maia retries only transient 404 sideband attach failures with bounded attempts", () => {
  assert.match(sideband, /for \(let attempt = 1; attempt <= 3; attempt \+= 1\)/);
  assert.match(sideband, /!String\(connectionError\)\.includes\("HTTP 404"\)/);
  assert.match(sideband, /attempt \* 350/);
  assert.match(sideband, /"attach_retry"/);
});


test("Failed optional sideband cannot terminate the already accepted WhatsApp media call", () => {
  assert.doesNotMatch(sideband, /terminateMaiaWhatsAppCall/);
  assert.match(sideband, /media_session_preserved: true/);
  assert.match(sideband, /preserving accepted WhatsApp call/);
  assert.match(sideband, /throw error/);
  assert.match(sideband, /"failed"/);
});
