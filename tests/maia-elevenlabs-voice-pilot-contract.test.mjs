import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const bridge = readFileSync(new URL("../app/api/integrations/elevenlabs/maia/lookup/route.ts", import.meta.url), "utf8");
const calling = readFileSync(new URL("../lib/maia-whatsapp-calling.ts", import.meta.url), "utf8");

test("ElevenLabs pilot voice tool requires a separately configured secret", () => {
  assert.match(bridge, /MAIA_ELEVENLABS_TOOL_TOKEN/);
  assert.match(bridge, /configured.length < 32/);
  assert.match(bridge, /timingSafeEqual/);
  assert.match(bridge, /status: 503/);
  assert.match(bridge, /status: 401/);
  assert.doesNotMatch(bridge, /export async function GET/);
});

test("ElevenLabs pilot is strictly read-only and tenant pinned", () => {
  assert.match(bridge, /LIMITLESS_REALTY_ORGANIZATION_ID/);
  assert.match(bridge, /\.eq\("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID\)/);
  assert.match(bridge, /\.eq\("slug", "maia"\)/);
  assert.match(bridge, /SAFE_TOOLS = new Set\(\["search_properties", "search_estates", "get_estate_knowledge"\]\)/);
  assert.doesNotMatch(bridge, /\.from\("crm_messages"\)\.insert/);
  assert.doesNotMatch(bridge, /sendWhatsAppMessage|createBooking|dispatchMaiaPropertyMedia/);
});

test("existing Meta WhatsApp calling remains unchanged until verified cutover", () => {
  assert.match(calling, /MAIA_WHATSAPP_CALLING_ENABLED/);
  assert.match(calling, /https:\/\/api\.openai\.com\/v1\/realtime\/calls/);
  assert.doesNotMatch(calling, /ELEVENLABS_AGENT_ID|MAIA_ELEVENLABS_TOOL_TOKEN/);
});
