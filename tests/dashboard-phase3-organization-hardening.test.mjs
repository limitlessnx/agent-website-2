import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("phase 3 organization hardening remains compatible with the A7 canonical admin control planes", () => {
  const nav = read("components/admin/navigationConfig.ts");
  for (const route of [
    "/dashboard",
    "/dashboard/clients",
    "/dashboard/onboarding",
    "/dashboard/evaluations",
    "/dashboard/workflows",
    "/dashboard/agents",
    "/dashboard/integrations",
    "/dashboard/control-center",
    "/dashboard/conversations",
    "/dashboard/activity",
    "/dashboard/health",
    "/dashboard/support",
    "/dashboard/billing",
    "/dashboard/settings",
  ]) assert.match(nav, new RegExp(route.replaceAll("/", "\\/")));
  for (const label of ["Overview", "Clients", "Systems", "Operations", "Billing", "Security"]) {
    assert.match(nav, new RegExp(`label:"${label}"`));
  }
});

test("phase 3 keeps system and tenant organizations distinct", () => {
  const nav = read("components/admin/navigationConfig.ts");
  const sidebar = read("components/admin/AdminSidebar.tsx");
  assert.match(sidebar, /System Organizations/);
  assert.match(sidebar, /Tenant Organizations/);
  assert.match(sidebar, /switchOrganization\("system"/);
  assert.match(sidebar, /switchOrganization\("tenant"/);
});

test("phase 3 organization scope fails soft instead of crashing pages", () => {
  const scope = read("lib/admin-organization-scope.ts");
  assert.match(scope, /status: "unavailable"/);
  assert.match(scope, /unavailable:\$\{context\.kind\}/);
  assert.doesNotMatch(scope, /throw new Error\("No organization is available/);
});

test("phase 3 scopes agent management to the active organization", () => {
  const data = read("lib/agent-management.ts");
  const page = read("app/dashboard/agents/page.tsx");
  assert.match(data, /getAgentManagementSummary\(scope\?: AdminOrganizationScope\)/);
  assert.match(data, /scopedAgents/);
  assert.match(data, /scopedProjects/);
  assert.match(data, /scopedWorkflows/);
  assert.match(data, /scopedLinks/);
  assert.match(page, /resolveAdminOrganizationScope/);
  assert.match(page, /getAgentManagementSummary\(scope\)/);
});

test("phase 3 system workspaces expose contextual operating navigation", () => {
  const rail = read("components/admin/WorkspaceRail.tsx");
  assert.match(rail, /const fluxknight/);
  assert.match(rail, /const limitless/);
  assert.match(rail, /const gencouv/);
  assert.match(rail, /\/dashboard\/workflows/);
  assert.match(rail, /\/dashboard\/conversations/);
  assert.match(rail, /\/dashboard\/activity/);
  assert.match(rail, /\/dashboard\/social/);
});

test("phase 3 keeps dashboard home labels organization-neutral", () => {
  const home = read("components/admin/DashboardHomeExperience.tsx");
  assert.match(home, /workspaceName \|\| "Organization"/);
  assert.doesNotMatch(home, /aria-label="Fluxknight dashboard overview"/);
});
