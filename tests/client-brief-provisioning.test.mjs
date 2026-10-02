import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const provision = fs.readFileSync("app/api/admin/clients/provision-from-brief/route.ts", "utf8");
const config = fs.readFileSync("app/api/admin/agent-configuration/route.ts", "utf8");
const status = fs.readFileSync("app/api/admin/clients/onboarding-status/route.ts", "utf8");
const page = fs.readFileSync("app/dashboard/clients/[organizationId]/setup/page.tsx", "utf8");

test("brief provisioning is tenant-scoped and uses the new outcome brief", () => {
  assert.match(provision, /client_onboarding_profiles/);
  assert.match(provision, /\.eq\("organization_id", organizationId\)/);
  assert.match(provision, /business_description/);
  assert.match(provision, /ai_requirements/);
  assert.match(provision, /business_knowledge/);
  assert.match(provision, /saveOrganizationAgentSelections/);
  assert.match(provision, /provision_selected_agent_allocations/);
  assert.match(provision, /provisioning_source: "client_outcome_brief"/);
  assert.match(provision, /status: "configuration"/);
  assert.doesNotMatch(provision, /Account SID|Auth Token|WABA|webhook URL/);
});

test("agent configuration builds from the new client profile", () => {
  assert.match(config, /client_onboarding_profiles/);
  assert.match(config, /business_description/);
  assert.match(config, /ai_requirements/);
  assert.match(config, /business_knowledge/);
  assert.match(config, /suggested_prompt/);
});

test("launch status is tenant-scoped and gated by readiness", () => {
  assert.match(status, /client_onboarding_profiles/);
  assert.match(status, /\.eq\("id", id\)/);
  assert.match(status, /\.eq\("organization_id", profile\.organization_id\)/);
  assert.match(status, /status === "live"/);
  assert.match(status, /readiness_score/);
  assert.match(status, /organization_ai_model_assignments/);
  assert.match(status, /Launch blocked/);
});

test("setup exposes controlled brief provisioning without auto-launch", () => {
  assert.match(page, /ProvisionFromBriefControl/);
  assert.match(page, /Build recommended setup/);
  assert.match(page, /does not launch the tenant/);
});
