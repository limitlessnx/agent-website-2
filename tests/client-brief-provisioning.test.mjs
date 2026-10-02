import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const provision = fs.readFileSync("app/api/admin/clients/provision-from-brief/route.ts", "utf8");
const config = fs.readFileSync("app/api/admin/agent-configuration/route.ts", "utf8");
const status = fs.readFileSync("app/api/admin/clients/onboarding-status/route.ts", "utf8");
const page = fs.readFileSync("app/dashboard/clients/[organizationId]/setup/page.tsx", "utf8");
const control = fs.readFileSync("app/dashboard/clients/ProvisionFromBriefControl.tsx", "utf8");
const catalog = fs.readFileSync("lib/agent-catalog.ts", "utf8");
const readinessMigration = fs.readFileSync("supabase/migrations/202610020002_expose_service_readiness_refresh.sql", "utf8");
const adminTest = fs.readFileSync("app/api/admin/clients/run-test/route.ts", "utf8");
const requestApproval = fs.readFileSync("app/api/admin/clients/request-approval/route.ts", "utf8");
const decideApproval = fs.readFileSync("app/api/admin/clients/decide-approval/route.ts", "utf8");
const statusControl = fs.readFileSync("app/dashboard/clients/ClientStatusControl.tsx", "utf8");
const testingControl = fs.readFileSync("app/dashboard/clients/ClientTestingApprovalControl.tsx", "utf8");

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
  assert.match(provision, /preserveExisting: true/);
  assert.match(provision, /existingKeys/);
  assert.match(provision, /knowledge_sources/);
  assert.match(provision, /source_type: "manual_note"/);
  assert.match(provision, /status: "ready"/);
  assert.match(provision, /refresh_agent_runtime_readiness/);
  assert.match(provision, /brief_prompt_generated: true/);
  assert.match(provision, /configuration_source === "super_admin"/);
  assert.doesNotMatch(provision, /Account SID|Auth Token|WABA|webhook URL/);
});

test("agent configuration builds from the new client profile", () => {
  assert.match(config, /client_onboarding_profiles/);
  assert.match(config, /business_description/);
  assert.match(config, /ai_requirements/);
  assert.match(config, /business_knowledge/);
  assert.match(config, /suggested_prompt/);
  assert.match(config, /brief_prompt_generated: false/);
  assert.match(config, /configuration_source: "super_admin"/);
});

test("launch status is tenant-scoped and gated by readiness", () => {
  assert.match(status, /client_onboarding_profiles/);
  assert.match(status, /\.eq\("id", id\)/);
  assert.match(status, /\.eq\("organization_id", profile\.organization_id\)/);
  assert.match(status, /status === "live"/);
  assert.match(status, /readiness_score/);
  assert.match(status, /organization_ai_model_assignments/);
  assert.match(status, /Launch blocked/);
  assert.match(status, /whatsapp_twilio_bindings/);
  assert.match(status, /whatsapp\?\.status === "connected"/);
});

test("setup exposes controlled brief provisioning without auto-launch", () => {
  assert.match(page, /ProvisionFromBriefControl/);
  assert.match(control, /Build recommended setup/);
  assert.match(control, /does not launch the tenant/);
});

test("agent allocation persistence can preserve existing manual selections", () => {
  assert.match(catalog, /preserveExisting\?: boolean/);
  assert.match(catalog, /input\.preserveExisting/);
  assert.match(readinessMigration, /private\.refresh_agent_runtime_readiness/);
  assert.match(readinessMigration, /grant execute/);
});


test("admin test gate records tenant-scoped passed runs and refreshes readiness", () => {
  assert.match(adminTest, /getAdminSession/);
  assert.match(adminTest, /agent_test_runs/);
  assert.match(adminTest, /organization_id.*organizationId/);
  assert.match(adminTest, /refresh_agent_runtime_readiness/);
  assert.match(adminTest, /status: "testing"/);
});

test("approval workflow uses existing approval records and remains tenant scoped", () => {
  assert.match(requestApproval, /agent_approval_requests/);
  assert.match(requestApproval, /status: "submitted"/);
  assert.match(requestApproval, /organization_id.*organizationId/);
  assert.match(decideApproval, /status: decision/);
  assert.match(decideApproval, /reviewed_by/);
  assert.match(decideApproval, /status: decision === "approved" \? "published" : "testing"/);
  assert.match(decideApproval, /refresh_agent_runtime_readiness/);
});

test("client launch status enforces test and approval records", () => {
  assert.match(status, /agent_test_runs/);
  assert.match(status, /agent_approval_requests/);
  assert.match(status, /status === "testing"/);
  assert.match(status, /status === "awaiting_approval"/);
  assert.match(status, /approval\.status === "approved"/);
});

test("setup UI exposes explicit test and approval actions", () => {
  assert.match(page, /ClientTestingApprovalControl/);
  assert.match(testingControl, /run-test/);
  assert.match(testingControl, /request-approval/);
  assert.match(testingControl, /decide-approval/);
  assert.match(testingControl, /does not invoke a live model/);
  assert.match(statusControl, /Update onboarding status/);
});
