import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("E3 funnel analytics uses configured stages and observed cohort reach",()=>{
  const migration=read("supabase/migrations/20260927064439_e3_e6_analytics_completion.sql");
  assert.match(migration,/get_tenant_funnel_analytics/);
  assert.match(migration,/organization_customer_stages/);
  assert.match(migration,/customer_stage_history/);
  assert.match(migration,/stepConversionRate/);
  assert.match(migration,/source_breakdown/);
  assert.match(migration,/channel_breakdown/);
  assert.match(migration,/handoffComparison/);
  assert.match(migration,/appointmentComparison/);
});

test("E3 tenant analytics renders funnel source channel and conversion context",()=>{
  const page=read("app/portal/analytics/page.tsx");
  assert.match(page,/getTenantFunnelAnalytics/);
  assert.match(page,/Customer funnel/);
  assert.match(page,/Lead source conversion/);
  assert.match(page,/Channel conversion/);
  assert.match(page,/With human handoff/);
  assert.match(page,/With confirmed appointment/);
});

test("E4 Super Admin analytics exposes deterministic tenant health",()=>{
  const migration=read("supabase/migrations/20260927064439_e3_e6_analytics_completion.sql");
  const page=read("app/dashboard/analytics/page.tsx");
  const nav=read("components/admin/navigationConfig.ts");
  assert.match(migration,/get_platform_analytics_health/);
  assert.match(migration,/systems_needing_attention/);
  assert.match(migration,/runtimeFailureRate/);
  assert.match(migration,/whatsappFailureRate/);
  assert.match(page,/Platform analytics & tenant health/);
  assert.match(page,/Health labels are deterministic operational thresholds/);
  assert.match(nav,/Analytics & Tenant Health/);
});

test("E5 value analytics only estimates from explicit organization settings",()=>{
  const migration=read("supabase/migrations/20260927064439_e3_e6_analytics_completion.sql");
  const page=read("app/portal/analytics/page.tsx");
  const settings=read("app/portal/settings/BusinessValueSettingsPanel.tsx");
  assert.match(migration,/organization_business_value_settings/);
  assert.match(migration,/get_tenant_business_value_analytics/);
  assert.match(migration,/coalesce\(v_settings\.enabled,false\)/);
  assert.match(page,/Automation business value/);
  assert.match(page,/Time\/value estimates appear only when your organization enables explicit assumptions/);
  assert.match(settings,/Enable estimated time\/value reporting/);
  assert.match(settings,/Revenue and ROI are not inferred/);
});

test("E5 settings mutations require organization manage permission",()=>{
  const route=read("app/api/portal/settings/business-value/route.ts");
  assert.match(route,/organization\.manage/);
  assert.match(route,/organization_business_value_settings/);
  assert.match(route,/upsert/);
});

test("E6 anomaly scan compares recent conditions with baseline and persists dashboard alerts",()=>{
  const migration=read("supabase/migrations/20260927064439_e3_e6_analytics_completion.sql");
  assert.match(migration,/scan_analytics_anomalies/);
  assert.match(migration,/runtime_failure_spike/);
  assert.match(migration,/whatsapp_failure_spike/);
  assert.match(migration,/handoff_spike/);
  assert.match(migration,/sla_breach/);
  assert.match(migration,/dashboard_notifications/);
  assert.match(migration,/analytics_anomaly/);
});

test("E6 anomaly notifications are tenant scoped and do not send admins to portal routes",()=>{
  const patch=read("supabase/migrations/20260927064924_e6_tenant_anomaly_audience.sql");
  assert.match(patch,/'customer','analytics_anomaly'/);
  assert.doesNotMatch(patch,/'both','analytics_anomaly'/);
});

test("E6 Trigger scan runs hourly and deploy watches anomaly logic",()=>{
  const trigger=read("src/trigger/system-orchestrator.ts");
  const workflow=read(".github/workflows/deploy-trigger.yml");
  assert.match(trigger,/id: "analytics-anomaly-sweep"/);
  assert.match(trigger,/cron: "0 \* \* \* \*"/);
  assert.match(trigger,/scanAnalyticsAnomalies/);
  assert.match(workflow,/lib\/analytics-phase-e\.ts/);
});

test("E3 E4 E5 E6 RPCs remain service-role only",()=>{
  const migration=read("supabase/migrations/20260927064439_e3_e6_analytics_completion.sql");
  for(const signature of [
    "get_tenant_funnel_analytics\\(uuid,integer\\)",
    "get_tenant_business_value_analytics\\(uuid,integer\\)",
    "get_platform_analytics_health\\(integer\\)",
    "scan_analytics_anomalies\\(\\)"
  ]){
    assert.match(migration,new RegExp("revoke all on function public\\."+signature+" from public,anon,authenticated"));
    assert.match(migration,new RegExp("grant execute on function public\\."+signature+" to service_role"));
  }
});

test("Phase E does not fabricate revenue or ROI analytics",()=>{
  const page=read("app/portal/analytics/page.tsx");
  const lib=read("lib/analytics-phase-e.ts");
  assert.doesNotMatch(page,/\bMRR\b|\bARR\b/i);
  assert.doesNotMatch(lib,/\brevenue\b|\bMRR\b|\bARR\b/i);
});

test("Phase E canonical migration versions are present",()=>{
  assert.match(read("supabase/migrations/20260927064439_e3_e6_analytics_completion.sql"),/get_tenant_funnel_analytics/);
  assert.match(read("supabase/migrations/20260927064924_e6_tenant_anomaly_audience.sql"),/scan_analytics_anomalies/);
});
