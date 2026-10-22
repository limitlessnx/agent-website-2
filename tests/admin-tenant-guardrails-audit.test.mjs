import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");

test("admin operations use the active validated organization scope", () => {
  const page = read("app/dashboard/agent-operations/page.tsx");
  const scope = read("lib/admin-organization-scope.ts");
  assert.match(page, /resolveAdminOrganizationScope/);
  assert.match(page, /getOperations\(scope\.organizationId\)/);
  assert.doesNotMatch(page, /const ORG\s*=/);
  assert.match(scope, /if \(context\.kind === "tenant"\)/);
  assert.match(scope, /return unavailable\("Tenant organization", context\.id\)/);
});

test("Limitless media loads properties using the active organization", () => {
  const page = read("app/dashboard/limitless/media/page.tsx");
  assert.match(page, /getProperties\(200, scope\.organizationId\)/);
  assert.match(page, /\.eq\("organization_id", scope\.organizationId\)/);
});

test("Super Admin social mutations require an active organization tenant context", () => {
  const actions = read("app/dashboard/social/actions.ts");
  const video = read("app/dashboard/social/video/actions.ts");
  for (const marker of [
    "createSocialPostAction",
    "transitionSocialPostAction",
    "scheduleSocialPostAction",
    "updateSocialBrandAction",
  ]) assert.match(actions, new RegExp(`export async function ${marker}[\\s\\S]*?requireTenant\\(\\)`));
  assert.match(video, /generateReelPlanAction[\s\S]*?requireTenant\(\)/);
});

test("Tenant Flux Credit top-ups require live billing management permission", () => {
  const route = read("app/api/portal/billing/top-up/route.ts");
  assert.match(route, /getOrganizationAccessContext\(session\.organizationId,session\.userId\)/);
  assert.match(route, /assertAnyOrganizationPermission\(access,\["billing\.manage"\]\)/);
});

test("Tenant dashboard mutations remain server-side scoped", () => {
  const systems = read("app/api/portal/systems/request/route.ts");
  const handoffs = read("app/api/portal/handoffs/[id]/route.ts");
  const approvals = read("app/api/portal/approvals/[id]/route.ts");
  assert.match(systems, /getOrganizationAccessContext\(session\.organizationId, session\.userId\)/);
  assert.match(systems, /assertAnyOrganizationPermission\(access, \["systems\.manage"\]\)/);
  assert.match(handoffs, /getClientSession\(\)/);
  assert.match(approvals, /getClientSession\(\)/);
  assert.match(approvals, /decideOperationApproval\(session,id,decision/);
});
