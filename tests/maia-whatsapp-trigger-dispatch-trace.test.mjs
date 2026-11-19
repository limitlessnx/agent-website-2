import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const webhook = readFileSync(new URL("../app/api/whatsapp/webhook/route.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/trigger/maia-runtime.ts", import.meta.url), "utf8");

test("Maia webhook records Trigger queue acceptance with run ID, not execution success", () => {
  assert.match(webhook, /recordWhatsAppTriggerDispatch/);
  assert.match(webhook, /"whatsapp_webhook_event_logs"/);
  assert.match(webhook, /trigger_run_id: input\.triggerRunId \|\| null/);
  assert.match(webhook, /triggerRunId: handle\.id/);
  assert.match(webhook, /workerStarted: false/);
  assert.match(webhook, /outcome: "accepted"/);
  assert.match(webhook, /outcome: "failed"/);
});

test("Dispatch audit does not persist customer message, phone or secrets", () => {
  const auditBlock = webhook.slice(webhook.indexOf("async function recordWhatsAppTriggerDispatch"),webhook.indexOf("async function resolveWhatsAppOrganization"));
  assert.ok(auditBlock.length > 100);
  assert.doesNotMatch(auditBlock, /customerPhone|customerName|access_token|message: input\.|phoneNumberId|payload: inboundPayload/);
  assert.match(auditBlock, /if \(error\) console\.error/);
});

test("Maia worker separately reports started, completed, failed", () => {
  assert.match(worker, /eventType: "trigger_inbound_started"/);
  assert.match(worker, /eventType: "trigger_inbound_completed"/);
  assert.match(worker, /eventType: "trigger_inbound_failed"/);
  assert.match(worker, /markMaiaInboundCompleted/);
});
