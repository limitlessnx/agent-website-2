import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLimitlessHandoffAcknowledgement } from "../lib/ai/limitless-handoff-policy.mjs";

const runtime = readFileSync("lib/ai/maia-runtime.ts", "utf8");

test("delivered and read handoff notifications are described as delivered", () => {
  for (const status of ["delivered", "read"]) {
    const reply = buildLimitlessHandoffAcknowledgement(status);
    assert.match(reply, /request for human assistance has been recorded/i);
    assert.match(reply, /staff notification has been delivered/i);
    assert.doesNotMatch(reply, /delivery is still pending/i);
  }
});

test("provider acceptance alone never becomes a delivered claim", () => {
  for (const status of ["sent", "pending", "unknown", "provider-accepted", null, undefined]) {
    const reply = buildLimitlessHandoffAcknowledgement(status);
    assert.match(reply, /delivery is still pending verification/i);
    assert.doesNotMatch(reply, /staff notification has been delivered/i);
    assert.match(reply, /not a confirmed appointment/i);
  }
});

test("failed handoff notification keeps the request in the team queue without a delivery claim", () => {
  const reply = buildLimitlessHandoffAcknowledgement("failed");
  assert.match(reply, /staff notification failed/i);
  assert.match(reply, /remains in the team's handover queue/i);
  assert.doesNotMatch(reply, /notification has been delivered/i);
});

test("unassigned handoff clearly remains queued for a human assignment", () => {
  const reply = buildLimitlessHandoffAcknowledgement("unassigned");
  assert.match(reply, /team member still needs to be assigned/i);
  assert.match(reply, /handover queue/i);
  assert.doesNotMatch(reply, /notification has been delivered/i);
});

test("Maia runtime uses the tested acknowledgement and exits its tool loop after handoff", () => {
  assert.match(runtime, /buildLimitlessHandoffAcknowledgement\(state\.notificationStatus\)/);
  assert.match(runtime, /if\s*\(finalText\)\s*break;/);
});
