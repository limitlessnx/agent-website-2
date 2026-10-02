import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const queue = fs.readFileSync("app/dashboard/onboarding/OnboardingQueueClient.tsx", "utf8");
const api = fs.readFileSync("app/api/admin/onboarding/route.ts", "utf8");

test("Super Admin onboarding queue is outcome-first", () => {
  assert.match(queue, /Clients awaiting setup/);
  assert.match(queue, /AI:/);
  assert.match(queue, /Knowledge:/);
  assert.match(queue, /WhatsApp:/);
  assert.match(queue, /Open setup/);
  assert.match(queue, /Create a managed onboarding link/);
  assert.doesNotMatch(queue, /Payment provider/);
  assert.doesNotMatch(queue, /Step \\{item\.current_step\\}\/6/);
  assert.doesNotMatch(queue, /Total onboarding records/);
  assert.doesNotMatch(queue, /Deployment checklist/);
  assert.doesNotMatch(queue, /Technical setup remains inside Fluxknight/);
});

test("Admin onboarding API surfaces submitted client-portal profiles", () => {
  assert.match(api, /client_onboarding_profiles\?select=id,organization_id,status,business_name,industry,ai_requirements,business_knowledge,whatsapp_preferences,created_at/);
  assert.match(api, /clientProfiles/);
  assert.match(api, /getAdminSession/);
});
