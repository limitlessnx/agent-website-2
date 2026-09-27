import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("G keeps Flux Credits as the canonical tenant usage currency",()=>{
  const credits=read("lib/flux-credits.ts");
  const plans=read("lib/fluxknight-plans.ts");
  assert.match(credits,/sync_flux_credit_wallet_from_subscription/);
  assert.match(credits,/record_flux_credit_usage/);
  assert.match(credits,/adjust_flux_credit_wallet/);
  assert.match(plans,/FLUX_CREDIT_ACTION_RATES/);
  assert.match(plans,/whatsapp_ai: 4/);
  assert.match(plans,/ai_email: 3/);
  assert.match(plans,/email_follow_up: 2/);
  assert.match(plans,/whatsapp_follow_up_reminder: 3/);
  assert.match(plans,/leo_voice_minute: 20/);
});

test("G admin-created trials use canonical 14-day 250-credit policy",()=>{
  const route=read("app/api/admin/subscriptions/route.ts");
  assert.match(route,/BASIC_FREE_TRIAL_DAYS/);
  assert.match(route,/BASIC_FREE_TRIAL_CREDITS/);
  assert.doesNotMatch(route,/7 \* 24 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(route,/trialing" \? 500/);
});

test("G subscription changes synchronize the tenant wallet",()=>{
  const migration=read("supabase/migrations/20260927090355_g1_flux_commercial_control_plane.sql");
  const fix=read("supabase/migrations/20260927091057_g1_flux_subscription_plan_code_fix.sql");
  assert.match(migration,/sync_flux_credit_wallet_from_subscription/);
  assert.match(migration,/organization_subscriptions_sync_flux_wallet/);
  assert.match(fix,/v_plan_code/);
  assert.match(fix,/grace_expired/);
  assert.match(fix,/sub\.status='suspended'/);
  assert.match(fix,/sub\.status='cancelled'/);
});

test("G lifecycle sweep catches clock-based expiry",()=>{
  const migration=read("supabase/migrations/20260927090724_g2_flux_subscription_lifecycle_sweep.sql");
  const trigger=read("src/trigger/system-orchestrator.ts");
  assert.match(migration,/sync_due_flux_subscription_wallets/);
  assert.match(migration,/trial_ends_at<=now\(\)/);
  assert.match(migration,/grace_period_end<=now\(\)/);
  assert.match(trigger,/id: "platform-hourly-maintenance-sweep"/);
  assert.match(trigger,/cron: "15 \* \* \* \*"/);
  assert.match(trigger,/scanAnalyticsAnomalies/);
  assert.match(trigger,/syncDueFluxSubscriptionWallets/);
});

test("G credit thresholds create tenant billing notifications",()=>{
  const migration=read("supabase/migrations/20260927090355_g1_flux_commercial_control_plane.sql");
  assert.match(migration,/sync_flux_credit_threshold_notification/);
  assert.match(migration,/percent_used>=90/);
  assert.match(migration,/percent_used>=70/);
  assert.match(migration,/threshold_level>=100/);
  assert.match(migration,/'\/portal\/billing'/);
  assert.match(migration,/'flux_credits'/);
});

test("G immutable Flux ledger still allows parent organization cascade cleanup",()=>{
  const migration=read("supabase/migrations/20260927091137_g1_flux_ledger_allow_parent_cascade.sql");
  assert.match(migration,/pg_trigger_depth\(\)>1/);
  assert.match(migration,/raise exception 'flux_credit_ledger is immutable'/);
});

test("G tenant WhatsApp runtime preflights and records whatsapp_ai credits",()=>{
  const runtime=read("src/trigger/tenant-channel-runtime.ts");
  assert.match(runtime,/action:"whatsapp_ai"/);
  assert.match(runtime,/preflightChargeableFluxAi/);
  assert.match(runtime,/recordChargeableFluxAiUsage/);
  assert.match(runtime,/source:"tenant_whatsapp_runtime"/);
});

test("G generic Phase 12 internal agent execution meters web_ai",()=>{
  const route=read("app/api/internal/runtime/agents/execute/route.ts");
  assert.match(route,/action:"web_ai"/);
  assert.match(route,/preflightChargeableFluxAi/);
  assert.match(route,/recordChargeableFluxAiUsage/);
  assert.match(route,/source:"phase12_internal_agent"/);
});

test("G provider runtime gates generic email and voice workloads without double debit",()=>{
  const route=read("app/api/internal/runtime/provider/execute/route.ts");
  assert.match(route,/isEmailPurpose/);
  assert.match(route,/isFollowUpPurpose/);
  assert.match(route,/isVoicePurpose/);
  assert.match(route,/email_follow_up/);
  assert.match(route,/ai_email/);
  assert.match(route,/leo_voice_minute/);
  assert.match(route,/if \(!isEmailPurpose && !isVoicePurpose\)/);
});

test("G outbound email duplicates return before Flux debit and uses channel-specific rates",()=>{
  const route=read("app/api/internal/runtime/actions/outbound-email/route.ts");
  const duplicateIndex=route.indexOf("if (duplicate.data) return");
  const preflightIndex=route.indexOf("await preflightChargeableFluxAi",duplicateIndex);
  assert.ok(duplicateIndex>=0&&preflightIndex>duplicateIndex);
  assert.match(route,/email_follow_up/);
  assert.match(route,/ai_email/);
  assert.match(route,/source:"outbound_email_runtime"/);
});

test("G voice runtime debits only terminal call duration",()=>{
  const route=read("app/api/internal/runtime/actions/voice-receptionist/route.ts");
  assert.match(route,/terminalCall/);
  assert.match(route,/Math\.ceil\(durationSeconds\/60\)/);
  assert.match(route,/Math\.ceil\(durationMinutes\)/);
  assert.match(route,/if\(terminalCall\)/);
  assert.match(route,/action:"leo_voice_minute"/);
  assert.match(route,/source:"voice_receptionist_runtime"/);
});

test("G automated WhatsApp follow-ups and appointment reminders consume reminder credits",()=>{
  const handoff=read("lib/handoff-followup.ts");
  const adapter=read("lib/system-event-adapters.ts");
  assert.match(handoff,/action:"whatsapp_follow_up_reminder"/);
  assert.match(handoff,/source:"handoff_follow_up"/);
  assert.match(adapter,/chargeReminder=input\.event\.eventType==="reminder\.scheduled"/);
  assert.match(adapter,/action:"whatsapp_follow_up_reminder"/);
  assert.match(adapter,/source:"appointment_reminder"/);
});

test("G trial feature gates use the same Flux commercial control response",()=>{
  const metering=read("lib/flux-ai-metering.ts");
  assert.match(metering,/FluxTrialFeatureGateError/);
  assert.match(metering,/FluxCreditLimitError/);
});

test("G tenant and Super Admin billing use the canonical commercial snapshot",()=>{
  const tenant=read("app/portal/billing/page.tsx");
  const admin=read("app/dashboard/billing/page.tsx");
  const helper=read("lib/flux-commercial.ts");
  assert.match(tenant,/getFluxCommercialSnapshot/);
  assert.match(admin,/getFluxCommercialSnapshot/);
  assert.match(helper,/rpc\/get_flux_commercial_snapshot/);
  assert.match(tenant,/does not silently create postpaid overages/);
  assert.match(admin,/prepaid/);
});

test("G commercial RPCs remain service-role only",()=>{
  const g1=read("supabase/migrations/20260927090355_g1_flux_commercial_control_plane.sql");
  const g2=read("supabase/migrations/20260927090724_g2_flux_subscription_lifecycle_sweep.sql");
  for(const signature of [
    "ensure_flux_credit_wallet\\(uuid,text,integer,integer,timestamptz,timestamptz\\)",
    "sync_flux_credit_wallet_from_subscription\\(uuid\\)",
    "get_flux_commercial_snapshot\\(uuid\\)",
  ]){
    assert.match(g1,new RegExp("revoke all on function public\\."+signature+" from public,anon,authenticated"));
    assert.match(g1,new RegExp("grant execute on function public\\."+signature+" to service_role"));
  }
  assert.match(g2,/revoke all on function public\.sync_due_flux_subscription_wallets\(\) from public,anon,authenticated/);
  assert.match(g2,/grant execute on function public\.sync_due_flux_subscription_wallets\(\) to service_role/);
});

test("G does not create an automatic postpaid overage model",()=>{
  const tenant=read("app/portal/billing/page.tsx");
  const admin=read("app/dashboard/billing/page.tsx");
  assert.match(tenant,/Add credits, renew, or upgrade/);
  assert.match(tenant,/does not silently create postpaid overages/);
  assert.match(admin,/rather than creating an unapproved postpaid overage/);
});
