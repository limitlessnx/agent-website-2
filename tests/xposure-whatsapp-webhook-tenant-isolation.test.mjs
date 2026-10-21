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

test("Published tenant Maia can handle inbound when the legacy activation flag is unset", () => {
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook, /maiaFlagConfigured = Object\.prototype\.hasOwnProperty\.call\(config, "maia_active"\)/);
  assert.match(webhook, /!maiaFlagConfigured && Boolean\(maiaAgent\?\.id\)/);
  assert.match(webhook, /\.eq\("organization_id", organizationId\)/);
});

test("An explicit maia_active false prevents fallback to the Maia runtime", () => {
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook, /maiaActive = config\.maia_active === true/);
  assert.match(webhook, /if \(maiaEnabled && maiaAgent\?\.id\)/);
  assert.match(webhook, /if \(maiaActive\) \{[\s\S]*?return null;/);
});

test("Inbound WhatsApp dispatch uses tenant-and-agent scoped Trigger idempotency", () => {
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook, /const idempotencyKey = `whatsapp-inbound:\$\{tenant\.organizationId\}:\$\{tenant\.agentId\}:\$\{messageId\}`/);
  assert.match(webhook, /tasks\.trigger\("maia-process-inbound-message", inboundPayload, \{ idempotencyKey \}\)/);
  assert.match(webhook, /tasks\.trigger\("tenant-whatsapp-process-inbound-message",[\s\S]*?\{ idempotencyKey \}\)/);
});


test("Maia knowledge retrieval is scoped to the active collections bound to the agent", () => {
  const runtime = read("lib/ai/maia-runtime.ts");
  assert.match(runtime, /from\("agent_knowledge_bindings"\)/);
  assert.match(runtime, /\.eq\("organization_id", organizationId\)/);
  assert.match(runtime, /\.eq\("agent_id", agentId\)/);
  assert.match(runtime, /from\("knowledge_collections"\)/);
  assert.match(runtime, /\.in\("collection_id", collectionIds\)/);
  assert.match(runtime, /loadBoundKnowledgeSources\(ctx\.organizationId, ctx\.agentId, query, 8\)/);
  assert.match(runtime, /knowledgeScope/);
});
