import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Phase 2 makes FLX Access ID generation database-enforced", () => {
  const sql = read("supabase/migrations/20261006173000_phase2_organization_flx_invariant.sql");
  assert.match(sql, /ensure_organization_manager_access_code/);
  assert.match(sql, /before insert on public\.organizations/i);
  assert.match(sql, /FLX-/);
  assert.match(sql, /gen_random_bytes\(6\)/);
  assert.match(sql, /manager_access_code set not null/i);
});

test("Phase 2 preserves uniqueness and normalizes supplied Access IDs", () => {
  const sql = read("supabase/migrations/20261006173000_phase2_organization_flx_invariant.sql");
  assert.match(sql, /not exists \([\s\S]*manager_access_code = v_code/);
  assert.match(sql, /upper\(trim\(new\.manager_access_code\)\)/);
});

test("Phase 2 does not expose the Access ID generator to browser roles", () => {
  const sql = read("supabase/migrations/20261006173000_phase2_organization_flx_invariant.sql");
  assert.match(sql, /revoke all on function public\.ensure_organization_manager_access_code\(\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.ensure_organization_manager_access_code\(\) to service_role/i);
});

test("Phase 2 manager access remains organization-scoped", () => {
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");
  assert.match(sql, /where upper\(manager_access_code\) = upper\(trim\(p_access_code\)\)/);
  assert.match(sql, /and status = 'active'/);
  assert.match(sql, /organization_id, requester_user_id/);
});

test("Phase 2 approval requires an owner or admin in the requested organization", () => {
  const sql = read("supabase/migrations/20261005_manager_account_access_mvp.sql");
  assert.match(sql, /m\.organization_id = v_request\.organization_id/);
  assert.match(sql, /m\.user_id = p_actor_user_id/);
  assert.match(sql, /r\.slug in \('owner','admin'\)/);
});

// Guardrail suite marker: Phase 2 verification.
