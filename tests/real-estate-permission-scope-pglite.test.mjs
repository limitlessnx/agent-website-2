import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import test from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20261025211057_20261024141650_real_estate_permission_scope.sql', import.meta.url), 'utf8');
const ids = {
  orgA: '10000000-0000-4000-8000-000000000001',
  orgB: '10000000-0000-4000-8000-000000000002',
  otherOrg: '10000000-0000-4000-8000-000000000003',
  userA: '20000000-0000-4000-8000-000000000001',
  userB: '20000000-0000-4000-8000-000000000002',
  admin: '20000000-0000-4000-8000-000000000003',
  memberA: '30000000-0000-4000-8000-000000000001',
  memberB: '30000000-0000-4000-8000-000000000002',
  roleA: '40000000-0000-4000-8000-000000000001',
  roleB: '40000000-0000-4000-8000-000000000002',
  permissionCustomers: '50000000-0000-4000-8000-000000000001',
  permissionKnowledge: '50000000-0000-4000-8000-000000000002',
  estateA: '60000000-0000-4000-8000-000000000001',
  estateB: '60000000-0000-4000-8000-000000000002',
};

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

    CREATE TABLE public.organizations(id uuid PRIMARY KEY, slug text NOT NULL, status text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}');
    CREATE TABLE public.organization_memberships(id uuid PRIMARY KEY, organization_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL);
    CREATE TABLE public.roles(id uuid PRIMARY KEY, organization_id uuid, slug text NOT NULL);
    CREATE TABLE public.membership_roles(membership_id uuid NOT NULL, role_id uuid NOT NULL);
    CREATE TABLE public.permissions(id uuid PRIMARY KEY, key text NOT NULL UNIQUE);
    CREATE TABLE public.role_permissions(role_id uuid NOT NULL, permission_id uuid NOT NULL);
    CREATE TABLE public.platform_super_admins(user_id uuid PRIMARY KEY, status text NOT NULL);

    CREATE TABLE public.real_estate_estates(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    CREATE TABLE public.real_estate_estate_faqs(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    CREATE TABLE public.real_estate_estate_knowledge_links(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    ALTER TABLE public.real_estate_estates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.real_estate_estate_faqs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.real_estate_estate_knowledge_links ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.real_estate_estates, public.real_estate_estate_faqs, public.real_estate_estate_knowledge_links TO authenticated;

    CREATE FUNCTION public.is_platform_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
      SELECT EXISTS (SELECT 1 FROM public.platform_super_admins p WHERE p.user_id=auth.uid() AND p.status='active');
    $$;
    GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;
  `);
  await db.exec(migration);
  await db.query(
    `INSERT INTO public.organizations(id,slug,status,metadata) VALUES
      ($1,'limitless-realty','active','{}'),
      ($2,'agency-b','active','{"industry_slug":"real_estate"}'),
      ($3,'other-tenant','active','{"industry_slug":"property_management"}')`,
    [ids.orgA, ids.orgB, ids.otherOrg],
  );
  await db.query(
    `INSERT INTO public.organization_memberships(id,organization_id,user_id,status) VALUES
      ($1,$2,$3,'active'),($4,$5,$6,'active')`,
    [ids.memberA, ids.orgA, ids.userA, ids.memberB, ids.orgB, ids.userB],
  );
  await db.query(
    `INSERT INTO public.roles(id,organization_id,slug) VALUES ($1,$2,'owner-a'),($3,$4,'owner-b')`,
    [ids.roleA, ids.orgA, ids.roleB, ids.orgB],
  );
  await db.query(
    `INSERT INTO public.permissions(id,key) VALUES ($1,'customers.manage'),($2,'knowledge.manage')`,
    [ids.permissionCustomers, ids.permissionKnowledge],
  );
  await db.query('INSERT INTO public.role_permissions(role_id,permission_id) VALUES ($1,$2),($1,$3),($4,$2),($4,$3)', [ids.roleA, ids.permissionCustomers, ids.permissionKnowledge, ids.roleB]);
  // User A initially has only a corrupt role from tenant B; permission checks
  // must ignore it even though that foreign role contains both privileged keys.
  await db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2),($3,$4)', [ids.memberA, ids.roleB, ids.memberB, ids.roleB]);
  await db.query('INSERT INTO public.platform_super_admins(user_id,status) VALUES ($1,\'active\')', [ids.admin]);
  return db;
}

test('scoped helper accepts matching tenant permissions and rejects corrupt cross-tenant role mappings', async () => {
  const db = await database();
  try {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.userA}';`);
    const helper = async (org, permission) => (await db.query('SELECT public.has_real_estate_permission($1,$2) AS allowed', [org, permission])).rows[0].allowed;
    assert.equal(await helper(ids.orgA, 'customers.manage'), false);
    assert.equal(await helper(ids.orgA, 'knowledge.manage'), false);
    assert.equal(await helper(ids.orgA, 'properties.view'), false);
    assert.equal(await helper(ids.orgB, 'customers.manage'), false);
    assert.equal(await helper(ids.otherOrg, 'customers.manage'), false);
    await db.exec('RESET ROLE;');
    await db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.roleA]);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.userA}';`);
    assert.equal(await helper(ids.orgA, 'customers.manage'), true);
    assert.equal(await helper(ids.orgA, 'knowledge.manage'), true);
  } finally {
    await db.close();
  }
});

test('new estate write policies reject another tenant even when the caller holds a corrupt foreign role', async () => {
  const db = await database();
  try {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.userA}';`);
    await assert.rejects(
      db.query('INSERT INTO public.real_estate_estates(id,organization_id) VALUES ($1,$2)', [ids.estateA, ids.orgA]),
      /row-level security policy/,
    );
    await assert.rejects(
      db.query('INSERT INTO public.real_estate_estates(id,organization_id) VALUES ($1,$2)', [ids.estateB, ids.orgB]),
      /row-level security policy/,
    );
  } finally {
    await db.close();
  }
});

test('platform-admin bypass remains limited to active real-estate organizations', async () => {
  const db = await database();
  try {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.admin}';`);
    const helper = async (org) => (await db.query('SELECT public.has_real_estate_permission($1,$2) AS allowed', [org, 'knowledge.manage'])).rows[0].allowed;
    assert.equal(await helper(ids.orgA), true);
    assert.equal(await helper(ids.orgB), true);
    assert.equal(await helper(ids.otherOrg), false);
  } finally {
    await db.close();
  }
});

test('helper is postgres-owned, pg_catalog-pinned, non-anon, and policies no longer use legacy helper', async () => {
  const db = await database();
  try {
    const fn = (await db.query(`
      SELECT pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='has_real_estate_permission' LIMIT 1
    `)).rows[0];
    assert.equal(fn.owner, 'postgres');
    assert.equal(fn.prosecdef, true);
    assert.ok(fn.proconfig.includes('search_path=pg_catalog'));
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.has_real_estate_permission(uuid,text)','EXECUTE') AS allowed")).rows[0].allowed, false);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.has_real_estate_permission(uuid,text)','EXECUTE') AS allowed")).rows[0].allowed, true);
    assert.match(migration, /has_real_estate_permission\(organization_id/);
    assert.doesNotMatch(migration, /has_organization_permission\(organization_id/);
    assert.match(migration, /only the three newly introduced write policies/i);
  } finally {
    await db.close();
  }
});
