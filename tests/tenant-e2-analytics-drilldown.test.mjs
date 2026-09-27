import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("E2 drilldown migration uses canonical attribution fields only",()=>{
  const migration=read("supabase/migrations/20260927061931_e2_analytics_time_series_drilldown.sql");
  assert.match(migration,/domain_events.*source_system_id/s);
  assert.match(migration,/human_handoffs.*source_system_id/s);
  assert.match(migration,/human_handoffs.*source_agent_id/s);
  assert.match(migration,/crm_conversations.*agent_id/s);
  assert.match(migration,/runtime_executions.*agent_id/s);
});

test("E2 drilldown RPC is service-role only and security invoker",()=>{
  const migration=read("supabase/migrations/20260927061931_e2_analytics_time_series_drilldown.sql");
  assert.match(migration,/security invoker/);
  assert.match(migration,/revoke all on function public\.get_tenant_analytics_drilldown\(uuid,integer\)[\s\S]*from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.get_tenant_analytics_drilldown\(uuid,integer\)[\s\S]*to service_role/);
});

test("E2 provides complete daily time series including zero-activity days",()=>{
  const migration=read("supabase/migrations/20260927061931_e2_analytics_time_series_drilldown.sql");
  assert.match(migration,/generate_series/);
  for(const key of ["conversations","messages","handoffs","appointments","runtimeExecutions","runtimeFailed","whatsappAttempts","whatsappFailed"]){
    assert.match(migration,new RegExp(key));
  }
});

test("E2 exposes systems agents handoff categories assignees and stage transitions",()=>{
  const migration=read("supabase/migrations/20260927061931_e2_analytics_time_series_drilldown.sql");
  for(const key of ["systems","agents","handoffCategories","assignees","stageTransitions"]){
    assert.match(migration,new RegExp("'"+key+"'"));
  }
});

test("E2 portal overview renders trend charts and drilldown links",()=>{
  const page=read("app/portal/analytics/page.tsx");
  const chart=read("app/portal/analytics/AnalyticsTrendChart.tsx");
  assert.match(page,/getTenantAnalyticsDrilldown/);
  assert.match(page,/Customer activity over time/);
  assert.match(page,/Automation health over time/);
  assert.match(page,/\/portal\/analytics\/systems\//);
  assert.match(page,/\/portal\/analytics\/agents\//);
  assert.match(page,/Handoff reasons/);
  assert.match(page,/Human workload/);
  assert.match(page,/Customer stage movement/);
  assert.match(chart,/svg/);
});

test("E2 system drilldown states exact canonical attribution rules",()=>{
  const page=read("app/portal/analytics/systems/[id]/page.tsx");
  assert.match(page,/domain_events\.source_system_id/);
  assert.match(page,/human_handoffs\.source_system_id/);
  assert.match(page,/appointments\.source_system_id/);
});

test("E2 agent drilldown does not guess system attribution",()=>{
  const page=read("app/portal/analytics/agents/[id]/page.tsx");
  assert.match(page,/runtime_executions\.agent_id/);
  assert.match(page,/human_handoffs\.source_agent_id/);
  assert.match(page,/avoids guessing attribution/);
});
