import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("sign-in resolves an explicit organization invitation before primary membership", () => {
  const route = read("app/api/client-auth/login/route.ts");
  const invitationBranch = route.search(/if\s*\(\s*invitationToken\s*\)/);
  const primaryMembership = route.indexOf("getPrimaryMembership(auth.user.id)");
  assert.notEqual(invitationBranch, -1, "explicit invitation branch must exist");
  assert.notEqual(primaryMembership, -1, "primary membership fallback must exist");
  assert.ok(invitationBranch < primaryMembership, "invitation acceptance must precede primary membership fallback");
  assert.match(route, /acceptOrganizationInvitation\(\{\s*userId:\s*auth\.user\.id,\s*email:\s*auth\.user\.email\s*\|\|\s*email,\s*token:\s*invitationToken,\s*\}\)/);
  assert.match(route, /getMembershipForOrganization\(auth\.user\.id,\s*accepted\.organization_id\)/);
  assert.match(route, /Invitation was accepted, but active organization membership could not be loaded/);
});

test("the signed-in session uses the organization resolved from the accepted invitation", () => {
  const route = read("app/api/client-auth/login/route.ts");
  assert.match(route, /organizationId:\s*membership\.organizationId/);
  assert.match(route, /organizationSlug:\s*membership\.organizationSlug/);
  assert.match(route, /membershipId:\s*membership\.membershipId/);
  assert.match(route, /role:\s*membership\.role/);
  assert.match(route, /getMembershipForOrganization\(auth\.user\.id,accepted\.organization_id\)/);
});

test("workspace provisioning cannot override an explicit invitation", () => {
  const route = read("app/api/client-auth/login/route.ts");
  assert.match(route, /if\s*\(\s*!membership\s*&&\s*!invitationToken\s*\)/);
  assert.match(route, /provisionClientOrganization\(/);
});

test("workspace setup verifies pending context and membership before creating a client session", () => {
  const route = read("app/api/client-auth/setup-workspace/route.ts");
  assert.match(route, /getPendingClientSetupSession\(\)/);
  assert.match(route, /if\s*\(\s*!pending\s*\)/);
  assert.match(route, /provisionClientWorkspace\(/);
  assert.match(route, /getPrimaryMembership\(pending\.userId\)/);
  assert.match(route, /if\s*\(\s*!membership\s*\)/);
  assert.match(route, /setClientSession\(/);
});

test("invitation acceptance is server-authoritative and bound to the authenticated user's email", () => {
  const membership = read("lib/organization-membership.ts");
  assert.match(membership, /accept_organization_invitation/);
  assert.match(membership, /p_user_id: input\.userId/);
  assert.match(membership, /p_user_email: input\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(membership, /p_token_hash: invitationHash\(input\.token\)/);
});

test("the database invitation acceptance rejects expired, revoked, or already accepted tokens", () => {
  const migration = read("supabase/migrations/20260926184807_a2_a3_tenant_membership_permissions.sql");
  assert.match(migration, /where i\.token_hash = p_token_hash\s+and i\.status = 'pending'/);
  assert.match(migration, /for update;/);
  assert.match(migration, /if v_invitation\.expires_at <= now\(\) then/);
  assert.match(migration, /set status='expired'/);
  assert.match(migration, /set status='accepted',accepted_by=p_user_id,accepted_at=now\(\)/);
  assert.match(migration, /Invitation is invalid or no longer available/);
});

test("invitation acceptance verifies both invited email and the matching authenticated user", () => {
  const migration = read("supabase/migrations/20260926184807_a2_a3_tenant_membership_permissions.sql");
  assert.match(migration, /if lower\(v_invitation\.email\) <> v_email then/);
  assert.match(migration, /select 1 from auth\.users\s+where id = p_user_id and lower\(coalesce\(email,''\)\) = v_email/);
  assert.match(migration, /Invitation email does not match the authenticated account/);
  assert.match(migration, /Authenticated user identity could not be verified/);
});

test("invitation acceptance is atomic and cannot be called by anonymous or authenticated database roles", () => {
  const migration = read("supabase/migrations/20260926184807_a2_a3_tenant_membership_permissions.sql");
  assert.match(migration, /create or replace function public\.accept_organization_invitation\([\s\S]*?language plpgsql\s+security definer\s+set search_path = ''/);
  assert.match(migration, /revoke all on function public\.accept_organization_invitation\(uuid,text,text\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.accept_organization_invitation\(uuid,text,text\) to service_role;/);
  assert.match(migration, /insert into public\.organization_memberships[\s\S]*?on conflict \(organization_id,user_id\) do update/);
  assert.match(migration, /update public\.organization_invitations[\s\S]*?set status='accepted'/);
});
