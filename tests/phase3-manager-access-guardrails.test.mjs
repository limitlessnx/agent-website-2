import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Phase 3 Team & Access exposes organization-scoped manager controls", () => {
  const route = read("app/api/portal/team/access-requests/route.ts");
  const page = read("app/portal/team/page.tsx");
  const client = read("app/portal/team/AccessRequestsClient.tsx");

  assert.match(route, /session\.organizationId/);
  assert.match(route, /action==="approve"\|\|action==="reject"/);
  assert.match(route, /action==="remove"/);
  assert.match(route, /p_organization_id:session\.organizationId/);
  assert.match(page, /manager_access_code/);
  assert.match(client, /Organization Access ID/);
  assert.match(client, /Accept/);
  assert.match(client, /Reject/);
  assert.match(client, /Remove Access/);
});

test("Phase 3 approval assigns the organization manager role", () => {
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");
  assert.match(sql, /where organization_id = v_request\.organization_id/);
  assert.match(sql, /and slug = 'manager'/);
  assert.match(sql, /insert into public\.membership_roles/);
  assert.match(sql, /status = 'approved'/);
});

test("Phase 3 rejection is tied to the requested organization", () => {
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");
  assert.match(sql, /ar\.id = p_request_id/);
  assert.match(sql, /m\.user_id = p_actor_user_id/);
  assert.match(sql, /m\.status = 'active'/);
  assert.match(sql, /r\.slug in \('owner','admin'\)/);
});

test("Phase 3 removal cannot cross organization boundaries and preserves the account", () => {
  const route = read("app/api/portal/team/access-requests/route.ts");
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");
  const memberSql = read("supabase/migrations/202609*.sql");

  assert.match(route, /member\.id===membershipId/);
  assert.match(route, /target\.role!==\"manager\"/);
  assert.match(route, /p_status:\"removed\"/);
  assert.match(sql, /organization_id = p_organization_id/);
  assert.match(sql, /set status=p_status/);
});
