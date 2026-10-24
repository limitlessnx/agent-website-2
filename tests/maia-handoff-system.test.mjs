import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Maia supervisor handoff is external and canonical", () => {
  const runtime = read("lib/ai/maia-runtime.ts");
  const operations = read("lib/human-operations.ts");
  assert.match(runtime, /handoff_to_human_supervisor/);
  assert.match(runtime, /createHumanHandoffFromMaia/);
  assert.match(runtime, /maiaChatTakeover: false/);
  assert.match(operations, /create_human_handoff/);
  assert.match(operations, /handoff_notifications/);
  assert.match(operations, /sendWhatsAppMessage/);
  assert.match(operations, /recipientType:"internal_staff"/);
});

test("Maia can notify the configured agent handoff phone before membership linking", () => {
  const operations = read("lib/human-operations.ts");
  const migration = read("supabase/migrations/20261023044818_handoff_phone_destination_notifications.sql");
  assert.match(operations, /agent_destination_phone/);
  assert.match(operations, /human_handoff_destination/);
  assert.match(operations, /destinationPhone/);
  assert.match(operations, /destination_source/);
  assert.match(migration, /alter column membership_id drop not null/);
});

test("Maia WhatsApp runtime persists canonical customer conversations and suppresses Maia while handed off", () => {
  const runtime = read("src/trigger/maia-runtime.ts");
  assert.match(runtime, /resolveCanonicalCustomer/);
  assert.match(runtime, /getOrCreateCanonicalConversation/);
  assert.match(runtime, /addCanonicalCrmMessage/);
  assert.match(runtime, /human_handoff_active/);
  assert.match(runtime, /conversationId/);
});

test("Supervisor settings require supervisor designation before routing", () => {
  const api = read("app/api/portal/settings/handoffs/route.ts");
  const panel = read("app/portal/settings/HandoffContinuityPanel.tsx");
  assert.match(api, /supervisor/);
  assert.match(api, /Assignment target must be configured as a supervisor/);
  assert.match(panel, /Human supervisors/);
  assert.match(panel, /isSupervisor/);
  assert.match(panel, /supervisorName/);
});

test("Customer profile exposes expandable conversation history", () => {
  const route = read("app/portal/customers/[id]/page.tsx");
  assert.match(route, /Conversation history/);
  assert.match(route, /<details/);
  assert.match(route, /human_handoffs/);
  assert.match(route, /Open conversation/);
});

// Draft guardrail suite: external supervisor handoff only.

test("Meta handoff notifications retry 24-hour-window failures with the approved staff template", () => {
  const operations = read("lib/human-operations.ts");
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  const delivery = read("lib/whatsapp-delivery.ts");
  const templateMigration = read("supabase/migrations/20261023131133_register_xposure_staff_handoff_template.sql");
  assert.match(operations, /syncHandoffNotificationStatus/);
  assert.match(operations, /input\.errorCode!=="131047"/);
  assert.match(operations, /templatePurpose:"human_handoff_staff"/);
  // Purpose is the tenant-scoped lookup key, not the Meta template name.
  assert.match(templateMigration, /\x27human_handoff_staff\x27/);
  assert.match(templateMigration, /\x27hand_over_\x27/);
  assert.match(templateMigration, /business_name.*customer_name.*customer_phone.*handoff_reason.*conversation_summary/s);
  assert.match(delivery, /getTemplateConfig\(input\.organizationId,input\.templatePurpose\|\|"follow_up_outside_24h"\)/);
  assert.match(delivery, /template:\s*\{\s*name:\s*config!\.template_name/);
  assert.match(operations, /fallback_template_attempted:true/);
  assert.match(webhook, /syncHandoffNotificationStatus/);
  assert.match(webhook, /errorMessage: firstError\?\.error_data\?\.details/);
});

test("Handoff dashboard notification status reflects asynchronous provider failures", () => {
  const operations = read("lib/human-operations.ts");
  const webhook = read("app/api/whatsapp/webhook/route.ts");
  assert.match(operations, /status:"failed",error_message:message/);
  assert.match(webhook, /handoff notification status sync failed/);
});
