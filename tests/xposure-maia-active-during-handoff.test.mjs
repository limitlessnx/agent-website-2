import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Xposure handoffs keep Maia active without changing other tenants", () => {
  const migration = readFileSync("supabase/migrations/20261026153000_xposure_maia_active_during_handoff.sql", "utf8");
  assert.match(migration, /slug='xposure'/);
  assert.match(migration, /then 'ai_active' else 'waiting'/);
  assert.match(migration, /then 'active' else 'paused_for_handoff'/);
  assert.match(migration, /then 'ai_active' else 'human_active'/);
  assert.match(migration, /then 'active' else 'human_takeover'/);
  assert.match(migration, /organization_id=p_organization_id/);
  assert.match(migration, /organization_id=v_handoff\.organization_id/);
});
