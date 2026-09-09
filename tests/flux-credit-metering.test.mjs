import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const plans = readFileSync(resolve(root, "lib/fluxknight-plans.ts"), "utf8");
const credits = readFileSync(resolve(root, "lib/flux-credits.ts"), "utf8");
const metering = readFileSync(resolve(root, "lib/flux-ai-metering.ts"), "utf8");
const leoRoute = readFileSync(resolve(root, "app/api/leo/route.ts"), "utf8");
const voiceRoute = readFileSync(resolve(root, "app/api/leo/realtime/call/route.ts"), "utf8");
const maiaRuntime = readFileSync(resolve(root, "lib/ai/maia-runtime.ts"), "utf8");
const clientOnboarding = readFileSync(resolve(root, "lib/client-onboarding.ts"), "utf8");
const trialMigration = readFileSync(resolve(root, "supabase/migrations/20260909_free_trial_system_v1.sql"), "utf8");
const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

test("modeled provider cost uses the locked two-times Flux Credit multiplier", () => {
  assert.match(plans, /FLUX_CREDIT_MULTIPLIER = 2/);
  assert.match(plans, /FLUX_CREDIT_PROVIDER_VALUE_CENTS = 0\.5/);
  assert.match(plans, /calculateModeledProviderCostCents/);
  assert.match(metering, /calculateModeledProviderCostCents\(input\.action, quantity\)/);
});

test("Basic free trial is locked to 14 days and 250 Flux Credits", () => {
  assert.match(credits, /BASIC_FREE_TRIAL_DAYS = 14/);
  assert.match(credits, /BASIC_FREE_TRIAL_CREDITS = 250/);
  assert.match(trialMigration, /interval '14 days'/);
  assert.match(trialMigration, /'trial_credit_limit', 250/);
  assert.match(trialMigration, /'payment_method_required', false/);
});

test("Basic free trial only permits Web AI and WhatsApp AI chargeable actions", () => {
  assert.match(credits, /BASIC_FREE_TRIAL_ACTIONS = new Set<FluxCreditAction>\(\["web_ai", "whatsapp_ai"\]\)/);
  assert.match(credits, /FluxTrialFeatureGateError/);
  assert.match(trialMigration, /jsonb_build_array\('web_ai', 'whatsapp_ai'\)/);
});

test("new client provisioning atomically includes one idempotent Basic free trial", () => {
  assert.match(clientOnboarding, /rpc\/provision_trial_client_organization/);
  assert.match(trialMigration, /organization_subscriptions_one_basic_free_trial/);
  assert.match(trialMigration, /start_fluxknight_basic_free_trial/);
  assert.match(trialMigration, /provision_trial_client_organization/);
  assert.match(trialMigration, /existing_subscription/);
  assert.match(trialMigration, /trial_already_granted/);
});

test("tenant Leo Chat preflights entitlements and records provider usage", () => {
  assert.match(leoRoute, /identity\.scope === "tenant" && identity\.organizationId/);
  assert.match(leoRoute, /preflightChargeableFluxAi\(\{ organizationId: identity\.organizationId, feature: "leo_chat", action: "leo_chat" \}\)/);
  assert.match(leoRoute, /recordChargeableFluxAiUsage\(\{[\s\S]*source: "leo_chat"[\s\S]*providerUsage: result\.usage/);
  assert.match(leoRoute, /if \(isFluxAiControlError\(error\)\) return fluxAiControlResponse\(error\)/);
});

test("tenant Leo Voice requires Business voice access and charges one minute at call start", () => {
  assert.match(voiceRoute, /feature: "leo_voice", action: "leo_voice_minute"/);
  assert.match(voiceRoute, /source: "leo_voice"/);
  assert.match(voiceRoute, /quantity: 1/);
  assert.match(voiceRoute, /status: 402/);
});

test("Maia runtime meters every successful tenant model step as Web AI", () => {
  assert.match(maiaRuntime, /feature: "core_ai_support", action: "web_ai"/);
  assert.match(maiaRuntime, /recordChargeableFluxAiUsage\(\{ organizationId: input\.organizationId, action: "web_ai", source: "maia_runtime"/);
  assert.match(maiaRuntime, /providerUsage: usage/);
  assert.match(maiaRuntime, /step: steps/);
});

test("Flux Credit metering tests run with the support suite", () => {
  assert.match(packageJson, /tests\/flux-credit-metering\.test\.mjs/);
});
