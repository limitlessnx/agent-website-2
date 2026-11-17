import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/integrations/elevenlabs/maia/property-search/route.ts", import.meta.url), "utf8");

test("ElevenLabs property lookup fails closed until dedicated secret exists", () => {
  assert.match(route, /ELEVENLABS_MAIA_TOOL_SECRET/);
  assert.match(route, /configured\.length < 32/);
  assert.match(route, /timingSafeEqual\(received, expected\)/);
  assert.match(route, /voice_tool_not_configured/);
  assert.match(route, /unauthorized/);
});
test("Voice pilot cannot select arbitrary organizations or run customer writes", () => {
  assert.match(route, /LIMITLESS_REALTY_ORGANIZATION_ID/);
  assert.match(route, /\.eq\("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(route, /\.in\("status", \["active", "available", "published"\]\)/);
  assert.doesNotMatch(route, /\.from\("crm_/);
  assert.doesNotMatch(route, /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  assert.match(route, /"Cache-Control": "no-store"/);
});
test("Voice pilot caps response size, avoids exposing internal property media or contacts", () => {
  assert.match(route, /Math\.min\(5/);
  assert.match(route, /catalog_updated_at: p\.updated_at/);
  assert.doesNotMatch(route, /select\([^)]*customer|select\([^)]*access_token/);
  assert.match(route, /does not reserve or book properties/);
});

test("ElevenLabs pilot accepts a raw Authorization secret or Bearer token with constant-time validation", () => {
  assert.match(route, /supplied\.startsWith\("Bearer "\) \? supplied\.slice\("Bearer "\.length\) : supplied/);
  assert.match(route, /received\.length === expected\.length && timingSafeEqual\(received, expected\)/);
  assert.match(route, /if \(!secret \|\| secret\.length < 32\) return false/);
});
