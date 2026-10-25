import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Xposure tenant API authorization verifies active Xposure membership and requested permission", () => {
  const auth = read("lib/xposure-tenant-authorization.ts");
  assert.match(auth, /getClientSession\(\)/);
  assert.match(auth, /organization\.status !== "active"/);
  assert.match(auth, /organization\.slug !== "xposure"/);
  assert.match(auth, /requirePortalPermission\(session, \[permission\]\)/);
  assert.match(auth, /scope\.kind !== "tenant" \|\| scope\.slug !== "xposure"/);
});

test("catalogue reads and mutations require separate system permissions and tenant scoping", () => {
  const route = read("app/api/admin/studio-catalog/route.ts");
  assert.match(route, /xposureOrganization\("systems\.view"\)/);
  assert.match(route, /xposureOrganization\("systems\.manage"\)/);
  assert.match(route, /eq\("organization_id", access\.organizationId\)/);
  const media = read("app/api/admin/studio-catalog/[id]/media/route.ts");
  assert.match(media, /authorizeXposureTenantAccess\("systems\.manage"\)/);
  assert.match(media, /eq\("organization_id", organizationId\)/);
  assert.match(media, /xposure\/\$\{organizationId\}\/catalogue/);
});

test("contact reads and writes require customer permissions and are tenant-scoped", () => {
  const route = read("app/api/admin/contacts/route.ts");
  assert.match(route, /authorizeXposureTenantAccess\("customers\.view"\)/);
  assert.equal((route.match(/authorizeXposureTenantAccess\("customers\.manage"\)/g) || []).length, 2);
  assert.match(route, /eq\("organization_id", access\.organizationId\)/);
  assert.doesNotMatch(route, /getAdminSession|activeScope/);
});

test("reminder rules and notification history enforce workflow permissions", () => {
  const rules = read("app/api/admin/reminder-rules/route.ts");
  assert.match(rules, /authorizeXposureTenantAccess\("workflows\.read"\)/);
  assert.equal((rules.match(/authorizeXposureTenantAccess\("workflows\.manage"\)/g) || []).length, 2);
  assert.match(rules, /eq\("organization_id", scope\.organizationId\)/);
  const executions = read("app/api/admin/reminder-rules/executions/route.ts");
  assert.match(executions, /authorizeXposureTenantAccess\("workflows\.read"\)/);
  assert.match(executions, /eq\("organization_id", access\.organizationId\)/);
  assert.doesNotMatch(executions, /scope\.organizationId/);
  const notifications = read("app/api/admin/reminder-rules/notifications/route.ts");
  assert.match(notifications, /authorizeXposureTenantAccess\("workflows\.read"\)/);
  assert.match(notifications, /eq\("organization_id", access\.organizationId\)/);
});

test("appointment reminder inbox is tenant-scoped behind workflow read permission", () => {
  const route = read("app/api/admin/appointment-reminder-notifications/route.ts");
  assert.match(route, /authorizeXposureTenantAccess\("workflows\.read"\)/);
  assert.match(route, /eq\("organization_id", access\.organizationId\)/);
});
