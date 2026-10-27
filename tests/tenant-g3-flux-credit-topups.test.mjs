import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("G3 fixes Flux Credit customer value at one US cent per credit",()=>{
  const pricing=read("lib/flux-topups.ts");
  assert.match(pricing,/FLUX_CREDIT_USD_VALUE=0\.01/);
  assert.match(pricing,/FLUX_CREDITS_PER_USD=100/);
  assert.match(pricing,/FLUX_CREDIT_MIN_TOPUP_USD=10/);
  assert.match(pricing,/FLUX_CREDIT_MIN_TOPUP_CREDITS=1000/);
});

test("G3 server-side top-up pricing rejects purchases below ten dollars",()=>{
  const migration=read("supabase/migrations/20260927093533_g3_flux_credit_topup_pricing.sql");
  const route=read("app/api/portal/billing/top-up/route.ts");
  assert.match(migration,/session_row\.amount<10/);
  assert.match(migration,/credits<1000/);
  assert.match(route,/FLUX_CREDIT_MIN_TOPUP_USD/);
  assert.match(route,/fluxCreditsFromUsd/);
});

test("G3 checkout sessions have a first class top_up billing type",()=>{
  const migration=read("supabase/migrations/20260927093533_g3_flux_credit_topup_pricing.sql");
  assert.match(migration,/'top_up'::text/);
  assert.match(migration,/apply_flux_credit_topup_from_checkout/);
});

test("G3 top-up application is idempotent by checkout session",()=>{
  const migration=read("supabase/migrations/20260927093533_g3_flux_credit_topup_pricing.sql");
  assert.match(migration,/flux_credit_ledger_checkout_topup_unique/);
  assert.match(migration,/metadata->>'checkout_session_id'=session_row\.id::text/);
  assert.match(migration,/'duplicate',true/);
});

test("G3 top-up ledger preserves the one-cent customer value relationship",()=>{
  const migration=read("supabase/migrations/20260927093533_g3_flux_credit_topup_pricing.sql");
  assert.match(migration,/'customer_checkout'/);
  assert.match(migration,/'flux_credit_top_up'/);
  assert.match(migration,/'credit_rate_usd',0\.01/);
  assert.match(migration,/'credits_per_usd',100/);
  assert.match(migration,/customer_value_cents[\s\S]*credits/);
});

test("G3 trial wallets cannot buy top-ups",()=>{
  const migration=read("supabase/migrations/20260927093533_g3_flux_credit_topup_pricing.sql");
  assert.match(migration,/Top-ups are not available during the Basic free trial/);
});

test("G3 Flutterwave callback and webhook both apply the same idempotent top-up RPC",()=>{
  const callback=read("app/api/payments/callback/route.ts");
  const webhook=read("app/api/payments/flutterwave/webhook/route.ts");
  assert.match(callback,/billing_type === "top_up"/);
  assert.match(callback,/rpc\/apply_flux_credit_topup_from_checkout/);
  assert.match(webhook,/session\.billing_type === "top_up"/);
  assert.match(webhook,/rpc\/apply_flux_credit_topup_from_checkout/);
});

test("G3 tenant billing displays pricing, starts checkout, and shows tenant-scoped transaction history",()=>{
  const page=read("app/portal/billing/page.tsx");
  const form=read("app/portal/billing/FluxCreditTopUpForm.tsx");
  assert.match(page,/1 Flux Credit = \$0\.01/);
  assert.match(page,/Minimum top-up: \$10 = 1,000 credits/);
  assert.match(form,/\/api\/portal\/billing\/top-up/);
  assert.match(form,/Buy Flux Credits/);
  assert.match(page,/\.eq\("organization_id", session\.organizationId\)/);
  assert.match(page,/Recent credit transactions/);
});

test("G3 Super Admin billing shows all tenant wallet balances and selected tenant ledger",()=>{
  const page=read("app/dashboard/billing/page.tsx");
  assert.match(page,/1 Flux Credit = \$0\.01/);
  assert.match(page,/minimum customer top-up is \$10 = 1,000 credits/);
  assert.match(page,/from\("flux_credit_wallets"\)/);
  assert.match(page,/Tenant wallets/);
  assert.match(page,/Credit ledger/);
  assert.match(page,/created_by/);
});

test("G3 manual credit changes are admin-attributed and require a reason",()=>{
  const route=read("app/api/admin/billing/route.ts");
  const form=read("app/dashboard/billing/CreditAdjustmentForm.tsx");
  assert.match(route,/getAdminSession\(\)/);
  assert.match(route,/adminEmail: session\.email/);
  assert.match(route,/!reason/);
  assert.match(form,/placeholder="Reason"/);
  assert.match(form,/\/api\/admin\/billing/);
});

test("G3 interrupted webhook processing remains retryable while completed duplicates are acknowledged",()=>{
  const webhook=read("app/api/payments/flutterwave/webhook/route.ts");
  assert.match(webhook,/select=id,processed_at/);
  assert.match(webhook,/if \(existingEvent\?\.processed_at\) return/);
  assert.match(webhook,/if \(!existingEvent\)/);
  assert.match(webhook,/Leave the event unprocessed so a provider retry can recover/);
  assert.match(webhook,/retryable: true/);
  assert.match(webhook,/status: 503/);
  assert.match(webhook,/apply_flux_credit_topup_from_checkout/);
});
