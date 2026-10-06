import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const webhook = await readFile(new URL("../app/api/whatsapp/webhook/route.ts", import.meta.url), "utf8");
const trigger = await readFile(new URL("../src/trigger/maia-runtime.ts", import.meta.url), "utf8");
const runtime = await readFile(new URL("../lib/ai/maia-runtime.ts", import.meta.url), "utf8");
const catalog = await readFile(new URL("../app/api/limitless/properties/route.ts", import.meta.url), "utf8");
const propertyWrite = await readFile(new URL("../lib/limitless-property-write.ts", import.meta.url), "utf8");
const form = await readFile(new URL("../app/dashboard/limitless/properties/NewPropertyForm.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/dashboard/actions.ts", import.meta.url), "utf8");

test("catalog creation uses the active organization and rejects false-success writes", () => {
  assert.match(catalog, /createPropertyNormalized\(payload, scope\?\.organizationId\)/);
  assert.match(catalog, /Property record was not created/);
  assert.match(propertyWrite, /organization_id: String\(organizationId \|\| LIMITLESS_REALTY_ORGANIZATION_ID\)/);
});

test("catalog accepts multiple images and videos", () => {
  assert.match(form, /name="property_images"[^>]+multiple/);
  assert.match(form, /video\/mp4/);
  assert.match(catalog, /for \(const file of files\)/);
  assert.match(catalog, /uploadPublicMedia\(file/);
});

test("catalog media is tenant-scoped and registered for Maia", () => {
  assert.match(catalog, /organizationId: scope\?\.organizationId/);
  assert.match(catalog, /propertyId: String\(property\.id\)/);
  assert.match(catalog, /channel: "whatsapp"/);
  assert.match(actions, /uploadPublicMedia\(file/);
});

test("WhatsApp voice notes preserve media identity for transcription", () => {
  assert.match(webhook, /messageType: String\(message\?\.type/);
  assert.match(webhook, /mediaId: String\(message\?\.audio\?\.id/);
  assert.match(webhook, /mimeType: String\(message\?\.audio\?\.mime_type/);
  assert.match(trigger, /transcribeWhatsAppAudio/);
  assert.match(trigger, /v1\/audio\/transcriptions/);
  assert.match(trigger, /voice_note_transcribed/);
});

test("Maia has a controlled public-web research tool", () => {
  assert.match(runtime, /name: "web_research"/);
  assert.match(runtime, /FIRECRAWL_API_KEY/);
  assert.match(runtime, /https:\/\/api\.firecrawl\.dev\/v1\/search/);
  assert.match(runtime, /Never use web research to override the tenant catalog/);
});
