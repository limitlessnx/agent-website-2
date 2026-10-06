import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Phase 4 manager dashboard requires manager session and exposes organization access flow", () => {
  const page = read("app/manage-organizations/page.tsx");
  const client = read("app/manage-organizations/ManagerOrganizationsClient.tsx");
  const route = read("app/api/client-auth/manager-access/route.ts");

  assert.match(page, /getManagerSession/);
  assert.match(page, /ManagerOrganizationsClient/);
  assert.match(client, /Manage Organizations/);
  assert.match(client, /Organization Access ID/);
  assert.match(client, /Request Access/);
  assert.match(client, /Access requests/);
  assert.match(client, /Enter Workspace/);
  assert.match(route, /getManagerSession/);
  assert.match(route, /request_organization_access/);
  assert.match(route, /getMembershipForOrganization/);
  assert.match(route, /setClientSession/);
});

test("Phase 4 account mode routes manager accounts into the manager workspace", () => {
  const client = read("app/account/choose-mode/AccountModeClient.tsx");
  const route = read("app/api/client-auth/account-mode/route.ts");

  assert.match(client, /choose\("manager"\)/);
  assert.match(client, /Manage Organizations/);
  assert.match(route, /account_mode.*manager/);
  assert.match(route, /setManagerSession/);
  assert.match(route, /redirect_to:"\/manage-organizations"/);
});

test("Phase 4 access requests are protected and organization-scoped", () => {
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");
  const route = read("app/api/client-auth/manager-access/route.ts");

  assert.match(sql, /auth\.uid\(\).*p_requester_user_id/);
  assert.match(sql, /upper\(manager_access_code\).*upper\(trim\(p_access_code\)\)/);
  assert.match(sql, /status = 'active'/);
  assert.match(sql, /organization_access_requests/);
  assert.match(route, /requester_user_id=eq\./);
});

test("Phase 5 organization admin controls remain tenant-scoped", () => {
  const page = read("app/portal/team/page.tsx");
  const client = read("app/portal/team/AccessRequestsClient.tsx");
  const route = read("app/api/portal/team/access-requests/route.ts");
  const settings = read("app/portal/settings/page.tsx");

  assert.match(page, /Team & Access/);
  assert.match(page, /manager_access_code/);
  assert.match(client, /Organization Access ID/);
  assert.match(client, /Accept/);
  assert.match(client, /Reject/);
  assert.match(client, /Remove Access/);
  assert.match(route, /session\.organizationId/);
  assert.match(route, /p_organization_id:session\.organizationId/);
  assert.match(settings, /Workspace members/);
});

test("Phase 5 manager removal preserves the account while blocking workspace access", () => {
  const client = read("app/portal/team/AccessRequestsClient.tsx");
  const route = read("app/api/portal/team/access-requests/route.ts");
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");

  assert.match(client, /keeps their account and history but blocks workspace access/);
  assert.match(route, /p_status:"removed"/);
  assert.match(sql, /organization_memberships/);
  assert.match(sql, /set status = 'active'/);
});
