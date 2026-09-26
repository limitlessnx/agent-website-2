import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("admin data scope resolves system and tenant organizations to concrete organization IDs", () => {
  const scope = read("lib/admin-organization-scope.ts");
  assert.match(scope, /fluxknight: "fluxknight"/);
  assert.match(scope, /"limitless-realty": "limitless-realty"/);
  assert.match(scope, /gencouv: "gencouv"/);
  assert.match(scope, /\.eq\("id", context\.id\)/);
  assert.match(scope, /organizationId: String\(data\.id\)/);
});

test("admin requireTenant follows the active super-admin organization", () => {
  const tenant = read("lib/tenant.ts");
  assert.match(tenant, /resolveAdminOrganizationScope/);
  assert.match(tenant, /organizationId: scope\.organizationId/);
  assert.doesNotMatch(tenant, /preferredSlug/);
});

test("dashboard home conversations and activity are active-organization scoped", () => {
  const home = read("app/dashboard/page.tsx");
  const conversations = read("app/dashboard/conversations/page.tsx");
  const activity = read("app/dashboard/activity/page.tsx");
  assert.match(home, /resolveAdminOrganizationScope/);
  assert.match(home, /getOrganizationOperationalSnapshot\(scope\)/);
  assert.match(conversations, /getOrganizationOperationalSnapshot\(scope\)/);
  assert.match(activity, /getOrganizationOperationalSnapshot\(scope\)/);
  assert.doesNotMatch(conversations, /getLeads\(/);
  assert.doesNotMatch(activity, /getProperties\(/);
});

test("organization operational data isolates Fluxknight Limitless Gencouv and tenants", () => {
  const data = read("lib/admin-organization-data.ts");
  assert.match(data, /leo_public_leads/);
  assert.match(data, /\.eq\("organization_id", scope\.organizationId\)/);
  assert.match(data, /gencouv_qualified_leads/);
  assert.match(data, /crm_conversations/);
  assert.match(data, /systemId === "limitless-realty"/);
  assert.match(data, /systemId === "gencouv"/);
  assert.match(data, /systemId === "fluxknight"/);
});

test("workflow registry summary filters by organization scope", () => {
  const workflows = read("lib/workflow-registry.ts");
  assert.match(workflows, /workflowMatchesScope/);
  assert.match(workflows, /scope\.kind === "tenant"/);
  assert.match(workflows, /scope\.workflowLegacyIds/);
  assert.match(workflows, /getWorkflowRegistrySummary\(scope\?: AdminOrganizationScope\)/);
  assert.match(workflows, /workflowRunMatchesScope/);
  assert.match(workflows, /ownedSystemLegacyIds/);
});

test("CRM uses the deployed schema and organization scope", () => {
  const crm = read("app/dashboard/crm/page.tsx");
  assert.match(crm, /requireTenant\(\)/);
  assert.match(crm, /full_name,email,phone,status,created_at/);
  assert.match(crm, /id,stage,score,source,summary,details,created_at,customer_id/);
  assert.doesNotMatch(crm, /display_name/);
  assert.doesNotMatch(crm, /title,status,stage/);
});

test("organization switching persists context before returning to the selected workspace", () => {
  const route = read("app/dashboard/switch/[kind]/[id]/route.ts");
  const sidebar = read("components/admin/AdminSidebar.tsx");
  assert.match(route, /ADMIN_ORGANIZATION_COOKIE/);
  assert.match(route, /NextResponse\.redirect\(new URL\("\/dashboard"/);
  assert.match(sidebar, /fetch\("\/api\/admin\/organization-context"/);
  assert.match(sidebar, /switchOrganization\("system"/);
  assert.match(sidebar, /switchOrganization\("tenant"/);
  assert.match(sidebar, /window\.location\.assign\(href\)/);
});


test("cross-system workflow runs remain isolated", () => {
  const workflows = read("lib/workflow-registry.ts");
  assert.match(workflows, /workflowRunMatchesScope/);
  assert.match(workflows, /ownedSystemLegacyIds\.has\(run\.organization_id\)/);
});


test("Fluxknight legacy workflow records remain visible without leaking other system organizations", () => {
  const workflows = read("lib/workflow-registry.ts");
  assert.match(workflows, /ownedSystemLegacyIds\.has\(workflow\.organization_id\)\) return false/);
  assert.match(workflows, /scope\.workflowLegacyIds\.includes\(workflow\.organization_id\)/);
  assert.match(workflows, /ownedSystemLegacyIds\.has\(run\.organization_id\)\) return false/);
  assert.match(workflows, /scope\.workflowLegacyIds\.includes\(run\.organization_id\)/);
});


test("Fluxknight home includes scoped email automation evidence", () => {
  const data = read("lib/admin-organization-data.ts");
  assert.match(data, /getWorkflowRegistrySummary\(scope\)/);
  assert.match(data, /name: "Email Automation"/);
  assert.match(data, /Outbound Lead Nurture/);
  assert.match(data, /emailWorkflows/);
  assert.match(data, /emailRuns/);
  assert.match(data, /emailFailures/);
});
