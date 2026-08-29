import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const governance = readFileSync(resolve(root, "lib/leo-autonomy-governance.ts"), "utf8");
const optimization = readFileSync(resolve(root, "lib/leo-autonomous-optimization.ts"), "utf8");
const executive = readFileSync(resolve(root, "lib/leo-executive-command.ts"), "utf8");
const phase7 = readFileSync(resolve(root, "lib/leo-phase7-audit.ts"), "utf8");
const goals = readFileSync(resolve(root, "lib/leo-autonomous-goals.ts"), "utf8");
const workspaces = readFileSync(resolve(root, "lib/leo-cross-workspace.ts"), "utf8");

test("Phase 7 governance permanently disables autonomous consequential execution", () => {
  assert.match(governance, /consequentialAutonomousExecution: false/);
  assert.match(governance, /allowSelfApproval: false/);
  assert.match(governance, /requireCanonicalApproval/);
  assert.match(governance, /requireEvidenceBeforeRetry/);
});

test("Phase 7 governance exposes a kill switch and workspace pauses", () => {
  assert.match(governance, /killSwitch/);
  assert.match(governance, /pausedOrganizationIds/);
  assert.match(governance, /canLeoCreateControlledIntervention/);
});

test("autonomous optimization stays proposal-first and uses controlled orchestration", () => {
  assert.match(optimization, /Proposal only/i);
  assert.match(optimization, /createLeoMultiAgentOrchestration/);
  assert.match(optimization, /rollbackStrategy/);
  assert.doesNotMatch(optimization, /executeLeoEnvelopeViaN8n/);
});

test("executive command refuses invented financial metrics and preserves approvals", () => {
  assert.match(executive, /Do not invent revenue, profit, conversion value or financial forecasts/);
  assert.match(executive, /canonical 6K\/6M approvals/);
});

test("autonomous goals remain observe and recommend", () => {
  assert.match(goals, /autonomy: "observe_recommend"/);
});

test("cross-workspace implementation keeps exact organization identity", () => {
  assert.match(workspaces, /organizationId/);
  assert.match(workspaces, /Only one workspace segment/i);
});

test("7F remains explicitly deferred while 7G through 7J close", () => {
  assert.match(phase7, /"7F": "deferred"/);
  assert.match(phase7, /"7G": "closed"/);
  assert.match(phase7, /"7J": "closed"/);
  assert.match(phase7, /No escalation team or automatic human assignment/);
});
