import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/admin/integrations/maia-sip-preflight/route.ts", "utf8");

test("Meta SIP preflight is admin-only and restricted to Limitless Realty", () => {
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /if \(!session\).*Unauthorized/);
  assert.match(route, /LIMITLESS_REALTY_ORGANIZATION_ID/);
  assert.match(route, /getWhatsAppCredentials\(LIMITLESS_REALTY_ORGANIZATION_ID\)/);
});

test("Meta SIP preflight performs read-only settings request, never enables or imports SIP", () => {
  assert.match(route, /graph\.facebook\.com/);
  assert.match(route, /settings/);
  assert.match(route, /method: "GET"/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.doesNotMatch(route, /method: "POST"/);
  assert.match(route, /voiceCutoverReady: false/);
});

test("Meta SIP preflight redacts credentials and uses no-store", () => {
  assert.match(route, /cache: "no-store"/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(route, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(route, /sip_user_password/);
  assert.doesNotMatch(route, /return NextResponse\.json\(raw/);
  assert.match(route, /meta_settings_request_failed/);
});
