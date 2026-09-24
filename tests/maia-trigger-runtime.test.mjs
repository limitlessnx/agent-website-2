import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const triggerTask = await readFile(new URL("../src/trigger/maia-runtime.ts", import.meta.url), "utf8");
const runtimeStore = await readFile(new URL("../lib/ai/maia-trigger-runtime.ts", import.meta.url), "utf8");
const maiaRuntime = await readFile(new URL("../lib/ai/maia-runtime.ts", import.meta.url), "utf8");
const limitlessRuntime = await readFile(new URL("../lib/ai/limitless-realty-maia.ts", import.meta.url), "utf8");
const whatsappWebhook = await readFile(new URL("../app/api/whatsapp/webhook/route.ts", import.meta.url), "utf8");
const whatsappDelivery = await readFile(new URL("../lib/whatsapp-delivery.ts", import.meta.url), "utf8");
const whatsappIntegration = await readFile(new URL("../lib/whatsapp-integration.ts", import.meta.url), "utf8");
const whatsappReadinessRoute = await readFile(new URL("../app/api/integrations/whatsapp/readiness/route.ts", import.meta.url), "utf8");
const whatsappConfigureRoute = await readFile(new URL("../app/api/integrations/whatsapp/configure/route.ts", import.meta.url), "utf8");
const maiaCutoverReadiness = await readFile(new URL("../lib/maia-cutover-readiness.ts", import.meta.url), "utf8");
const maiaCutoverRoute = await readFile(new URL("../app/api/maia/cutover/readiness/route.ts", import.meta.url), "utf8");
const whatsappActivationRoute = await readFile(new URL("../app/api/integrations/whatsapp/activate/route.ts", import.meta.url), "utf8");
const limitlessConnectionsPage = await readFile(new URL("../app/dashboard/limitless/integrations/page.tsx", import.meta.url), "utf8");
const whatsappIntegrationPanel = await readFile(new URL("../components/integrations/WhatsAppIntegrationPanel.tsx", import.meta.url), "utf8");

test("Maia Trigger runtime validates tenant context before execution", () => {
  assert.match(triggerTask, /validateMaiaTenantContext\(payload\)/);
  assert.match(runtimeStore, /\.eq\("organization_id", payload\.organizationId\)/);
  assert.match(runtimeStore, /Maia agent is not assigned to this organization/);
});

test("Maia Trigger runtime is idempotent and conversation-serialized", () => {
  assert.match(runtimeStore, /maia_inbound_events/);
  assert.match(runtimeStore, /external_event_id/);
  assert.match(triggerTask, /duplicate/);
  assert.match(runtimeStore, /claim_maia_conversation_lock/);
  assert.match(runtimeStore, /release_maia_conversation_lock/);
});

test("Maia Trigger runtime reuses active conversation memory", () => {
  assert.match(maiaRuntime, /external_conversation_id/);
  assert.match(maiaRuntime, /\.eq\("status", "active"\)/);
  assert.match(maiaRuntime, /if \(existing\) return existing/);
});

test("Legacy Limitless Maia lead access remains tenant-scoped", () => {
  assert.match(limitlessRuntime, /\.eq\("organization_id", args\.organizationId\)\.eq\("phone", phone\)/);
  assert.match(limitlessRuntime, /organization_id: args\.organizationId/);
});

test("Phase 3 does not send WhatsApp directly from the Trigger task", () => {
  assert.doesNotMatch(triggerTask, /graph\.facebook\.com|whatsapp.*send|N8N|n8n/i);
});


test("Phase 4 routes inbound Meta WhatsApp events into Trigger.dev", () => {
  assert.match(whatsappWebhook, /maia-process-inbound-message/);
  assert.match(whatsappWebhook, /externalEventId: messageId/);
  assert.match(whatsappWebhook, /organization_agent_selections/);
  assert.match(whatsappWebhook, /phone_number_id/);
});

test("Phase 4 sends WhatsApp replies from Trigger instead of n8n", () => {
  assert.match(triggerTask, /sendWhatsAppMessage/);
  assert.match(limitlessRuntime, /trigger-dev-meta-cloud-api/);
  assert.doesNotMatch(limitlessRuntime, /N8N|n8n/);
});

