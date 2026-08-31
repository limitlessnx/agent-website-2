import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const registry = readFileSync(resolve(root, "lib/ai-runtime/tool-registry.ts"), "utf8");
const tools = readFileSync(resolve(root, "lib/ai-runtime/production-tools.ts"), "utf8");
const sdk = readFileSync(resolve(root, "lib/ai-runtime/sdk.ts"), "utf8");
const route = readFileSync(resolve(root, "app/api/internal/runtime/tools/execute/route.ts"), "utf8");

test("Phase 13 runtime SDK activates production executors", () => {
  assert.match(sdk, /registerProductionRuntimeTools\(createRuntimeToolRegistry\(\)\)/);
  assert.match(tools, /registerProductionRuntimeTools/);
});

test("consequential executors require runtime SDK authorization", () => {
  assert.match(registry, /source: "runtime-sdk"/);
  assert.match(registry, /definition\.approval !== "none" && !input\.authorization\.approved/);
  assert.match(sdk, /requireRuntimeApproval/);
});

test("internal specialist agents receive tenant tools but never platform tools", () => {
  assert.match(registry, /identity\.scope === "internal_service"/);
  assert.match(registry, /tool\.scopes\.includes\("tenant"\)/);
  assert.match(registry, /!resolved\.scopes\.includes\("tenant"\)/);
});

test("production tools preserve exact organization boundaries", () => {
  assert.match(tools, /Cross-organization production execution is forbidden/);
  assert.match(tools, /organization_uuid=eq\.\$\{encodeURIComponent\(organizationId\)\}/);
  assert.match(route, /\.eq\("organization_id", organizationId\)/);
  assert.match(route, /\.eq\("agent_id", agentId\)/);
});

test("CRM and agent writes are scoped and field constrained", () => {
  assert.match(tools, /safeLeadPatch/);
  assert.match(tools, /organization_id=eq\.\$\{encodeURIComponent\(organizationId\)\}/);
  assert.match(tools, /status: "paused"/);
  assert.match(tools, /status: "active"/);
});

test("external workflow sends use signed Phase 10 n8n execution", () => {
  assert.match(tools, /new LeoN8nExecutor/);
  assert.match(tools, /FLUXKNIGHT_N8N_SIGNING_SECRET|loadLeoRuntimeConfiguration/);
  assert.match(tools, /risk: consequential \? "consequential" : "read_only"/);
});

test("production tool endpoint cannot bypass approval ledger", () => {
  assert.match(route, /sdk\.executeTool/);
  assert.match(route, /approvalRequestId/);
  assert.doesNotMatch(route, /superAdminConfirmed:\s*true/);
});

test("Phase 13 emits auditable tool progress and tool-run records", () => {
  assert.match(route, /runtime_progress_events/);
  assert.match(sdk, /agent_runtime_tool_runs/);
  assert.match(route, /phase13\.tool\.\$\{result\.status\}/);
});
