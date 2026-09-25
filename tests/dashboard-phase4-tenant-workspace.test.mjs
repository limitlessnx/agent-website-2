import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("phase 4 preserves tenant onboarding and setup routes", () => {
  const registry = read("app/dashboard/clients/page.tsx");
  assert.match(registry, /\/dashboard\/clients\/\$\{encodeURIComponent\(profile\.organization_id\)\}\/setup/);
  assert.match(registry, /\/dashboard\/switch\/tenant\/\$\{encodeURIComponent\(profile\.organization_id\)\}/);
  assert.match(registry, /Open workspace/);
  assert.match(registry, />Setup</);
});

test("phase 4 tenant navigation exposes only tenant-operating modules", () => {
  const rail = read("components/admin/WorkspaceRail.tsx");
  assert.match(rail, /function tenantItems\(organizationId: string\)/);
  for (const label of ["Home", "Leads", "Conversations", "Activity", "Automations", "Agents", "Analytics", "Settings"]) {
    assert.match(rail, new RegExp(`label: "${label}"`));
  }
  assert.match(rail, /\/dashboard\/tenant\/analytics/);
  assert.match(rail, /\/dashboard\/clients\/\$\{encodeURIComponent\(organizationId\)\}\/setup/);
  const tenantBlock = rail.slice(rail.indexOf("function tenantItems"), rail.indexOf("function active"));
  assert.doesNotMatch(tenantBlock, /Socials|Gencouv|Limitless Realty/);
});

test("phase 4 tenant analytics refuses system-organization context", () => {
  const page = read("app/dashboard/tenant/analytics/page.tsx");
  assert.match(page, /scope\.kind !== "tenant"/);
  assert.match(page, /Tenant required/);
  assert.match(page, /\/dashboard\/clients/);
});

test("phase 4 tenant analytics uses organization-scoped persisted evidence", () => {
  const page = read("app/dashboard/tenant/analytics/page.tsx");
  assert.match(page, /getOrganizationOperationalSnapshot\(scope\)/);
  assert.match(page, /getWorkflowRegistrySummary\(scope\)/);
  assert.match(page, /emptyOrganizationOperationalSnapshot\(scope\.name\)/);
  assert.doesNotMatch(page, /Math\.random|fake|mock/i);
});

test("phase 4 tenant navigation keeps the production dashboard home and shared scoped routes", () => {
  const rail = read("components/admin/WorkspaceRail.tsx");
  for (const route of ["/dashboard", "/dashboard/crm", "/dashboard/conversations", "/dashboard/activity", "/dashboard/workflows", "/dashboard/agents"]) {
    assert.match(rail, new RegExp(route.replaceAll("/", "\\/")));
  }
});
