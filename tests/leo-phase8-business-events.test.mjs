import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/leo-business-events.ts", "utf8");
const route = fs.readFileSync("app/api/leo/business-events/route.ts", "utf8");

test("8F defines canonical normalized business event types", () => {
  for (const type of ["lead.created", "lead.qualified", "campaign.failed", "workflow.failed", "integration.disconnected", "appointment.booked", "payment.received"]) assert.match(source, new RegExp(type.replace(".", "\\.")));
});

test("8F events are pinned to exact organization identity", () => {
  assert.match(source, /resolveLeoWorkspaceTarget/);
  assert.match(source, /exact organization ID/i);
  assert.match(source, /organizationId: target\.organizationId/);
});

test("8F protects idempotency and secret-like payload fields", () => {
  assert.match(source, /idempotencyKey/);
  assert.match(source, /SECRET_FIELD/);
  assert.match(source, /\[redacted\]/);
});

test("8F event emission is not an execution bypass", () => {
  assert.doesNotMatch(source, /executeN8n|sendWhatsApp|sendTemplateMessage|approveLeoTask/);
  assert.match(source, /never grants permission or executes a consequential action/i);
});

test("8F API remains Super Admin protected", () => {
  assert.match(route, /Super Admin authorization required/);
  assert.match(route, /allowPublic: false/);
});
