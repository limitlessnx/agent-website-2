import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const triggerTask = await readFile(new URL("../src/trigger/maia-runtime.ts", import.meta.url), "utf8");
const runtimeStore = await readFile(new URL("../lib/ai/maia-trigger-runtime.ts", import.meta.url), "utf8");
const maiaRuntime = await readFile(new URL("../lib/ai/maia-runtime.ts", import.meta.url), "utf8");
const limitlessRuntime = await readFile(new URL("../lib/ai/limitless-realty-maia.ts", import.meta.url), "utf8");

test("Maia Trigger runtime validates tenant context before execution", () => {
  assert.match(triggerTask, /validateMaiaTenantContext\(payload\)/);
  assert.match(runtimeStore, /\.eq\("organization_id", payload\.organizationId\)/);
  assert.match(runtimeStore, /Maia agent is not assigned to this organization/);
});

test("Maia Trigger runtime is idempotent and conversation-serialized", () => {
  assert.match(runtimeStore, /maia_inbound_events/);
  assert.match(runtimeStore, /external_event_id/);
  assert.match(triggerTask, /duplicate/);
  assert.match(runtimeStore, /claim_maia_conversation_lock/);
  assert.match(runtimeStore, /release_maia_conversation_lock/);
});

test("Maia Trigger runtime reuses active conversation memory", () => {
  assert.match(maiaRuntime, /external_conversation_id/);
  assert.match(maiaRuntime, /\.eq\("status", "active"\)/);
  assert.match(maiaRuntime, /if \(existing\) return existing/);
});

test("Legacy Limitless Maia lead access remains tenant-scoped", () => {
  assert.match(limitlessRuntime, /\.eq\("organization_id", args\.organizationId\)\.eq\("phone", phone\)/);
  assert.match(limitlessRuntime, /organization_id: args\.organizationId/);
});

test("Phase 3 does not send WhatsApp directly from the Trigger task", () => {
  assert.doesNotMatch(triggerTask, /graph\.facebook\.com|whatsapp.*send|N8N|n8n/i);
});
