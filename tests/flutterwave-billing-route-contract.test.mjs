import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout requires a configured recurring plan and card payment", () => {
  const code = source("app/api/payments/create/route.ts");
  assert.match(code, /flutterwave_payment_plans/);
  assert.match(code, /payment_options:\s*"card"/);
  assert.match(code, /payload\.payment_plan\s*=\s*paymentPlanId/);
  assert.match(code, /billingType\s*=\s*"subscription"/);
});

test("callback verifies transaction and rejects cross-organization claims", () => {
  const code = source("app/api/payments/callback/route.ts");
  assert.match(code, /\/transactions\/\$\{encodeURIComponent\(transactionId\)\}\/verify/);
  assert.match(code, /session\.organization_id !== clientSession\.organizationId/);
  assert.match(code, /payment\.tx_ref === session\.tx_ref/);
  assert.match(code, /payment\.currency === session\.currency/);
});

test("onboarding conditionally claims checkout before activation", () => {
  const code = source("app/onboarding/page.tsx");
  assert.match(code, /organization_id=is\.null/);
  assert.match(code, /claimed\.length !== 1/);
  assert.match(code, /activatePaidTrialSubscription\(/);
});

test("webhook requires signature and server-side verification", () => {
  const code = source("app/api/webhooks/flutterwave/route.ts");
  assert.match(code, /isValidFlutterwaveWebhook\(rawBody, request\.headers\)/);
  assert.match(code, /\/transactions\/\$\{encodeURIComponent\(String\(data\.id\)\)\}\/verify/);
  assert.match(code, /provider_subscription_id/);
});

test("trial conversion preserves the existing organization subscription", () => {
  const code = source("lib/payments/activate-paid-trial.ts");
  assert.match(code, /organization_subscriptions\?id=eq/);
  assert.match(code, /status=eq\.trialing/);
  assert.match(code, /trial_ends_at:\s*null/);
  assert.match(code, /sync_flux_credit_wallet_from_subscription/);
});

test("duplicate webhook delivery cannot enter processing while first claim is active", () => {
  const code = source("app/api/webhooks/flutterwave/route.ts");
  assert.match(code, /if \(!eventRow\.processing_error\)/);
  assert.match(code, /status:\s*503/);
  assert.match(code, /processing_error=eq\.\$\{encodeURIComponent\(eventRow\.processing_error\)\}/);
  assert.match(code, /reclaimed\.length !== 1/);
});

test("verified checkout identity and amount are enforced across activation paths", () => {
  const callback = source("app/api/payments/callback/route.ts");
  const webhook = source("app/api/webhooks/flutterwave/route.ts");
  const activation = source("lib/payments/activate-paid-trial.ts");
  assert.match(callback, /payment\.customer\?\.email\?\.trim\(\)\.toLowerCase\(\) === session\.customer_email/);
  assert.match(webhook, /payment\.customer\.email\.trim\(\)\.toLowerCase\(\) !== session\.customer_email/);
  assert.match(activation, /payment\.currency !== expectedCurrency/);
  assert.match(activation, /Number\(payment\.amount\) < Number\(plan\.recurringFee\)/);
});
