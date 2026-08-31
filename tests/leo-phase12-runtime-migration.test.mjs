import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../lib/ai-runtime/migration.ts", import.meta.url), "utf8");
const provider = await readFile(new URL("../lib/ai-runtime/provider.ts", import.meta.url), "utf8");
const supportModel = await readFile(new URL("../lib/ai/support-model.ts", import.meta.url), "utf8");
const specialistProvider = await readFile(new URL("../app/api/internal/runtime/provider/execute/route.ts", import.meta.url), "utf8");
const agentEntry = await readFile(new URL("../app/api/internal/runtime/agents/execute/route.ts", import.meta.url), "utf8");
const runtimeIndex = await readFile(new URL("../lib/ai-runtime/index.ts", import.meta.url), "utf8");

test("Phase 12 defines one migration adapter for Leo Maia and specialists", () => {
  assert.match(migration, /PHASE12_AGENT_KINDS/);
  assert.match(migration, /"leo"/);
  assert.match(migration, /"maia"/);
  assert.match(migration, /"sales"/);
  assert.match(migration, /"support"/);
  assert.match(migration, /"voice"/);
  assert.match(migration, /"specialist"/);
  assert.match(runtimeIndex, /ai-runtime\/migration/);
});

test("Phase 12 full agent reasoning enters through AgentRuntimeSDK", () => {
  assert.match(migration, /new AgentRuntimeSDK/);
  assert.match(migration, /sdk\.reason/);
  assert.match(migration, /phase: 12/);
  assert.match(agentEntry, /runPhase12Agent/);
  assert.match(agentEntry, /Shared AgentRuntimeSDK completed reasoning/);
});

test("Phase 12 service identities cannot float across organizations", () => {
  assert.match(migration, /Internal runtime identity requires an organization ID/);
  assert.match(migration, /Internal service identity must remain pinned to the exact organization/);
  assert.match(migration, /Cross-organization Phase 12 agent execution is forbidden/);
  assert.match(agentEntry, /\.eq\("organization_id", organizationId\)/);
  assert.match(agentEntry, /\.eq\("agent_id", agentId\)/);
});

test("Phase 12 resolves migrated agents only inside their organization", () => {
  assert.match(migration, /resolvePhase12AgentId/);
  assert.match(migration, /organization_id=eq/);
  assert.match(migration, /Requested Phase 12 agent does not belong to this organization/);
});

test("Leo support model uses the shared model router instead of its bespoke provider call", () => {
  assert.match(supportModel, /runPhase12StructuredAgent/);
  assert.match(supportModel, /resolvePhase12AgentId/);
  assert.doesNotMatch(supportModel, /api\.openai\.com\/v1\/chat\/completions/);
  assert.match(supportModel, /reason: "provider_error"/);
  assert.match(supportModel, /reason: "invalid_response"/);
});

test("Maia and specialist provider execution uses the same Phase 12 router", () => {
  assert.match(specialistProvider, /runPhase12StructuredAgent/);
  assert.match(specialistProvider, /return "maia" as const/);
  assert.match(specialistProvider, /return "voice" as const/);
  assert.match(specialistProvider, /return "sales" as const/);
  assert.doesNotMatch(specialistProvider, /api\.openai\.com\/v1\/responses/);
});

test("Phase 12 structured completion uses the Phase 11 controlled model route", () => {
  assert.match(migration, /routeRuntimeModel/);
  assert.match(migration, /generateRuntimeStructuredOutput/);
  assert.match(provider, /RuntimeModelRoute/);
  assert.match(provider, /The Fluxknight runtime model router selected this model/);
});

test("Phase 12 keeps model choice and actions separate", () => {
  assert.match(provider, /Do not change provider, model, permissions, or organization scope/);
  assert.match(provider, /without claiming tool execution/);
  assert.match(migration, /sdk\.reason/);
});
