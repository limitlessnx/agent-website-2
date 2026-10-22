import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("sign-in resolves an explicit organization invitation before primary membership", () => {
  const route = read("app/api/client-auth/login/route.ts");
  const invitationBranch = route.indexOf("if(invitationToken)");
  const primaryMembership = route.indexOf("getPrimaryMembership(auth.user.id)");
  assert.notEqual(invitationBranch, -1, "explicit invitation branch must exist");
  assert.notEqual(primaryMembership, -1, "primary membership fallback must exist");
  assert.ok(invitationBranch < primaryMembership, "invitation acceptance must precede primary membership fallback");
  assert.match(route, /acceptOrganizationInvitation\\(\\{userId:auth\\.user\\.id,email:auth\\.user\\.email\\|\\|email,token:invitationToken\\}\\)/);
  assert.match(route, /getMembershipForOrganization\\(auth\\.user\\.id,accepted\\.organization_id\\)/);
  assert.match(route, /Invitation was accepted, but active organization membership could not be loaded/);
});

test("the signed-in session uses the organization resolved from the accepted invitation", () => {
  const route = read("app/api/client-auth/login/route.ts");
  assert.match(route, /organizationId:membership\\.organizationId/);
  assert.match(route, /organizationSlug:membership\\.organizationSlug/);
  assert.match(route, /membershipId:membership\\.membershipId/);
  assert.match(route, /role:membership\\.role/);
  assert.match(route, /getMembershipForOrganization\\(auth\\.user\\.id,accepted\\.organization_id\\)/);
});

test("workspace provisioning cannot override an explicit invitation", () => {
  const route = read("app/api/client-auth/login/route.ts");
  assert.match(route, /if\\s*\\(\\s*!membership\\s*&&\\s*!invitationToken\\s*\\)/);
  assert.match(route, /provisionClientOrganization\\(/);
});

test("workspace setup verifies pending context and membership before creating a client session", () => {
  const route = read("app/api/client-auth/setup-workspace/route.ts");
  assert.match(route, /getPendingClientSetupSession\\(\\)/);
  assert.match(route, /if\\s*\\(\\s*!pending\\s*\\)/);
  assert.match(route, /provisionClientWorkspace\\(/);
  assert.match(route, /getPrimaryMembership\\(pending\\.userId\\)/);
  assert.match(route, /if\\s*\\(\\s*!membership\\s*\\)/);
  assert.match(route, /setClientSession\\(/);
});

test("invitation acceptance is server-authoritative and bound to the authenticated user's email", () => {
  const membership = read("lib/organization-membership.ts");
  assert.match(membership, /accept_organization_invitation/);
  assert.match(membership, /p_user_id: input\\.userId/);
  assert.match(membership, /p_user_email: input\\.email\\.trim\\(\\)\\.toLowerCase\\(\\)/);
  assert.match(membership, /p_token_hash: invitationHash\\(input\\.token\\)/);
});
