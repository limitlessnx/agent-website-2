import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Xposure handoffs keep Maia active without changing other tenants", () => {
  const migration = readFileSync("supabase/migrations/20261026143000_xposure_maia_active_during_handoff.sql", "utf8");
  const runtime = readFileSync("src/trigger/tenant-channel-runtime.ts", "utf8");
  assert.match(migration, /slug='xposure'/);
  assert.match(migration, /then 'ai_active' else 'waiting'/);
  assert.match(migration, /then 'active' else 'paused_for_handoff'/);
  assert.match(migration, /then 'ai_active' else 'human_active'/);
  assert.match(migration, /then 'active' else 'human_takeover'/);
  assert.match(migration, /organization_id=p_organization_id/);
  assert.match(migration, /organization_id=v_handoff\.organization_id/);
  assert.match(migration, /update public\.crm_conversations c[\s\S]*?from public\.organizations o\s+join public\.human_handoffs h/);
  assert.match(migration, /h\.status in \('open','assigned','in_progress','waiting_customer'\)/);
  assert.match(migration, /c\.metadata->>'active_handoff_id'=h\.id::text/);
  assert.match(migration, /return jsonb_build_object\('handoff_id',p_handoff_id,'status','in_progress','membership_id',v_membership\)/);
  assert.doesNotMatch(migration, /maia_active/);
  assert.match(runtime, /\["waiting","human_active","resolved"\]/);
  assert.match(runtime, /\["paused_for_handoff","human_takeover","stopped"\]/);
  assert.doesNotMatch(runtime, /\["active","paused_for_handoff"/);
});
