import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const context = await readFile(new URL("../lib/ai-runtime/context.ts", import.meta.url), "utf8");
const tools = await readFile(new URL("../lib/ai-runtime/tool-registry.ts", import.meta.url), "utf8");
const memory = await readFile(new URL("../lib/ai-runtime/memory.ts", import.meta.url), "utf8");
const session = await readFile(new URL("../lib/ai-runtime/session.ts", import.meta.url), "utf8");
const router = await readFile(new URL("../lib/ai-runtime/model-router.ts", import.meta.url), "utf8");
const approvals = await readFile(new URL("../lib/ai-runtime/approvals.ts", import.meta.url), "utf8");
const bus = await readFile(new URL("../lib/ai-runtime/agent-bus.ts", import.meta.url), "utf8");
const stream = await readFile(new URL("../lib/ai-runtime/stream.ts", import.meta.url), "utf8");
const provider = await readFile(new URL("../lib/ai-runtime/provider.ts", import.meta.url), "utf8");
const sdk = await readFile(new URL("../lib/ai-runtime/sdk.ts", import.meta.url), "utf8");
const engineRoute = await readFile(new URL("../app/api/leo/runtime/engine/route.ts", import.meta.url), "utf8");
const approvalRoute = await readFile(new URL("../app/api/leo/runtime/approvals/route.ts", import.meta.url), "utf8");

 test("Phase 11 builds one organization-scoped runtime context", () => {
  assert.match(context, /buildRuntimeContext/);
  assert.match(context, /Cross-organization runtime context is forbidden/);
  assert.match(context, /sanitizeLeoPageContext/);
  assert.match(context, /loadRuntimeMemory/);
});

test("Phase 11 tool registry delegates authority to the canonical Leo permission engine", () => {
  assert.match(tools, /assertLeoToolAllowed/);
  assert.match(tools, /listLeoToolsForIdentity/);
  assert.match(tools, /No runtime executor registered/);
});

test("Phase 11 persistent memory and sessions are pinned to organization agent and session", () => {
  assert.match(memory, /Cross-organization runtime memory access is forbidden/);
  assert.match(memory, /organization_id=eq/);
  assert.match(memory, /agent_id=eq/);
  assert.match(memory, /session_id=eq/);
  assert.match(session, /Cross-organization runtime session access is forbidden/);
});

test("Phase 11 multi-model routing only permits Super Admin overrides", () => {
  assert.match(router, /Only Super Admin can override the runtime model/);
  assert.match(router, /agent_provider_assignments/);
  assert.match(router, /organization_ai_model_assignments/);
  assert.match(router, /environment_default/);
  assert.match(engineRoute, /Only Super Admin can override the runtime model/);
});

test("Phase 11 model output cannot grant or execute its own tools", () => {
  assert.match(provider, /You may propose allowed tools, but you cannot approve or execute them yourself/);
  assert.match(sdk, /resolveAllowed/);
  assert.match(sdk, /createRuntimeApproval/);
});

test("Phase 11 approval evidence is bound to organization execution and action", () => {
  assert.match(approvals, /execution_id=eq/);
  assert.match(approvals, /action_key=eq/);
  assert.match(approvals, /organization_id=eq/);
  assert.match(approvals, /assertLeoToolAllowed/);
  assert.match(approvalRoute, /reviewRuntimeApproval/);
});

test("Phase 11 agent communication cannot cross organization routes", () => {
  assert.match(bus, /Cross-organization agent communication is forbidden/);
  assert.match(bus, /agent_orchestration_routes/);
  assert.match(bus, /target_type=eq\.agent/);
  assert.match(bus, /status=eq\.active/);
});

test("Phase 11 exposes streaming runtime events", () => {
  assert.match(stream, /text\/event-stream/);
  assert.match(stream, /RuntimeStreamEvent/);
  assert.match(stream, /runtime\.delta/);
  assert.match(stream, /runtime\.completed/);
});

test("Phase 11 SDK persists reasoning and keeps execution behind the tool gateway", () => {
  assert.match(sdk, /class AgentRuntimeSDK/);
  assert.match(sdk, /appendRuntimeMessage/);
  assert.match(sdk, /executeTool/);
  assert.match(sdk, /requireRuntimeApproval/);
  assert.match(sdk, /agent_runtime_tool_runs/);
});
