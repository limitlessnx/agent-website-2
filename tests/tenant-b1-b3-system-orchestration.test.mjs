import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("B1 canonical domain event contract carries tenant and correlation context",()=>{
  const migration=read("supabase/migrations/20260926201344_b1_system_event_orchestration_foundation.sql");
  for(const field of ["source_system_id","target_system_id","customer_id","conversation_id","correlation_id","causation_id","idempotency_key"]){
    assert.match(migration,new RegExp(field));
  }
  assert.match(migration,/domain_events_source_system_tenant_fk/);
  assert.match(migration,/domain_events_target_system_tenant_fk/);
  assert.match(migration,/domain_events_org_idempotency_uidx/);
});

test("B1 publisher is service-role only and entitlement aware",()=>{
  const migration=read("supabase/migrations/20260926201344_b1_system_event_orchestration_foundation.sql");
  assert.match(migration,/organization_can_use_system/);
  assert.match(migration,/revoke all on function public\.publish_system_event/);
  assert.match(migration,/grant execute on function public\.publish_system_event[\s\S]*to service_role/);
  assert.match(migration,/Source system is not active in organization/);
  assert.match(migration,/Target system is not active in organization/);
});

test("B2 event routing is installation scoped, not global catalog routing",()=>{
  const service=read("lib/system-orchestrator.ts");
  assert.match(service,/system_event_routes/);
  assert.match(service,/source_system_id/);
  assert.match(service,/target_system_id/);
  assert.match(service,/organizationId/);
  assert.match(service,/organization_can_use_system/);
});

test("B2 target execution reuses canonical runtime and idempotency",()=>{
  const service=read("lib/system-orchestrator.ts");
  assert.match(service,/enqueue_agent_execution/);
  assert.match(service,/system-event:\$\{event\.id\}:route:\$\{route\.id\}/);
  assert.match(service,/p_conversation_id: event\.conversationId/);
});

test("B3 Trigger dispatcher and scheduled drain use the shared processor",()=>{
  const trigger=read("src/trigger/system-orchestrator.ts");
  assert.match(trigger,/id: "system-event-dispatch"/);
  assert.match(trigger,/id: "system-event-drain"/);
  assert.match(trigger,/cron: "\* \* \* \* \*"/);
  assert.match(trigger,/processSystemEvent/);
});
