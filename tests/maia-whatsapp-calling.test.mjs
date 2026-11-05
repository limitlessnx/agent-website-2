import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("lib/maia-whatsapp-calling.ts", "utf8");
const webhook = readFileSync("app/api/whatsapp/webhook/route.ts", "utf8");
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

test("The call bridge is tenant scoped and does not route through ElevenLabs", () => {
  assert.match(helper, /getWhatsAppCredentials\(target\.organizationId\)/);
  assert.match(helper, /eq\("organization_id", target\.organizationId\)/);
  assert.match(helper, /organizationId: target\.organizationId/);
  assert.doesNotMatch(helper, /elevenlabs/i);
  assert.match(helper, /leo_voice_minute/);
});

test("The transport documents the remaining server-side Maia tool-control step", () => {
  assert.match(docs, /server-side session controls\/sideband/);
  assert.match(docs, /feature-flagged/);
  assert.match(docs, /30–60 seconds/);
});
