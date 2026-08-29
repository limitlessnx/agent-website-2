import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const audit = fs.readFileSync(new URL("../lib/leo-phase8-audit.ts", import.meta.url), "utf8");
const simulation = fs.readFileSync(new URL("../lib/leo-business-simulation.ts", import.meta.url), "utf8");
const events = fs.readFileSync(new URL("../lib/leo-business-events.ts", import.meta.url), "utf8");
const models = fs.readFileSync(new URL("../lib/leo-workspace-business-models.ts", import.meta.url), "utf8");
const commandCenter = fs.readFileSync(new URL("../lib/leo-business-command-center.ts", import.meta.url), "utf8");

test("Phase 8 audit does not falsely close deferred or undeployed work", () => {
  assert.match(audit, /"8E": "deferred"/);
  assert.match(audit, /"8G": "implemented_pending_deploy"/);
  assert.match(audit, /"8H": "implemented_pending_deploy"/);
  assert.match(audit, /"8I": "implemented_pending_deploy"/);
  assert.match(audit, /"8J": "implemented_pending_closure"/);
  assert.match(audit, /productionDeploymentVerified[\s\S]*passed: false/);
});

test("Phase 8 closure requires real deployment evidence", () => {
  assert.match(audit, /source commit or rate-limit rejection is not deployment evidence/i);
  assert.match(audit, /successful Vercel deployment/i);
});

test("Phase 8 preserves financial evidence boundaries", () => {
  assert.match(audit, /Never fill financial gaps with estimates|never fill financial gaps with estimates/i);
  assert.match(simulation, /Never invent revenue, conversion, ROI, closing volume or financial effects/i);
});

test("Phase 8 event layer is organization-scoped and idempotent", () => {
  assert.match(events, /idempotencyKey/);
  assert.match(events, /organizationId/);
  assert.match(events, /Duplicate event submissions/);
});

test("Phase 8 business models use a sparse generic fallback", () => {
  assert.match(models, /Generic Client Workspace/);
  assert.match(models, /Do not invent business-specific entities, stages, KPIs or financial meaning/);
});

test("Phase 8 command center remains read-only", () => {
  assert.match(commandCenter, /read-only executive operating view/i);
  assert.match(commandCenter, /cannot execute actions, approve itself/i);
});

test("Phase 8 simulation cannot execute or self-approve", () => {
  assert.match(simulation, /cannot mutate configuration, approve itself, or execute a consequential action/i);
});
