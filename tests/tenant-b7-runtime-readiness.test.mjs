import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(path,"utf8");

test("B7 queue execution uses canonical runtime readiness and service-role only access",()=>{
  const migration=read("supabase/migrations/20260926203120_b7_restore_runtime_readiness_gate.sql");
  assert.match(migration,/agent_runtime_readiness/);
  assert.doesNotMatch(migration,/agent_readiness_snapshots/);
  assert.match(migration,/readiness_score=100/);
  assert.match(migration,/Agent is not active in organization/);
  assert.match(migration,/Idempotency key is required/);
  assert.match(migration,/to service_role/);
});

test("B7 system testing gates agent-backed systems on canonical readiness",()=>{
  const service=read("lib/tenant-system-management.ts");
  assert.match(service,/requiredAgentCount/);
  assert.match(service,/agent_runtime_readiness/);
  assert.match(service,/readiness_score/);
  assert.match(service,/agentRuntimeReady/);
  assert.match(service,/Required workflows and agent runtime readiness must pass before activation/);
  assert.match(service,/requiredAgentCount === 0/);
});
