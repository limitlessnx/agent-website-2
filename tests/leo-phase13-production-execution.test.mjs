import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = readFileSync(resolve(root, "lib/ai-runtime/tool-registry.ts"), "utf8");
const executors = readFileSync(resolve(root, "lib/ai-runtime/production-executors.ts"), "utf8");
const sdk = readFileSync(resolve(root, "lib/ai-runtime/sdk.ts"), "utf8");
const route = readFileSync(resolve(root, "app/api/ai-runtime/tools/execute/route.ts"), "utf8");

test("Phase 13 activates production executors in the shared registry", () => {
  assert.match(registry, /registerProductionRuntimeExecutors\(new RuntimeToolRegistry\(\)\)/);
  assert.match(executors, /leo\.tenant\.inspect/);
  assert.match(executors, /leo\.agent\.pause/);
  assert.match(executors, /leo\.platform\.workflow\.activate/);
});

test("unimplemented production tools fail closed instead of faking success", () => {
  assert.match(registry, /No runtime executor registered/);
  assert.match(registry, /Production execution is unavailable/);
  assert.doesNotMatch(registry, /return \{\s*ok:\s*true/);
});

test("production execution stays behind canonical permissions and approvals", () => {
  assert.match(sdk, /this\.tools\.resolveAllowed\(input\.identity, input\.toolKey\)/);
  assert.match(sdk, /requireRuntimeApproval/);
  assert.match(sdk, /definition\.approval !== "none"/);
  assert.match(sdk, /this\.tools\.execute/);
});

test("tool execution gateway resolves identity server side", () => {
  assert.match(route, /resolveLeoIdentity\(\{ channel: "api" \}\)/);
  assert.doesNotMatch(route, /identity\s*=\s*body\.identity/);
});

test("tenant organization scope is derived from authenticated identity", () => {
  assert.match(route, /organizationId = identity\.organizationId/);
  assert.match(route, /Cross-organization tool execution is forbidden/);
  assert.match(route, /assertTenantAgent\(organizationId, agentId\)/);
});

test("super admin direct confirmation cannot be supplied by a tenant identity", () => {
  assert.match(route, /identity\.scope === "super_admin" && body\.confirmed === true/);
});

test("production executors never expose stored integration credentials", () => {
  assert.match(executors, /organization_integrations\?select=id,provider,display_name,status,health,last_checked_at,last_connected_at,updated_at/);
  assert.doesNotMatch(executors, /select=[^`\n]*credential_reference/);
});

test("consequential agent and platform controls remain explicit registered actions", () => {
  assert.match(executors, /leo\.agent\.pause/);
  assert.match(executors, /leo\.agent\.resume/);
  assert.match(executors, /leo\.platform\.tenant\.pause/);
  assert.match(executors, /leo\.platform\.tenant\.resume/);
  assert.doesNotMatch(executors, /setInterval|setTimeout\([^,]+,\s*0\)|cron/i);
});

test("successful and failed production tool runs retain audit evidence", () => {
  assert.match(sdk, /agent_runtime_tool_runs/);
  assert.match(sdk, /status: "completed"/);
  assert.match(sdk, /status: "failed"/);
});
