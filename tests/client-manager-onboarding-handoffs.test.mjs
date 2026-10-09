import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("sign-in honors an explicit organization invitation before resolving a primary membership", () => {
  const route = read("app/api/client-auth/login/route.ts");
  const invitationBranch = route.indexOf("if(invitationToken)");
  const primaryMembership = route.indexOf("getPrimaryMembership(auth.user.id)");
  assert.notEqual(invitationBranch, -1, "explicit invitation branch must exist");
  assert.notEqual(primaryMembership, -1, "primary membership fallback must exist");
  assert.ok(invitationBranch < primaryMembership, "invitation acceptance must run before primary-membership fallback");
  assert.match(route, /acceptOrganizationInvitation\(\{userId:auth\.user\.id,email:auth\.user\.email\|\|email,token:invitationToken\}\)/);
  assert.match(route, /getMembershipForOrganization\(auth\.user\.id,accepted\.organization_id\)/);
  assert.match(route, /Invitation was accepted, but active organization membership could not be loaded/);
});

test("workspace provisioning is not used as a fallback when a sign-in explicitly carries an invitation", () => {
  const route = read("app/api/client-auth/login/route.ts");
  assert.match(route, /if\s*\(\s*!membership\s*&&\s*!invitationToken\s*\)/);
  assert.match(route, /provisionClientOrganization\(/);
});

test("workspace setup requires pending setup context and verifies membership before setting the client session", () => {
  const route = read("app/api/client-auth/setup-workspace/route.ts");
  assert.match(route, /getPendingClientSetupSession\(\)/);
  assert.match(route, /if\s*\(\s*!pending\s*\)/);
  assert.match(route, /provisionClientWorkspace\(/);
  assert.match(route, /getPrimaryMembership\(pending\.userId\)/);
  assert.match(route, /if\s*\(\s*!membership\s*\)/);
  assert.match(route, /setClientSession\(/);
});

test("invitation acceptance remains server-authoritative and email-bound", () => {
  const membership = read("lib/organization-membership.ts");
  assert.match(membership, /accept_organization_invitation/);
  assert.match(membership, /p_user_id: input\.userId/);
  assert.match(membership, /p_user_email: input\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(membership, /p_token_hash: invitationHash\(input\.token\)/);
});
