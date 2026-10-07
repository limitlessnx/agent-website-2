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


test("property creation explains missing required fields before writing", () => {
  for (const field of ["title", "price", "location_area", "location_city", "type", "features", "description"]) {
    assert.match(form, new RegExp(`name="${field}"[^>]*required`));
    assert.match(form, new RegExp('\\\\["' + field + '",'));

  }
  assert.match(form, /Please complete:/);
  assert.match(catalog, /code: "missing_property_fields"/);
  assert.match(catalog, /fields: missing/);
  assert.match(catalog, /status: 400/);
});

test("property creation failures stay on the form instead of redirecting", () => {
  assert.match(form, /setError\(cause instanceof Error \? cause\.message/);
  assert.match(form, /role="alert"/);
  assert.match(form, /router\.refresh\(\)/);
  assert.doesNotMatch(form, /router\.push\([^)]*error/i);
});


test("Limitless property routes reject non-Limitless organization contexts", async () => {
  const scope = await readFile(new URL("../lib/admin-organization-scope.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/dashboard/limitless/properties/page.tsx", import.meta.url), "utf8");
  assert.match(scope, /requireAdminSystemScope/);
  assert.match(page, /scope\.systemId !== "limitless-realty"/);
  assert.match(catalog, /code: "wrong_organization_context"/);
  assert.match(catalog, /status: 403/);
});

test("Limitless property CRUD uses the resolved organization ID for every mutation", async () => {
  const data = await readFile(new URL("../lib/limitless-data.ts", import.meta.url), "utf8");
  assert.match(data, /getProperties\(limit=100,organizationId=LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(data, /createProperty\(payload:Partial<PropertyRecord>,organizationId=LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(data, /updateProperty\(propertyId:string,payload:Partial<PropertyRecord>,organizationId=LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(data, /deleteProperty\(propertyId:string,organizationId=LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(data, /updatePropertyImageLink\(propertyId:string,drivePhotosLink:string,organizationId=LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(actions, /createProperty\([^;]+scope\.organizationId/);
  assert.match(actions, /updateProperty\([^;]+scope\.organizationId/);
  assert.match(actions, /deleteProperty\(propertyId,scope\.organizationId\)/);
  assert.match(actions, /updatePropertyImageLink\(propertyId,uploaded\.url,scope\.organizationId\)/);
});
