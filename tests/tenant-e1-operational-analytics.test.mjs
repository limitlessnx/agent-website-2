import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("E1 analytics migration uses canonical tenant data sources",()=>{
  const migration=read("supabase/migrations/20260927061815_e1_tenant_operational_analytics.sql");
  for(const source of [
    "crm_customers","crm_conversations","crm_messages","runtime_executions","runtime_tool_calls",
    "human_handoffs","appointments","whatsapp_delivery_attempts","organization_systems","customer_stage_history"
  ]) assert.match(migration,new RegExp(source));
  assert.doesNotMatch(migration,/agent_conversations/);
  assert.doesNotMatch(migration,/conversation_messages/);
  assert.doesNotMatch(migration,/handoff_requests/);
});

test("E1 analytics RPC is service-role only and security invoker",()=>{
  const migration=read("supabase/migrations/20260927061815_e1_tenant_operational_analytics.sql");
  assert.match(migration,/security invoker/);
  assert.match(migration,/revoke all on function public\.get_tenant_operational_analytics\(uuid,integer\)[\s\S]*from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.get_tenant_operational_analytics\(uuid,integer\)[\s\S]*to service_role/);
});

test("E1 analytics compares current and immediately previous equal periods",()=>{
  const migration=read("supabase/migrations/20260927061815_e1_tenant_operational_analytics.sql");
  assert.match(migration,/v_previous_start := v_now - make_interval\(days=>v_days\*2\)/);
  assert.match(migration,/created_at>=v_previous_start and created_at<v_start/);
});

test("E1 analytics exposes handoff SLA, claim, resolution and follow-up metrics",()=>{
  const migration=read("supabase/migrations/20260927061815_e1_tenant_operational_analytics.sql");
  for(const key of ["slaTracked","slaMetRate","slaBreached","avgClaimMinutes","avgResolutionMinutes","followUpRequired","followUpCompleted"]){
    assert.match(migration,new RegExp(key));
  }
});

test("E1 portal analytics uses the canonical RPC reader and 7 30 90 day periods",()=>{
  const page=read("app/portal/analytics/page.tsx");
  const reader=read("lib/tenant-operational-analytics.ts");
  assert.match(page,/getTenantOperationalAnalytics/);
  assert.match(page,/\[7,30,90\]/);
  assert.match(page,/Human handoff performance/);
  assert.match(page,/AI execution health/);
  assert.match(page,/Customer stages/);
  assert.match(page,/Conversation channels/);
  assert.match(reader,/rpc\/get_tenant_operational_analytics/);
});

test("E1 SLA met rate only uses handoffs with an SLA",()=>{
  const migration=read("supabase/migrations/20260927061815_e1_tenant_operational_analytics.sql");
  assert.match(migration,/slaTracked/);
  assert.match(migration,/hm\.sla_tracked=0/);
  assert.match(migration,/hm\.sla_tracked-hm\.sla_breached/);
});

test("E1 containment label is explicitly not customer satisfaction",()=>{
  const page=read("app/portal/analytics/page.tsx");
  assert.match(page,/containment indicator, not a customer-satisfaction score/);
});

test("E1 analytics does not fabricate revenue or ROI",()=>{
  const page=read("app/portal/analytics/page.tsx");
  const migration=read("supabase/migrations/20260927061815_e1_tenant_operational_analytics.sql");
  assert.doesNotMatch(page,/\bROI\b|\bMRR\b|\bARR\b/i);
  assert.doesNotMatch(migration,/\brevenue\b|\bMRR\b|\bARR\b/i);
});
