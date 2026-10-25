import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/portal/team/access-requests/route.ts", "utf8");

test("manager access approval and rejection use transaction-safe database RPCs", () => {
  assert.match(route, /rpc\/approve_organization_access_request/);
  assert.match(route, /rpc\/reject_organization_access_request/);
  assert.match(route, /p_request_id: requestId/);
  assert.match(route, /p_actor_user_id: session\.userId/);
});

test("manager access request route does not provision memberships through a sequence of direct writes", () => {
  assert.doesNotMatch(route, /organization_memberships["`]/);
  assert.doesNotMatch(route, /membership_roles["`]/);
  assert.doesNotMatch(route, /organization_access_requests[\s\S]{0,300}method:\s*"PATCH"/);
});
