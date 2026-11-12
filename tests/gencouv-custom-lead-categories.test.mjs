import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261112230000_crm_custom_lead_categories.sql");
const api = read("app/api/dashboard/gencouv/categories/route.ts");
const ui = read("components/gencouv/GencouvCategories.tsx");
const page = read("app/dashboard/gencouv/categories/page.tsx");
const dashboard = read("app/dashboard/gencouv/page.tsx");

test("category migration is tenant scoped and non-destructive", () => {
  assert.match(migration, /create table if not exists public\.crm_lead_categories/);
  assert.match(migration, /create table if not exists public\.crm_customer_category_assignments/);
  assert.match(migration, /foreign key \(customer_id, organization_id\)/);
  assert.match(migration, /foreign key \(category_id, organization_id\)/);
  assert.match(migration, /alter table public\.crm_lead_categories enable row level security/);
  assert.match(migration, /alter table public\.crm_customer_category_assignments enable row level security/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.crm_customers/i);
  assert.doesNotMatch(migration, /\\n/);
});

test("category API checks admin session, selected tenant and same-origin mutations", () => {
  assert.match(api, /getAdminSession\(\)/);
  assert.match(api, /requireAdminSystemScope\("gencouv"\)/);
  assert.match(api, /organizationId/);
  assert.match(api, /originOk\(request\)/);
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.match(api, new RegExp("export async function " + method + "\\("));
  }
  assert.match(api, /\.eq\("organization_id", organizationId\)/);
});

test("category UI provides create rename and delete, linked from Gencouv dashboard", () => {
  assert.match(ui, /Add category/);
  assert.match(ui, /Rename/);
  assert.match(ui, /Delete/);
  assert.match(page, /GencouvCategories/);
  assert.match(dashboard, /\/dashboard\/gencouv\/categories/);
});
