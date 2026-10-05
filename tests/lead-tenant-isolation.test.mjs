import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("contact service resolves organization context before lead writes", () => {
  const service = read("lib/lead-profile-service.ts");
  assert.match(service, /resolveAdminOrganizationScope/);
  assert.match(service, /currentOrganizationId/);
  assert.match(service, /organization_id: organizationId/);
});

test("contact service scopes reads and mutations by organization", () => {
  const service = read("lib/lead-profile-service.ts");
  assert.match(service, /organization_id=eq\.\$\{encodeURIComponent\(organizationId\)\}/);
  assert.match(service, /&organization_id=eq\.\$\{encodeURIComponent\(organizationId\)\}/);
});

test("contact service does not use global phone conflict resolution", () => {
  const service = read("lib/lead-profile-service.ts");
  assert.doesNotMatch(service, /on_conflict=phone/);
});

test("tenant scoped phone uniqueness migration exists", () => {
  const migration = read("supabase/migrations/20261005114500_tenant_scoped_lead_phone_uniqueness.sql");
  assert.match(migration, /unique index/i);
  assert.match(migration, /organization_id, phone/);
});
