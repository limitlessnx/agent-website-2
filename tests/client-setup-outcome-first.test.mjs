import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/dashboard/clients/[organizationId]/setup/page.tsx", "utf8");

test("client setup is outcome-first", () => {
  assert.match(page, /What the client asked Fluxknight to build/);
  assert.match(page, /AI responsibilities/);
  assert.match(page, /Business knowledge/);
  assert.match(page, /WhatsApp/);
  assert.match(page, /Test before launch/);
  assert.match(page, /Only move to live after the setup and testing gates are complete/);
  assert.doesNotMatch(page, /Tenant setup and agent orchestration/);
  assert.doesNotMatch(page, /Super Admin allocation is not restricted by the client/);
  assert.doesNotMatch(page, /Fluxknight's Supabase, n8n and platform AI credentials remain shared infrastructure/);
});
test("client setup keeps tenant-scoped organization queries", () => {
  assert.match(page, /\.eq\("id", organizationId\)/);
  assert.match(page, /\.eq\("organization_id", organizationId\)/);
});
test("client setup exposes the submitted WhatsApp preference without credentials", () => {
  assert.match(page, /whatsapp_preferences/);
  assert.match(page, /Managed WhatsApp Business connection/);
  assert.doesNotMatch(page, /Account SID/);
  assert.doesNotMatch(page, /Auth Token/);
  assert.doesNotMatch(page, /WABA/);
  assert.doesNotMatch(page, /webhook URL/);
});
