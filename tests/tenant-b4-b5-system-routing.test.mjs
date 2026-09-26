import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("B4 route templates provision only installed entitled systems",()=>{
  const migration=read("supabase/migrations/20260926202046_b4_automatic_system_event_routes.sql");
  assert.match(migration,/system_event_route_templates/);
  assert.match(migration,/sync_organization_system_event_routes/);
  assert.match(migration,/src\.status='active'/);
  assert.match(migration,/dst\.status='active'/);
  assert.match(migration,/organization_can_use_system/);
  assert.match(migration,/appointment\.requested/);
  assert.match(migration,/follow_up\.requested/);
  assert.match(migration,/appointment\.booked/);
});

test("B4 system activation synchronizes event routes",()=>{
  const service=read("lib/tenant-system-management.ts");
  const start=service.indexOf("export async function activateTenantSystem");
  assert.ok(start>=0);
  const activation=service.slice(start);
  assert.match(activation,/sync_organization_system_event_routes/);
  assert.match(activation,/route_sync/);
  const request=service.slice(service.indexOf("export async function requestTenantSystem"),start);
  assert.doesNotMatch(request,/installation\.organization_id/);
});

test("B5 workflow-only systems have deterministic adapters",()=>{
  const adapters=read("lib/system-event-adapters.ts");
  assert.match(adapters,/appointment_request/);
  assert.match(adapters,/sales_follow_up/);
  assert.match(adapters,/system_event_id/);
  assert.match(adapters,/system_event_route_id/);
  assert.match(adapters,/correlation_id/);
  assert.match(adapters,/Unsupported system workflow adapter/);
});

test("B5 orchestrator respects route dispatch mode",()=>{
  const service=read("lib/system-orchestrator.ts");
  assert.match(service,/dispatch_mode/);
  assert.match(service,/route\.dispatch_mode === "workflow_adapter"/);
  assert.match(service,/executeSystemWorkflowAdapter/);
  assert.match(service,/enqueue_agent_execution/);
});
