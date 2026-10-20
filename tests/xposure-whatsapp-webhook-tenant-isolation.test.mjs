import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("WhatsApp inbound tenant resolution matches configured phone number IDs", () => {
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook, /from\("organization_integrations"\)/);
  assert.match(webhook, /config\.phone_number_id \|\| config\.phoneNumberId/);
  assert.match(webhook, /\.eq\("organization_id", organizationId\)/);
});

test("Maia resolution remains restricted to the resolved organization", () => {
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook, /\.eq\("organization_id", organizationId\)/);
  assert.match(webhook, /candidate\.slug === "maia"/);
  assert.match(webhook, /startsWith\("maia-"\)/);
});

test("Inbound webhook emits safe diagnostics without logging customer message text", () => {
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook, /signatureValid/);
  assert.match(webhook, /tenant lookup result/);
  assert.match(webhook, /inbound ignored/);
  assert.match(webhook, /inbound dispatched/);
  assert.match(webhook, /inbound dispatch failed/);
  assert.doesNotMatch(webhook, /console\.(?:info|warn|error)\([^\n]*inboundPayload\.message/);
});

test("Super-admin generic WhatsApp configuration requires an explicit organization", () => {
  const route = read("app/api/integrations/whatsapp/configure/route.ts");
  assert.match(route, /organizationId is required for super-admin WhatsApp configuration/);
  assert.doesNotMatch(route, /\.eq\("slug", "limitless-realty"\)/);
});

test("Tenant dashboard configures WhatsApp through the selected tenant's scoped endpoint", () => {
  const dashboard = read("app/dashboard/integrations/WhatsAppOnboardingControl.tsx");
  assert.match(dashboard, /\/api\/admin\/clients\/\$\{integration\.organization_id\}\/whatsapp\/configure/);
});
