import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("lib/maia-whatsapp-calling.ts", "utf8");
const webhook = readFileSync("app/api/whatsapp/webhook/route.ts", "utf8");
const sideband = readFileSync("src/trigger/maia-whatsapp-call-sideband.ts", "utf8");
const propertyTools = readFileSync("lib/ai/maia-property-tools.ts", "utf8");
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
  assert.match(helper, /session: \{ sdp_type: "answer", sdp: input\.sdp \}/);
  assert.match(helper, /\/calls`/);
  assert.match(webhook, /callSession\(rawCall\)/);
});

test("The accepted call queues an OpenAI sideband with safe Limitless lookup and explicit chat handoff tools", () => {
  assert.match(helper, /realtimeCallId/);
  assert.match(webhook, /maia-whatsapp-call-sideband/);
  assert.match(sideband, /maiaEstateTools\(\)/);
  assert.match(sideband, /maiaPropertyTools\(\)/);
  assert.match(sideband, /"search_properties", "get_property_media", "send_property_details_to_whatsapp"/);
  assert.match(sideband, /send_property_details_to_whatsapp/);
  assert.match(sideband, /organizationId: input\.organizationId/);
  assert.match(helper, /LIMITLESS_REALTY_ORGANIZATION_ID/);
  assert.match(sideband, /LIMITLESS_REALTY_ORGANIZATION_ID/);
  assert.match(propertyTools, /propertySearchText/);
  assert.match(propertyTools, /\[%_\(\),\\\\\]/);
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
