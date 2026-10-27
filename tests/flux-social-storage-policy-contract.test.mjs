import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20261027001500_fix_flux_social_storage_tenant_folder_policy.sql",
  "utf8",
);

test("all Flux Social Storage policies scope the object path using the outer storage.objects row", () => {
  assert.equal((migration.match(/storage\.foldername\(storage\.objects\.name\)/g) || []).length, 5);
  assert.doesNotMatch(migration, /storage\.foldername\(o\.name\)/);
});

test("read, upload, update, and delete policies require the Flux Social bucket and membership", () => {
  for (const policy of [
    /create policy "Flux Social members read assets"[\s\S]*?for select[\s\S]*?using \([\s\S]*?bucket_id = 'flux-social-assets'[\s\S]*?public\.is_organization_member\(o\.id\)/,
    /create policy "Flux Social members upload assets"[\s\S]*?for insert[\s\S]*?with check \([\s\S]*?bucket_id = 'flux-social-assets'[\s\S]*?public\.is_organization_member\(o\.id\)/,
    /create policy "Flux Social members update assets"[\s\S]*?for update[\s\S]*?using \([\s\S]*?bucket_id = 'flux-social-assets'[\s\S]*?public\.is_organization_member\(o\.id\)[\s\S]*?with check \([\s\S]*?bucket_id = 'flux-social-assets'[\s\S]*?public\.is_organization_member\(o\.id\)/,
    /create policy "Flux Social members delete assets"[\s\S]*?for delete[\s\S]*?using \([\s\S]*?bucket_id = 'flux-social-assets'[\s\S]*?public\.is_organization_member\(o\.id\)/,
  ]) assert.match(migration, policy);
});

test("policy remediation does not change bucket visibility or stored objects", () => {
  assert.doesNotMatch(migration, /update storage\.buckets|delete from storage\.objects|truncate|drop table/i);
  assert.match(migration, /Explicitly qualify storage\.objects\.name/);
});
