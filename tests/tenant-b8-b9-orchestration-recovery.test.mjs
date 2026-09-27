import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("B8 recovery RPC retries only failed hops and audits the request",()=>{
  const migration=read("supabase/migrations/20260926225743_b8_orchestration_recovery_observability.sql");
  assert.match(migration,/retry_failed_system_event/);
  assert.match(migration,/and status='failed'/);
  assert.match(migration,/retry_count=retry_count\+1/);
  assert.match(migration,/system_event\.retry_requested/);
  assert.match(migration,/to service_role/);
});

test("B8 recovery policy only auto retries transient infrastructure failures",()=>{
  const ops=read("lib/orchestration-operations.ts");
  assert.match(ops,/category: "transient", retryable: true/);
  assert.match(ops,/category: "entitlement", retryable: false/);
  assert.match(ops,/category: "permission", retryable: false/);
  assert.match(ops,/category: "configuration", retryable: false/);
  assert.match(ops,/autoRetryCount < 2/);
  assert.match(ops,/Automatic retry for transient orchestration failure/);
  assert.match(ops,/ensureFailureSupportCase/);
});

test("B8 Trigger keeps orchestration recovery available on demand while schedules are paused",()=>{
  const trigger=read("src/trigger/system-orchestrator.ts");
  assert.match(trigger,/id: "orchestration-recovery-sweep"/);
  assert.doesNotMatch(trigger,/schedules\.task/);
  assert.match(trigger,/recoverFailedSystemEvents/);
});

test("B8 B9 Leo can inspect tenant chains while retry stays Super Admin only",()=>{
  const core=read("lib/leo-core.ts");
  const route=read("app/api/leo/tool/route.ts");
  assert.match(core,/leo\.orchestration\.inspect/);
  assert.match(core,/scopes: \["tenant", "super_admin"\]/);
  assert.match(core,/leo\.platform\.orchestration\.retry/);
  assert.match(core,/scopes: \["super_admin"\]/);
  assert.match(core,/approval: "confirm"/);
  assert.match(route,/inspectOrchestrationChain/);
  assert.match(route,/retryFailedSystemEvent/);
  assert.match(route,/organization_id and event_id are required for orchestration retry/);
});

test("B9 Tenant Super Leo and Operations receive orchestration failure evidence",()=>{
  const context=read("lib/leo-context.ts");
  const support=read("app/api/support/leo/route.ts");
  const activity=read("app/dashboard/activity/page.tsx");
  assert.match(context,/orchestrationFailures/);
  assert.match(context,/canWorkflows \? orchestrationFailures : \[\]/);
  assert.match(support,/orchestrationFailures/);
  assert.match(activity,/Orchestration Failures/);
  assert.match(activity,/correlationId/);
  assert.match(activity,/retryCount/);
});

test("B9 observability reader reports safe failure and escalation metadata",()=>{
  const observer=read("lib/orchestration-observability.ts");
  assert.match(observer,/system_event_deliveries/);
  assert.match(observer,/system_catalog/);
  assert.match(observer,/failureCategory/);
  assert.match(observer,/supportConversationId/);
  assert.match(observer,/created_at/);
  assert.doesNotMatch(observer,/access_token|refresh_token|client_secret/i);
});
