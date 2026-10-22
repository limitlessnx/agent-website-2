import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

test("Phase 5 centralizes WhatsApp activation checks", () => {
  const gate = read("lib/whatsapp-activation-gate.ts");
  for (const check of [
    "plan_whatsapp",
    "single_whatsapp_agent",
    "business_knowledge",
    "provider_online",
    "handoff_configured",
    "agent_published",
    "agent_test_passed",
    "approval_recorded",
  ]) assert.match(gate, new RegExp(check));
  assert.match(gate, /getFluxWalletSummary/);
  assert.match(gate, /communication_channels/);
  assert.match(gate, /human_handoff_destination/);
  assert.match(gate, /whatsapp_twilio_bindings/);
});

test("Phase 5 activation cannot bypass the publish gate", () => {
  const route = read("app/api/integrations/whatsapp/activate/route.ts");
  assert.match(route, /getWhatsAppActivationGate/);
  assert.match(route, /if \(!activationGate\.ready\)/);
  assert.match(route, /status: 409/);
  assert.match(route, /checkMaiaLiveCutoverReadiness/);
});

test("Phase 5 Super Admin live transition uses the same WhatsApp gate", () => {
  const route = read("app/api/admin/clients/onboarding-status/route.ts");
  assert.match(route, /getWhatsAppActivationGate/);
  assert.match(route, /whatsappActivationError/);
  assert.match(route, /if \(status === "live"\)/);
  assert.match(route, /activationGate/);
  assert.match(route, /status: 409/);
});

test("Phase 5 does not expose Twilio secrets to the client panel", () => {
  const panel = read("app/portal/integrations/TwilioWhatsAppOnboardingPanel.tsx");
  assert.doesNotMatch(panel, /twilio_auth_token|TWILIO_AUTH_TOKEN|authToken/);
  assert.match(panel, /Managed WhatsApp Business connection/);
  assert.match(panel, /Fluxknight handles the provider setup/);
});
