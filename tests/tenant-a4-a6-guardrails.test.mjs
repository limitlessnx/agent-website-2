import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("A4 closes privileged RPCs and adds composite tenant runtime guards", () => {
  const sql = read("supabase/migrations/20260926192153_a4_tenant_data_isolation_hardening.sql");
  assert.match(sql, /revoke execute on function public\.claim_agent_runtime_goal/);
  assert.match(sql, /agent_runtime_sessions_org_agent_fkey/);
  assert.match(sql, /agent_runtime_messages_org_session_fkey/);
  assert.match(sql, /customers\.manage/);
  assert.match(sql, /conversations\.reply/);
});

test("A5 makes service packages authoritative for seats and systems", () => {
  const sql = read("supabase/migrations/20260926192406_a5_service_packages_entitlements.sql");
  assert.match(sql, /service_package_entitlements/);
  assert.match(sql, /organization_service_packages/);
  assert.match(sql, /organization_effective_seat_limit/);
  assert.match(sql, /organization_can_use_system/);
  assert.match(sql, /'team\.seats',true,3/);
  assert.match(sql, /'systems\.max_active'/);
});

test("A6 defines request, provision, test, and activation gates", () => {
  const sql = read("supabase/migrations/20260926192547_a6_modular_system_provisioning_lifecycle.sql");
  assert.match(sql, /request_organization_system_installation/);
  assert.match(sql, /assert_organization_system_provisionable/);
  assert.match(sql, /record_organization_system_test/);
  assert.match(sql, /activate_organization_system_record/);
  assert.match(sql, /System must pass testing before activation/);
});

test("provisioning stops at testing and does not activate n8n", () => {
  const code = read("lib/tenant-system-provisioning.ts");
  assert.match(code, /assert_organization_system_provisionable/);
  assert.match(code, /finalStatus = failed\.length \? "needs_attention" : "testing"/);
  assert.match(code, /status: "paused"/);
  assert.match(code, /ensureIncludedAgentSelections/);
  assert.match(code, /provision_selected_agent_allocations/);
  assert.match(code, /system_bindings/);
  assert.doesNotMatch(code, /activateN8nWorkflow/);
});

test("activation owns n8n activation after readiness passes", () => {
  const code = read("lib/tenant-system-management.ts");
  assert.match(code, /testTenantSystem/);
  assert.match(code, /activateTenantSystem/);
  assert.match(code, /activateN8nWorkflow/);
  assert.match(code, /activate_organization_system_record/);
  assert.match(code, /test_passed/);
});

test("super admin allocations no longer bypass package system gates", () => {
  const code = read("lib/agent-catalog.ts");
  assert.match(code, /organization_service_packages/);
  assert.match(code, /organization_can_use_system/);
  assert.doesNotMatch(code, /admin_plan_override/);
  assert.doesNotMatch(code, /allocationSource !== "admin"/);
});

test("super admin APIs expose package and system lifecycle operations", () => {
  const packageRoute = read("app/api/admin/organizations/[organizationId]/package/route.ts");
  const systemsRoute = read("app/api/admin/organizations/[organizationId]/systems/route.ts");
  const testRoute = read("app/api/admin/tenant-systems/[id]/test/route.ts");
  const activateRoute = read("app/api/admin/tenant-systems/[id]/activate/route.ts");
  for (const file of [packageRoute, systemsRoute, testRoute, activateRoute]) {
    assert.match(file, /getAdminSession/);
  }
  assert.match(packageRoute, /assignOrganizationServicePackage/);
  assert.match(systemsRoute, /requestTenantSystem/);
  assert.match(testRoute, /testTenantSystem/);
  assert.match(activateRoute, /activateTenantSystem/);
});
