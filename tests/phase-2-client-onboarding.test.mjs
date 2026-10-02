import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(path,"utf8");

test("Phase 2 onboarding is outcome-first and removes technical architecture questions",()=>{
  const form=read("app/onboarding/OnboardingForm.tsx");
  assert.match(form,/What does your business do\?/);
  assert.match(form,/What should your AI handle\?/);
  assert.match(form,/FAQs/);
  assert.match(form,/Pricing/);
  assert.match(form,/Opening hours/);
  assert.match(form,/WhatsApp/);
  assert.doesNotMatch(form,/Existing tools/);
  assert.doesNotMatch(form,/Supabase/);
  assert.doesNotMatch(form,/n8n/);
  assert.doesNotMatch(form,/Vapi/);
  assert.doesNotMatch(form,/Account SID|Auth Token|WABA|webhook/i);
});

test("Phase 2 intake has structured knowledge and managed WhatsApp fields",()=>{
  const model=read("lib/client-workspace-onboarding.ts");
  const route=read("app/api/client-onboarding/route.ts");
  const migration=read("supabase/migrations/202610020001_client_onboarding_outcome_intake.sql");
  for(const value of ["business_description","ai_requirements","business_knowledge","whatsapp_preferences"]){
    assert.match(model,new RegExp(value));
    assert.match(route,new RegExp(value));
    assert.match(migration,new RegExp("add column if not exists "+value));
  }
});

test("Phase 2 completion submits intake for Super Admin instead of client agent selection",()=>{
  const route=read("app/api/client-onboarding/route.ts");
  const form=read("app/onboarding/OnboardingForm.tsx");
  assert.match(route,/submitClientOnboarding/);
  assert.doesNotMatch(route,/completeClientOnboarding\(/);
  assert.match(form,/Submit setup/);
  assert.match(form,/router\.push\("\/portal"\)/);
  assert.doesNotMatch(form,/\/portal\/agents\/select/);
});

test("Phase 2 keeps the WhatsApp trial promise visible",()=>{
  const form=read("app/onboarding/OnboardingForm.tsx");
  assert.match(form,/WhatsApp AI agent/);
  assert.match(form,/included.*trial|trial.*included/i);
  assert.match(form,/technical setup/i);
});
