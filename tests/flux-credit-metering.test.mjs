import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const plans = readFileSync(resolve(root, "lib/fluxknight-plans.ts"), "utf8");
const metering = readFileSync(resolve(root, "lib/flux-ai-metering.ts"), "utf8");
const leoRoute = readFileSync(resolve(root, "app/api/leo/route.ts"), "utf8");
const voiceRoute = readFileSync(resolve(root, "app/api/leo/realtime/call/route.ts"), "utf8");
const maiaRuntime = readFileSync(resolve(root, "lib/ai/maia-runtime.ts"), "utf8");
const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

test("modeled provider cost uses the locked two-times Flux Credit multiplier", () => {
  assert.match(plans, /FLUX_CREDIT_MULTIPLIER = 2/);
  assert.match(plans, /FLUX_CREDIT_PROVIDER_VALUE_CENTS = 0\.5/);
  assert.match(plans, /calculateModeledProviderCostCents/);
  assert.match(metering, /calculateModeledProviderCostCents\(input\.action, quantity\)/);
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
