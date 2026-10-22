import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("tenant inspector requires a platform admin session and resolves the requested organization server-side", () => {
  const page = read("app/dashboard/clients/[organizationId]/inspect/page.tsx");
  assert.match(page, /getAdminSession\(\)/);
  assert.match(page, /if \(!session\) redirect/);
  assert.match(page, /from\("organizations"\)/);
  assert.match(page, /\.eq\("id", organizationId\)/);
  assert.match(page, /if \(error \|\| !organization\) notFound\(\)/);
});

test("tenant inspector builds a tenant-scoped snapshot and renders data without tenant mutations", () => {
  const page = read("app/dashboard/clients/[organizationId]/inspect/page.tsx");
  assert.match(page, /kind: "tenant"/);
  assert.match(page, /organizationId: String\(organization\.id\)/);
  assert.match(page, /getOrganizationOperationalSnapshot\(scope\)/);
  assert.match(page, /Read-only operational view/);
  assert.match(page, /snapshot\.metrics\.map/);
  assert.match(page, /snapshot\.agents\.map/);
  assert.match(page, /snapshot\.notices\.map/);
  assert.doesNotMatch(page, /fetch\(|\.insert\(|\.update\(|\.delete\(|switchOrganization|setAdminOrganizationContext/);
});

test("client registry links to a separate read-only inspector without replacing the normal workspace workflow", () => {
  const clients = read("app/dashboard/clients/page.tsx");
  assert.match(clients, /\/dashboard\/clients\/\$\{encodeURIComponent\(profile\.organization_id\)\}\/inspect/);
  assert.match(clients, /Inspect read-only/);
  assert.match(clients, /\/dashboard\/switch\/tenant\//);
});
