import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("F7 stores one tenant WABA on one Twilio subaccount",()=>{
  const migration=read("supabase/migrations/20260927143920_f7_twilio_whatsapp_tech_provider_onboarding.sql");
  assert.match(migration,/organization_id uuid not null unique/);
  assert.match(migration,/twilio_subaccount_sid text unique/);
  assert.match(migration,/twilio_sender_sid text unique/);
  assert.match(migration,/unique\(organization_id,meta_waba_id\)/);
  assert.match(migration,/foreign key\(organization_id,membership_id\)/);
});

test("F7 Tech Provider bootstrap requires tenant integration management permission",()=>{
  const route=read("app/api/integrations/whatsapp/twilio/bootstrap/route.ts");
  assert.match(route,/integrations\.manage/);
  assert.match(route,/session\.organizationId/);
  assert.match(route,/session\.membershipId/);
  assert.doesNotMatch(route,/TWILIO_AUTH_TOKEN/);
});

test("F7 Embedded Signup uses Meta config and Twilio Partner Solution without exposing Twilio credentials",()=>{
  const panel=read("app/portal/integrations/TwilioWhatsAppOnboardingPanel.tsx");
  assert.match(panel,/config_id:bootstrap\.configId/);
  assert.match(panel,/solutionID:bootstrap\.solutionId/);
  assert.match(panel,/sessionInfoVersion:3/);
  assert.match(panel,/only_waba_sharing/);
  assert.match(panel,/event\.origin\.endsWith\("facebook\.com"\)/);
  assert.match(panel,/FINISH_ONLY_WABA/);
  assert.doesNotMatch(panel,/TWILIO_AUTH_TOKEN|twilio_auth_token/);
});

test("F7 uses Twilio v2 Senders API and dedicated tenant subaccounts",()=>{
  const provider=read("lib/twilio-whatsapp.ts");
  const onboarding=read("lib/twilio-whatsapp-onboarding.ts");
  assert.match(provider,/\/2010-04-01\/Accounts\.json/);
  assert.match(provider,/messaging\.twilio\.com\/v2\/Channels\/Senders/);
  assert.match(provider,/account_type:"ISVSubAccount"/);
  assert.match(onboarding,/createTwilioSubaccount/);
  assert.match(onboarding,/registerTwilioWhatsAppSender/);
});

test("F7 persists the Twilio subaccount secret before registering a sender",()=>{
  const onboarding=read("lib/twilio-whatsapp-onboarding.ts");
  const createIndex=onboarding.indexOf("const sub=await createTwilioSubaccount");
  const persistIndex=onboarding.indexOf("partialIntegrationId=await storeTwilioTenantCredentials",createIndex);
  const senderIndex=onboarding.indexOf("registerTwilioWhatsAppSender",persistIndex);
  assert.ok(createIndex>=0);
  assert.ok(persistIndex>createIndex);
  assert.ok(senderIndex>persistIndex);
});

test("F7 tenant Twilio credentials are stored in Vault and never browser-visible",()=>{
  const onboarding=read("lib/twilio-whatsapp-onboarding.ts");
  assert.match(onboarding,/store_organization_integration_credentials/);
  assert.match(onboarding,/twilio_auth_token/);
  assert.match(onboarding,/provider_family:"twilio"/);
  const panel=read("app/portal/integrations/TwilioWhatsAppOnboardingPanel.tsx");
  assert.doesNotMatch(panel,/authToken|twilio_auth_token/);
});

test("F7 signed Twilio inbound webhooks resolve tenants by subaccount SID",()=>{
  const route=read("app/api/whatsapp/twilio/webhook/route.ts");
  const provider=read("lib/twilio-whatsapp.ts");
  assert.match(route,/twilio_subaccount_sid/);
  assert.match(route,/x-twilio-signature/);
  assert.match(route,/validateTwilioFormSignature/);
  assert.match(provider,/createHmac\("sha1"/);
  assert.match(route,/tenant-whatsapp-process-inbound-message/);
  assert.match(route,/maia-process-inbound-message/);
});

test("F7 outbound WhatsApp delivery is provider neutral",()=>{
  const delivery=read("lib/whatsapp-delivery.ts");
  assert.match(delivery,/providerFamily:"twilio"/);
  assert.match(delivery,/sendTwilioWhatsAppMessage/);
  assert.match(delivery,/providerFamily:"meta"/);
  assert.match(delivery,/No Twilio Content SID is configured/);
  assert.match(delivery,/StatusCallback/);
});

test("F7 delivery status callbacks update the existing WhatsApp delivery ledger",()=>{
  const status=read("app/api/whatsapp/twilio/status/route.ts");
  assert.match(status,/whatsapp_delivery_attempts/);
  assert.match(status,/MessageSid/);
  assert.match(status,/MessageStatus/);
  assert.match(status,/ErrorCode/);
  assert.match(status,/validateTwilioFormSignature/);
});

test("F7 readiness treats Twilio ONLINE as the production sender gate",()=>{
  const readiness=read("lib/whatsapp-integration.ts");
  assert.match(readiness,/providerFamily==="twilio"/);
  assert.match(readiness,/twilio_sender_status/);
  assert.match(readiness,/==="ONLINE"/);
  assert.match(readiness,/Twilio signed webhooks do not require a Meta webhook verify token/);
});

test("F7 Twilio onboarding mutation RPC is service-role only",()=>{
  const migration=read("supabase/migrations/20260927143920_f7_twilio_whatsapp_tech_provider_onboarding.sql");
  assert.match(migration,/revoke all on function public\.upsert_whatsapp_twilio_binding[\s\S]*from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.upsert_whatsapp_twilio_binding[\s\S]*to service_role/);
});


test("F7 disconnect removes the Twilio sender and clears the integration secret",()=>{
  const route=read("app/api/integrations/whatsapp/twilio/disconnect/route.ts");
  const provider=read("lib/twilio-whatsapp.ts");
  assert.match(route,/deleteTwilioWhatsAppSender/);
  assert.match(route,/disconnect_organization_integration/);
  assert.match(route,/status:"disconnected"/);
  assert.match(provider,/method:"DELETE"/);
});

test("F7 tenant UI polls asynchronous sender provisioning",()=>{
  const panel=read("app/portal/integrations/TwilioWhatsAppOnboardingPanel.tsx");
  assert.match(panel,/setInterval/);
  assert.match(panel,/15000/);
  assert.match(panel,/awaiting_sender_online/);
  assert.match(panel,/Check sender status/);
  assert.match(panel,/Disconnect WhatsApp/);
});

test("F7 failed sender registration remains retryable without creating a second subaccount",()=>{
  const onboarding=read("lib/twilio-whatsapp-onboarding.ts");
  const createIndex=onboarding.indexOf("const sub=await createTwilioSubaccount");
  const persistIndex=onboarding.indexOf("partialIntegrationId=await storeTwilioTenantCredentials",createIndex);
  const failureIndex=onboarding.indexOf('p_status:"failed"',persistIndex);
  assert.ok(createIndex>=0);
  assert.ok(persistIndex>createIndex);
  assert.ok(failureIndex>persistIndex);
  assert.match(onboarding,/status:"degraded"/);
});
