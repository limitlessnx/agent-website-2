import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Xposure catalogue API protects writes with photography and organization permissions", () => {
  const route = read("app/api/portal/catalogue/route.ts");
  assert.match(route, /getClientSession/);
  assert.match(route, /profile\?\.industry !== "photography-studio"/);
  assert.match(route, /customers\.manage/);
  assert.match(route, /systems\.manage/);
  assert.match(route, /eq\("organization_id", organizationId\)/);
  assert.match(route, /photography_catalogue_categories/);
  assert.match(route, /photography_catalogue_items/);
  assert.match(route, /photography_catalogue_media/);
  assert.match(route, /action === "archive"/);
  assert.match(route, /action === "restore"/);
  assert.match(route, /action === "add_media"/);
  assert.match(route, /action === "remove_media"/);
});

test("Xposure catalogue management page collects package details and media metadata", () => {
  const page = read("app/portal/catalogue/new/page.tsx");
  const form = read("app/portal/catalogue/CatalogueItemForm.tsx");
  assert.match(page, /requirePortalPermission/);
  assert.match(page, /photography_catalogue_categories/);
  assert.match(form, /name="categoryId"/);
  assert.match(form, /name="priceMinor"/);
  assert.match(form, /name="durationMinutes"/);
  assert.match(form, /name="mediaUrl"/);
  assert.match(form, /api\/portal\/catalogue/);
  const manager = read("app/portal/catalogue/CatalogueManager.tsx");
  assert.match(manager, /setEditing/);
  assert.match(manager, /Attach image/);
  assert.match(manager, /Restore/);
  assert.match(manager, /Archive/);
});
