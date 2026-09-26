import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("A2/A3 migration establishes invitation and role foundations", () => {
  const sql = read("supabase/migrations/20260926184807_a2_a3_tenant_membership_permissions.sql");
  assert.match(sql, /create table if not exists public\.organization_invitations/);
  assert.match(sql, /'owner'.*'manager'.*'supervisor'.*'team-member'/s);
  assert.match(sql, /organization_effective_seat_limit/);
  assert.match(sql, /coalesce[\s\S]*3/);
  assert.match(sql, /token_hash/);
  assert.doesNotMatch(sql, /invitation_token\s+text/);
});

test("A2/A3 privileged membership RPCs remain service-role only", () => {
  const sql = read("supabase/migrations/20260926184807_a2_a3_tenant_membership_permissions.sql");
  for (const fn of [
    "create_organization_invitation",
    "accept_organization_invitation",
    "update_organization_member_access",
    "set_organization_role_permissions",
    "revoke_organization_invitation",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, "i"));
  }
});

test("A2/A3 member management revalidates live database permissions", () => {
  const access = read("lib/organization-membership.ts");
  assert.match(access, /getOrganizationAccessContext/);
  assert.match(access, /status=eq\.active/);
  assert.match(access, /assertAnyOrganizationPermission/);
  assert.match(access, /members\.roles\.manage/);
  assert.match(access, /members\.suspend/);
  assert.match(access, /members\.invite/);
});

test("A2/A3 invitation signup joins an organization instead of provisioning a new one", () => {
  const signup = read("app/api/client-auth/signup/route.ts");
  const login = read("app/api/client-auth/login/route.ts");
  assert.match(signup, /invitation_token/);
  assert.match(signup, /acceptOrganizationInvitation/);
  assert.match(login, /acceptOrganizationInvitation/);
  assert.match(signup, /joiningOrganization/);
});

test("A2/A3 exposes tenant member, invitation, and role APIs", () => {
  const members = read("app/api/organization/members/route.ts");
  const invitations = read("app/api/organization/invitations/route.ts");
  const roles = read("app/api/organization/roles/route.ts");
  assert.match(members, /listOrganizationMembers/);
  assert.match(members, /updateOrganizationMemberAccess/);
  assert.match(invitations, /createOrganizationInvitation/);
  assert.match(invitations, /revokeOrganizationInvitation/);
  assert.match(roles, /setOrganizationRolePermissions/);
});
