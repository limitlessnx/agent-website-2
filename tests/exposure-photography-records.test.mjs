import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Xposure photography records are tenant scoped and linked to canonical appointments", () => {
  const migration = read("supabase/migrations/20261023000000_exposure_photography_records.sql");
  for (const table of ["photography_catalogue_categories", "photography_catalogue_items", "photography_catalogue_media", "photography_booking_metadata"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`${table}[\\s\\S]*organization_id uuid not null references public\\.organizations`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`is_organization_member\\(organization_id\\)`));
  }
  assert.match(migration, /references public\.appointments\(organization_id, id\)/);
  assert.match(migration, /references public\.photography_catalogue_items\(organization_id, id\)/);
  assert.match(migration, /where p\.industry = 'photography-studio'/);
  assert.match(migration, /on conflict \(organization_id, slug\) do update/);
});

test("Xposure dashboard reads live catalogue categories and counts items by tenant", () => {
  const portal = read("app/portal/page.tsx");
  const dashboard = read("components/portal/PhotographyDashboard.tsx");
  assert.match(portal, /photography_catalogue_categories/);
  assert.match(portal, /photography_catalogue_items/);
  assert.match(portal, /categoryCounts/);
  assert.match(portal, /organization_id.*session\.organizationId/);
  assert.match(dashboard, /data\.catalogueCategories\.map/);
  assert.match(dashboard, /category\.itemCount/);
});
