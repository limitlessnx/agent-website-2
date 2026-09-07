import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const lifecycle = fs.readFileSync(new URL("../lib/leo-lifecycle-operations.ts", import.meta.url), "utf8");
const commandCenter = fs.readFileSync(new URL("../lib/leo-business-command-center.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/leo/lifecycle/route.ts", import.meta.url), "utf8");

test("Leo lifecycle intelligence is restricted to Super Leo", () => {
  assert.match(lifecycle, /identity\.scope !== "super_admin"/);
  assert.match(route, /identity\.scope !== "super_admin"/);
});

test("Leo lifecycle intelligence keeps risk above expansion", () => {
  assert.match(lifecycle, /Customer risk overrides expansion/i);
  assert.match(lifecycle, /!\["high", "critical"\]\.includes\(item\.attention\)/);
});

test("Leo lifecycle intelligence answers attention risk next-action and expansion questions", () => {
  assert.match(lifecycle, /workspace_risk_explanation/);
  assert.match(lifecycle, /expansion_ready/);
  assert.match(lifecycle, /next_actions/);
  assert.match(lifecycle, /attention_queue/);
});

test("Leo lifecycle intelligence remains read only", () => {
  assert.match(lifecycle, /read-only/i);
  assert.match(lifecycle, /cannot execute account, billing, support, integration or outreach changes/i);
});

test("Leo command center consumes customer lifecycle evidence", () => {
  assert.match(commandCenter, /buildLeoLifecycleOperations/);
  assert.match(commandCenter, /source: "customer_lifecycle"/);
  assert.match(commandCenter, /retentionRiskScore/);
  assert.match(commandCenter, /nextAction/);
});
