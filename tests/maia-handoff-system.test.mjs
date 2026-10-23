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
