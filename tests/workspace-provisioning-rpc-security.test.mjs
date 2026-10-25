import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261021180000_secure_workspace_provisioning_rpc.sql", "utf8");
const onboarding = readFileSync("lib/client-onboarding.ts", "utf8");

test("workspace provisioning RPCs are server-only", () => {
  assert.match(migration, /revoke all on function public\.provision_client_workspace\(uuid, text, text, text, text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.provision_client_workspace\(uuid, text, text, text, text\) to service_role/i);
  assert.match(migration, /revoke all on function public\.provision_client_organization\(uuid, text, text, text, text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.provision_client_organization\(uuid, text, text, text, text\) to service_role/i);
});

test("workspace provisioning remains routed through server-side onboarding", () => {
  assert.match(onboarding, /rpc\/provision_trial_client_organization|rpc\/provision_client_workspace/);
});
