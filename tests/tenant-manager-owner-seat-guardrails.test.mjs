import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const membership = read("lib/organization-membership.ts");
const api = read("app/api/portal/team/access-requests/route.ts");
const page = read("app/portal/team/page.tsx");
const ui = read("app/portal/team/AccessRequestsClient.tsx");
const sql = read("supabase/migrations/20261118091000_owner_only_tenant_manager_access.sql");

test("invitation and membership mutation operations require owner context", () => {
  assert.match(membership, /export function assertOrganizationOwner/);
  for (const fn of ["createOrganizationInvitation", "updateOrganizationMemberAccess", "revokeOrganizationInvitation", "setOrganizationRolePermissions"]) {
    const start = membership.indexOf(`export async function ${fn}(`);
    assert.ok(start >= 0, `Missing ${fn}`);
    const end = membership.indexOf("export async function ", start + 1);
    const body = membership.slice(start, end < 0 ? undefined : end);
    assert.match(body, /assertOrganizationOwner\(access\)/, `${fn} requires owner`);
  }
  assert.match(membership, /key\.startsWith\("members\."\)/);
});

test("Access ID approvals and removals require owner while managers can view roster", () => {
  assert.match(api, /assertOrganizationOwner\(access\)/);
  assert.match(api, /if \(!access\.roles\.includes\("owner"\)\)/);
  assert.match(page, /canManage=\{canManage\}/);
  assert.match(ui, /\{canManage \? <>/);
  assert.match(ui, /canManage && member\.role === "manager"/);
});

test("plan seat limits are displayed and checked by the Access ID approval RPC", () => {
  assert.match(membership, /rpc\/organization_effective_seat_limit/);
  assert.match(ui, /summary\.availableSeats/);
  assert.match(ui, /atLimit/);
  assert.match(sql, /Organization team seat limit reached/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(v_request\.organization_id::text, 187\)\)/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_organization_id::text, 187\)\)/);
});

test("manager privileges are nondelegable in seeded and customized roles", () => {
  assert.match(sql, /Team access, ownership and billing permissions are reserved to the organization owner/);
  assert.match(sql, /r\.slug <> 'owner'/);
  assert.match(sql, /p\.key <> 'members\.view'/);
  assert.doesNotMatch(sql, /'members\.view','members\.invite','members\.suspend'/);
});

test("legacy manager approval RPCs are service-role only", () => {
  for (const fn of ["approve_organization_access_request", "reject_organization_access_request"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(uuid,uuid\\) from public, anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(uuid,uuid\\) to service_role`, "i"));
  }
});
