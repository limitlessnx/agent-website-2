import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("Phase 3 tenant WhatsApp UI exposes business setup, not Twilio architecture",()=>{
  const panel=read("app/portal/integrations/TwilioWhatsAppOnboardingPanel.tsx");
  assert.match(panel,/Managed WhatsApp Business connection/);
  assert.match(panel,/Fluxknight handles the provider setup/);
  assert.match(panel,/numberSource:"customer"/);
  assert.doesNotMatch(panel,/Phone number source/);
  assert.doesNotMatch(panel,/Twilio SMS-capable number/);
  assert.doesNotMatch(panel,/Twilio voice-only number/);
  assert.doesNotMatch(panel,/authToken|twilio_auth_token/);
});

test("Phase 3 tenant WhatsApp flow remains permission and tenant scoped",()=>{
  const bootstrap=read("app/api/integrations/whatsapp/twilio/bootstrap/route.ts");
  const complete=read("app/api/integrations/whatsapp/twilio/complete/route.ts");
  const status=read("app/api/integrations/whatsapp/twilio/status/route.ts");
  for(const route of [bootstrap,complete,status]){
    assert.match(route,/getClientSession/);
    assert.match(route,/session\.organizationId/);
  }
  assert.match(bootstrap,/integrations\.manage/);
  assert.match(complete,/integrations\.manage/);
});

test("Phase 3 provider credentials remain server-side",()=>{
  const onboarding=read("lib/twilio-whatsapp-onboarding.ts");
  const panel=read("app/portal/integrations/TwilioWhatsAppOnboardingPanel.tsx");
  assert.match(onboarding,/store_organization_integration_credentials/);
  assert.match(onboarding,/twilio_auth_token/);
  assert.doesNotMatch(panel,/twilio_auth_token|TWILIO_AUTH_TOKEN|authToken/);
});

test("Phase 3 only reports a connected sender after ONLINE",()=>{
  const onboarding=read("lib/twilio-whatsapp-onboarding.ts");
  assert.match(onboarding,/senderStatus==="ONLINE"\?"connected":"awaiting_sender_online"/);
  assert.match(onboarding,/status:senderStatus==="ONLINE"\?"connected":"configured"/);
});
