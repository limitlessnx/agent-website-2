import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Xposure tenant scope selects its own studio overview without changing Limitless Realty", () => {
  const page = read("app/dashboard/page.tsx");
  const home = read("components/admin/DashboardHomeExperience.tsx");
  assert.match(page, /scope\.kind === "tenant" && scope\.slug === "xposure"/);
  assert.match(home, /xposureDashboard \? \(/);
  assert.match(home, /<XposureStudioOverview/);
  assert.match(home, /: limitless \? \(/);
});

test("Xposure overview uses organization snapshot data and existing dashboard destinations", () => {
  const overview = read("components/admin/XposureStudioOverview.tsx");
  for (const path of ["/dashboard/conversations", "/dashboard/agents", "/dashboard/activity"]) {
    assert.ok(overview.includes(path), "Missing verified dashboard destination: " + path);
  }
  assert.match(overview, /metrics\.find/);
  assert.match(overview, /notices\.slice/);
  assert.match(overview, /activity\.slice/);
  assert.match(overview, /does not by itself confirm WhatsApp delivery or Maia runtime health/);
});

test("Xposure overview does not reuse Limitless Realty property or payment widgets", () => {
  const overview = read("components/admin/XposureStudioOverview.tsx");
  assert.doesNotMatch(overview, /limitless\/properties|payment_plans|RevenueHero|Property Catalog/i);
});

test("Xposure catalogue is isolated from real-estate inventory and guarded by active tenant scope", () => {
  const page = read("app/dashboard/catalogue/page.tsx");
  const api = read("app/api/admin/studio-catalog/route.ts");
  const migration = read("supabase/migrations/20261021230000_xposure_studio_catalog.sql");
  const overview = read("components/admin/XposureStudioOverview.tsx");
  assert.match(page, /scope\.kind !== "tenant" \|\| scope\.slug !== "xposure"/);
  assert.match(page, /eq\("organization_id", scope\.organizationId\)/);
  assert.match(api, /xposureOrganization\("systems\.view"\)/);
  assert.match(api, /xposureOrganization\("systems\.manage"\)/);
  assert.match(api, /eq\("organization_id", access\.organizationId\)/);
  assert.match(api, /status: "draft"/);
  assert.match(migration, /studio_catalog_items/);
  assert.match(migration, /revoke all on public\.studio_catalog_items from public, anon, authenticated/);
  assert.match(overview, /href: "\/dashboard\/catalogue"/);
  assert.doesNotMatch(api, /property_id|limitless-realty/);
});

test("Xposure catalogue media uploads are organization-scoped and type/size restricted", () => {
  const media = read("app/api/admin/studio-catalog/[id]/media/route.ts");
  const component = read("components/admin/StudioCatalogue.tsx");
  assert.match(media, /authorizeXposureTenantAccess\("systems\.manage"\)/);
  assert.match(media, /eq\("id", id\)\.eq\("organization_id", organizationId\)/);
  assert.match(media, /IMAGE_LIMIT = 10 \* 1024 \* 1024/);
  assert.match(media, /VIDEO_LIMIT = 100 \* 1024 \* 1024/);
  assert.match(media, /admin\.storage\.from\(PUBLIC_MEDIA_BUCKET\)\.upload/);
  assert.match(media, /studio_catalog_items/);
  assert.match(component, /Add reference photo or studio video/);
  assert.match(component, /\/api\/admin\/studio-catalog\//);
});