test("WhatsApp delivery resolves credentials per tenant and scopes property media", () => {
  assert.match(whatsappDelivery, /get_organization_integration_credentials/);
  assert.match(whatsappDelivery, /organizationId/);
  assert.match(whatsappDelivery, /properties\?organization_id=eq/);
  assert.match(whatsappDelivery, /tenant_vault/);
});


test("Phase 5 exposes a tenant-aware WhatsApp live-cutover gate", () => {
  assert.match(whatsappReadinessRoute, /checkWhatsAppReadiness/);
  assert.match(whatsappReadinessRoute, /getClientSession/);
  assert.match(whatsappIntegration, /readyForCutover/);
  assert.match(whatsappIntegration, /webhook_signature/);
  assert.match(whatsappIntegration, /verify_token/);
  assert.match(whatsappIntegration, /trigger_runtime/);
});

test("Phase 5 stores WhatsApp credentials per organization without returning secrets", () => {
  assert.match(whatsappConfigureRoute, /saveWhatsAppCredentials/);
  assert.match(whatsappConfigureRoute, /Owner access is required/);
  assert.match(whatsappIntegration, /store_organization_integration_credentials/);
  assert.match(whatsappIntegration, /p_organization_id: input\.organizationId/);
  assert.doesNotMatch(whatsappConfigureRoute, /accessToken:\s*accessToken/);
});

test("Phase 5 verifies the configured Meta phone number before cutover", () => {
  assert.match(whatsappIntegration, /display_phone_number,verified_name,quality_rating,status/);
  assert.match(whatsappIntegration, /Meta accepted the configured phone number credentials/);
  assert.match(whatsappIntegration, /legacy_env/);
  assert.match(whatsappIntegration, /tenant_vault/);
});


test("Phase 6 exposes a hard live-traffic cutover gate", () => {
  assert.match(maiaCutoverRoute, /checkMaiaLiveCutoverReadiness/);
  assert.match(maiaCutoverRoute, /cutoverMode/);
  assert.match(maiaCutoverReadiness, /readyForLiveTraffic/);
  assert.match(maiaCutoverReadiness, /hardGateKeys/);
});

test("Phase 6 verifies Maia operating dependencies before live traffic", () => {
  assert.match(maiaCutoverReadiness, /knowledge_collections/);
  assert.match(maiaCutoverReadiness, /knowledge_sources/);
  assert.match(maiaCutoverReadiness, /organization_follow_up_policies/);
  assert.match(maiaCutoverReadiness, /payment_plans/);
  assert.match(maiaCutoverReadiness, /reminder_templates/);
  assert.match(maiaCutoverReadiness, /whatsapp_meta_phone/);
});


test("Phase 6 exposes WhatsApp credential setup inside the Limitless Realty dashboard", () => {
  assert.match(limitlessConnectionsPage, /Limitless Realty · Maia/);
  assert.match(limitlessConnectionsPage, /WhatsAppIntegrationPanel/);
  assert.match(whatsappIntegrationPanel, /WhatsApp Phone Number ID/);
  assert.match(whatsappIntegrationPanel, /Permanent Access Token/);
  assert.match(whatsappIntegrationPanel, /WhatsApp Business Account ID/);
  assert.match(whatsappIntegrationPanel, /Save & verify/);
});

test("Phase 6 activation is gated by readiness and tenant-scoped", () => {
  assert.match(whatsappActivationRoute, /checkMaiaLiveCutoverReadiness/);
  assert.match(whatsappActivationRoute, /readyForLiveTraffic/);
  assert.match(whatsappActivationRoute, /maia_active: true/);
  assert.match(whatsappActivationRoute, /Owner access is required/);
  assert.match(whatsappWebhook, /config\.maia_active === true/);
});

test("Tenant WhatsApp UI never renders stored access tokens", () => {
  assert.doesNotMatch(limitlessConnectionsPage, /access_token/);
  assert.doesNotMatch(whatsappIntegrationPanel, /defaultValue=.*accessToken/);
  assert.match(whatsappIntegrationPanel, /type="password"/);
});
