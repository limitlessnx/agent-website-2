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


test("Flux Social Storage policies enforce tenant isolation in a disposable PGlite database", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const orgA = "10000000-0000-4000-8000-000000000001";
  const orgB = "10000000-0000-4000-8000-000000000002";
  const userA = "20000000-0000-4000-8000-000000000001";
  const objectA = "30000000-0000-4000-8000-000000000001";
  const objectB = "30000000-0000-4000-8000-000000000002";

  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION storage.foldername(object_name text) RETURNS text[]
        LANGUAGE sql IMMUTABLE
        AS $$ SELECT CASE WHEN position('/' in object_name) > 0
          THEN ARRAY[split_part(object_name, '/', 1)]::text[]
          ELSE ARRAY[]::text[] END $$;

      CREATE TABLE public.organizations (
        id uuid PRIMARY KEY,
        name text NOT NULL
      );
      CREATE TABLE public.organization_memberships (
        organization_id uuid NOT NULL REFERENCES public.organizations(id),
        user_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'active'
      );
      CREATE FUNCTION public.is_organization_member(target_organization_id uuid)
        RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public, auth
        AS $$
          SELECT EXISTS (
            SELECT 1 FROM public.organization_memberships m
            WHERE m.organization_id = target_organization_id
              AND m.user_id = auth.uid()
              AND m.status = 'active'
          )
        $$;
      CREATE TABLE storage.objects (
        id uuid PRIMARY KEY,
        bucket_id text NOT NULL,
        name text NOT NULL
      );
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
      GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
      GRANT SELECT ON public.organizations TO authenticated, service_role;
      GRANT SELECT ON public.organization_memberships TO authenticated, service_role;
    `);

    await db.query(
      "INSERT INTO public.organizations(id,name) VALUES ($1,'Tenant A'),($2,'Tenant B')",
      [orgA, orgB],
    );
    await db.query(
      "INSERT INTO public.organization_memberships(organization_id,user_id,status) VALUES ($1,$2,'active')",
      [orgA, userA],
    );
    await db.query(
      "INSERT INTO storage.objects(id,bucket_id,name) VALUES ($1,'flux-social-assets',$2),($3,'flux-social-assets',$4)",
      [objectA, orgA + "/cover.png", objectB, orgB + "/cover.png"],
    );

    await db.exec(migration);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${userA}';`);

    const visible = await db.query(
      "SELECT id,name FROM storage.objects ORDER BY name",
    );
    assert.deepEqual(visible.rows.map((row) => row.id), [objectA]);

    await db.query(
      "INSERT INTO storage.objects(id,bucket_id,name) VALUES ($1,'flux-social-assets',$2)",
      ["30000000-0000-4000-8000-000000000003", orgA + "/new.png"],
    );
    await assert.rejects(
      db.query(
        "INSERT INTO storage.objects(id,bucket_id,name) VALUES ($1,'flux-social-assets',$2)",
        ["30000000-0000-4000-8000-000000000004", orgB + "/forbidden.png"],
      ),
    );
    await assert.rejects(
      db.query("UPDATE storage.objects SET name=$1 WHERE id=$2", [orgB + "/moved.png", objectA]),
    );

    const unchanged = await db.query("SELECT name FROM storage.objects WHERE id=$1", [objectA]);
    assert.equal(unchanged.rows[0]?.name, orgA + "/cover.png");

    await db.query("DELETE FROM storage.objects WHERE id=$1", [objectB]);
    await db.exec("RESET ROLE; SET ROLE service_role;");
    const otherTenantObject = await db.query("SELECT id FROM storage.objects WHERE id=$1", [objectB]);
    assert.equal(otherTenantObject.rows.length, 1);

    const ownTenantObjectBeforeDelete = await db.query("SELECT id FROM storage.objects WHERE id=$1", [objectA]);
    assert.equal(ownTenantObjectBeforeDelete.rows.length, 1);
    await db.exec("RESET ROLE; SET ROLE authenticated;");
    await db.query("DELETE FROM storage.objects WHERE id=$1", [objectA]);
    await db.exec("RESET ROLE; SET ROLE service_role;");
    const ownTenantObject = await db.query("SELECT id FROM storage.objects WHERE id=$1", [objectA]);
    assert.equal(ownTenantObject.rows.length, 0);
  } finally {
    await db.close();
  }
});
