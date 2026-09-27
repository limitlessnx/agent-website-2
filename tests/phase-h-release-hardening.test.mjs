import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("H1 migration hardens privileged database surfaces",()=>{
  const sql=read("supabase/migrations/20260927153356_h1_release_security_hardening.sql");
  assert.match(sql,/security_invoker = true/);
  assert.match(sql,/set_updated_at\(\) set search_path = ''/);
  assert.match(sql,/sanitize_lead_budget_phone_collision\(\) set search_path = ''/);
  for(const fn of [
    "seed_customer_stages_for_new_organization",
    "sync_flux_credit_threshold_notification",
    "sync_flux_subscription_wallet_trigger",
    "timeline_from_appointment",
    "timeline_from_crm_lead",
    "timeline_from_crm_message",
    "timeline_from_crm_task",
    "timeline_from_domain_event",
  ]){
    assert.match(sql,new RegExp(`revoke all on function public\\.${fn}\\(\\) from public, anon, authenticated`));
    assert.match(sql,new RegExp(`grant execute on function public\\.${fn}\\(\\) to service_role`));
  }
});

test("H1 Leo monitor isolates secondary notification failures",()=>{
  const route=read("app/api/leo/monitor/route.ts");
  assert.match(route,/Promise\.allSettled/);
  assert.match(route,/Leo proactive notification sync degraded/);
  assert.match(route,/Leo lifecycle notification sync degraded/);
  assert.match(route,/listPersistedLeoSignals\(500\)\.catch/);
  assert.match(route,/degraded:/);
});

test("H1 release workflow still gates regression TypeScript and Trigger deployment",()=>{
  const workflow=read(".github/workflows/deploy-trigger.yml");
  assert.match(workflow,/npm run test:support/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/npm run trigger:deploy/);
  assert.match(workflow,/Fail workflow when Trigger\.dev deploy failed/);
});

test("H1 Vercel project configuration remains valid JSON and release branch deployable",()=>{
  const config=JSON.parse(read("vercel.json"));
  assert.ok(config.git?.deploymentEnabled);
  assert.equal(config.git.deploymentEnabled["feature/realestate-email-home-cta"],false);
  assert.ok(Array.isArray(config.crons));
});
