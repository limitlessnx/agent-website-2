import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import test from 'node:test';

const draft = readFileSync(new URL('../STAGING_BASELINE_AUTHZ_CORE_DRAFT.sql', import.meta.url), 'utf8');
const baselinePreview = readFileSync(new URL('../STAGING_BASELINE_DDL_PREVIEW.sql', import.meta.url), 'utf8');
const ids = {
  orgA: '10000000-0000-4000-8000-000000000001',
  orgB: '10000000-0000-4000-8000-000000000002',
  userA: '20000000-0000-4000-8000-000000000001',
  userB: '20000000-0000-4000-8000-000000000002',
  inactiveUser: '20000000-0000-4000-8000-000000000003',
  suspendedUser: '20000000-0000-4000-8000-000000000005',
  removedUser: '20000000-0000-4000-8000-000000000006',
  admin: '20000000-0000-4000-8000-000000000004',
  memberA: '30000000-0000-4000-8000-000000000001',
  memberB: '30000000-0000-4000-8000-000000000002',
  memberInactive: '30000000-0000-4000-8000-000000000003',
  memberSuspended: '30000000-0000-4000-8000-000000000005',
  memberRemoved: '30000000-0000-4000-8000-000000000006',
  roleA: '40000000-0000-4000-8000-000000000001',
  roleB: '40000000-0000-4000-8000-000000000002',
  globalRole: '40000000-0000-4000-8000-000000000003',
  permissionView: '50000000-0000-4000-8000-000000000001',
  permissionManage: '50000000-0000-4000-8000-000000000002',
  permissionWildcard: '50000000-0000-4000-8000-000000000003',
  permissionGlobal: '50000000-0000-4000-8000-000000000004',
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
    GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

    CREATE TABLE public.organizations (
      id uuid PRIMARY KEY,
      name text NOT NULL
    );
    CREATE TABLE public.organization_memberships (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL REFERENCES public.organizations(id),
      user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'active'
    );
    CREATE TABLE public.roles (
      id uuid PRIMARY KEY,
      organization_id uuid REFERENCES public.organizations(id),
      name text NOT NULL,
      slug text NOT NULL,
      is_system boolean NOT NULL DEFAULT false
    );
    CREATE TABLE public.permissions (
      id uuid PRIMARY KEY,
      key text NOT NULL UNIQUE
    );
    CREATE TABLE public.membership_roles (
      membership_id uuid NOT NULL REFERENCES public.organization_memberships(id),
      role_id uuid NOT NULL REFERENCES public.roles(id),
      PRIMARY KEY (membership_id, role_id)
    );
    CREATE TABLE public.role_permissions (
      role_id uuid NOT NULL REFERENCES public.roles(id),
      permission_id uuid NOT NULL REFERENCES public.permissions(id),
      PRIMARY KEY (role_id, permission_id)
    );
    CREATE TABLE public.platform_super_admins (
      user_id uuid PRIMARY KEY,
      status text NOT NULL DEFAULT 'active'
    );

    GRANT ALL ON TABLE public.organizations,
      public.organization_memberships,
      public.membership_roles,
      public.roles,
      public.permissions,
      public.role_permissions,
      public.platform_super_admins
    TO service_role;
  `);
  await db.exec(draft);
  await db.query(
    'INSERT INTO public.organizations(id,name) VALUES ($1,$2),($3,$4)',
    [ids.orgA, 'Fictional A', ids.orgB, 'Fictional B'],
  );
  await db.query(
    `INSERT INTO public.organization_memberships(id,organization_id,user_id,status)
     VALUES ($1,$2,$3,'active'),($4,$5,$6,'active'),($7,$2,$8,'inactive'),($9,$2,$10,'suspended'),($11,$2,$12,'removed')`,
    [ids.memberA, ids.orgA, ids.userA, ids.memberB, ids.orgB, ids.userB, ids.memberInactive, ids.inactiveUser, ids.memberSuspended, ids.suspendedUser, ids.memberRemoved, ids.removedUser],
  );
  await db.query(
    `INSERT INTO public.roles(id,organization_id,name,slug,is_system)
     VALUES ($1,$2,'Owner A','owner-a',false),($3,$4,'Manager B','manager-b',false),($5,NULL,'Global Viewer','global-viewer',true)`,
    [ids.roleA, ids.orgA, ids.roleB, ids.orgB, ids.globalRole],
  );
  await db.query(
    `INSERT INTO public.permissions(id,key)
     VALUES ($1,'properties.view'),($2,'properties.manage'),($3,'customers.*'),($4,'appointments.view')`,
    [ids.permissionView, ids.permissionManage, ids.permissionWildcard, ids.permissionGlobal],
  );
  await db.query(
    `INSERT INTO public.role_permissions(role_id,permission_id)
     VALUES ($1,$2),($1,$3),($4,$5),($6,$7)`,
    [ids.roleA, ids.permissionView, ids.permissionWildcard, ids.roleB, ids.permissionManage, ids.globalRole, ids.permissionGlobal],
  );
  await db.query('INSERT INTO public.platform_super_admins(user_id,status) VALUES ($1,\'active\')', [ids.admin]);
  return db;
}

async function seedMembershipRoles(db, includeCorruptCrossTenantRole = false) {
  await db.query(
    'INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2),($3,$4),($5,$6),($7,$8),($9,$10)',
    [ids.memberA, ids.roleA, ids.memberB, ids.roleB, ids.memberInactive, ids.roleA, ids.memberSuspended, ids.roleA, ids.memberRemoved, ids.roleA],
  );
  await db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.globalRole]);
  if (includeCorruptCrossTenantRole) {
    await db.exec('ALTER TABLE public.membership_roles DISABLE TRIGGER membership_roles_enforce_tenant_scope');
    await db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.roleB]);
    await db.exec('ALTER TABLE public.membership_roles ENABLE TRIGGER membership_roles_enforce_tenant_scope');
  }
}

test('authorization helpers require active membership, preserve platform-admin access, and scope permissions by role organization', async () => {
  const db = await database();
  try {
    await seedMembershipRoles(db, true);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.userA}';`);
    const isMember = async (org) => (await db.query('SELECT public.is_organization_member($1) AS allowed', [org])).rows[0].allowed;
    const hasPermission = async (org, permission) => (await db.query('SELECT public.has_organization_permission($1,$2) AS allowed', [org, permission])).rows[0].allowed;
    assert.equal(await isMember(ids.orgA), true);
    assert.equal(await isMember(ids.orgB), false);
    assert.equal(await hasPermission(ids.orgA, 'properties.view'), true);
    assert.equal(await hasPermission(ids.orgA, 'customers.manage'), true);
    assert.equal(await hasPermission(ids.orgA, 'appointments.view'), true);
    assert.equal(await hasPermission(ids.orgA, 'properties.manage'), false);
    assert.equal(await hasPermission(ids.orgB, 'properties.manage'), false);

    for (const inactiveUser of [ids.inactiveUser, ids.suspendedUser, ids.removedUser]) {
      await db.exec(`SET request.jwt.claim.sub = '${inactiveUser}';`);
      assert.equal(await isMember(ids.orgA), false);
      assert.equal(await hasPermission(ids.orgA, 'properties.view'), false);
    }

    await db.exec(`SET request.jwt.claim.sub = '${ids.admin}';`);
    assert.equal(await isMember(ids.orgA), true);
    assert.equal(await isMember(ids.orgB), true);
    assert.equal(await hasPermission(ids.orgB, 'not.seeded.permission'), true);

    await db.exec("SET request.jwt.claim.sub = '';");
    assert.equal(await isMember(ids.orgA), false);
    assert.equal(await hasPermission(ids.orgA, 'properties.view'), false);
  } finally {
    await db.close();
  }
});

test('membership-role and parent triggers prevent cross-tenant assignment and organization reassignment', async () => {
  const db = await database();
  try {
    await db.exec('SET ROLE service_role;');
    await db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.roleA]);
    await db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.globalRole]);
    await assert.rejects(
      db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.roleB]),
      /cannot receive a role from another organization/,
    );
    await assert.rejects(
      db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, '90000000-0000-4000-8000-000000000001']),
      /Role does not exist/,
    );
    await assert.rejects(
      db.query('UPDATE public.organization_memberships SET organization_id=$1 WHERE id=$2', [ids.orgB, ids.memberA]),
      /Membership organization_id is immutable/,
    );
    await assert.rejects(
      db.query('UPDATE public.roles SET organization_id=$1 WHERE id=$2', [ids.orgB, ids.roleA]),
      /Role organization_id is immutable/,
    );
    await assert.rejects(
      db.query('UPDATE public.organization_memberships SET organization_id=$1 WHERE id=$2', [ids.orgA, ids.memberB]),
      /Membership organization_id is immutable/,
    );
    await assert.rejects(
      db.query('UPDATE public.roles SET organization_id=$1 WHERE id=$2', [ids.orgA, ids.roleB]),
      /Role organization_id is immutable/,
    );
    const mappings = await db.query('SELECT membership_id,role_id FROM public.membership_roles ORDER BY role_id');
    assert.equal(mappings.rows.length, 2);
    assert.deepEqual(mappings.rows.map((row) => row.role_id).sort(), [ids.roleA, ids.globalRole].sort());
  } finally {
    await db.close();
  }
});

test('authorization RLS limits tenant and authorization metadata to active users while preserving platform-admin visibility', async () => {
  const db = await database();
  try {
    await seedMembershipRoles(db, true);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.userA}';`);
    const organizations = await db.query('SELECT id FROM public.organizations ORDER BY id');
    assert.deepEqual(organizations.rows.map((row) => row.id), [ids.orgA]);
    const memberships = await db.query('SELECT id FROM public.organization_memberships ORDER BY id');
    assert.deepEqual(memberships.rows.map((row) => row.id), [ids.memberA]);
    const roles = await db.query('SELECT id FROM public.roles ORDER BY id');
    assert.deepEqual(roles.rows.map((row) => row.id).sort(), [ids.roleA, ids.globalRole].sort());
    const roleMappings = await db.query('SELECT role_id FROM public.membership_roles ORDER BY role_id');
    assert.deepEqual(roleMappings.rows.map((row) => row.role_id).sort(), [ids.roleA, ids.globalRole].sort());
    const rolePermissions = await db.query('SELECT role_id FROM public.role_permissions ORDER BY role_id');
    assert.deepEqual([...new Set(rolePermissions.rows.map((row) => row.role_id))].sort(), [ids.roleA, ids.globalRole].sort());
    await assert.rejects(
      db.query('INSERT INTO public.organization_memberships(id,organization_id,user_id,status) VALUES ($1,$2,$3,$4)', [
        '90000000-0000-4000-8000-000000000002', ids.orgA, ids.userA, 'active',
      ]),
      /permission denied/,
    );

    for (const [user, membership] of [
      [ids.inactiveUser, ids.memberInactive],
      [ids.suspendedUser, ids.memberSuspended],
      [ids.removedUser, ids.memberRemoved],
    ]) {
      await db.exec(`SET request.jwt.claim.sub = '${user}';`);
      assert.deepEqual((await db.query('SELECT id FROM public.organization_memberships')).rows, []);
      assert.deepEqual((await db.query('SELECT membership_id FROM public.membership_roles WHERE membership_id=$1', [membership])).rows, []);
    }

    await db.exec(`SET request.jwt.claim.sub = '${ids.admin}';`);
    const adminOrganizations = await db.query('SELECT id FROM public.organizations ORDER BY id');
    assert.deepEqual(adminOrganizations.rows.map((row) => row.id).sort(), [ids.orgA, ids.orgB].sort());
    const adminMemberships = await db.query('SELECT id FROM public.organization_memberships ORDER BY id');
    assert.equal(adminMemberships.rows.length, 5);
    const adminRoles = await db.query('SELECT id FROM public.roles ORDER BY id');
    assert.deepEqual(adminRoles.rows.map((row) => row.id).sort(), [ids.roleA, ids.roleB, ids.globalRole].sort());
    const adminRoleMappings = await db.query('SELECT membership_id,role_id FROM public.membership_roles ORDER BY role_id,membership_id');
    assert.equal(adminRoleMappings.rows.length, 6);
    const adminRolePermissions = await db.query('SELECT DISTINCT role_id FROM public.role_permissions ORDER BY role_id');
    assert.deepEqual(adminRolePermissions.rows.map((row) => row.role_id).sort(), [ids.roleA, ids.roleB, ids.globalRole].sort());
    await assert.rejects(db.query('SELECT user_id FROM public.platform_super_admins'), /permission denied/);
  } finally {
    await db.close();
  }
});

test('anonymous and browser roles cannot write auth tables or inspect the platform-admin registry', async () => {
  const db = await database();
  try {
    await db.exec('SET ROLE anon;');
    await assert.rejects(db.query('SELECT public.is_organization_member($1)', [ids.orgA]), /permission denied/);
    await assert.rejects(db.query('SELECT id FROM public.organizations'), /permission denied/);

    await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.userA}';`);
    await assert.rejects(db.query('SELECT user_id FROM public.platform_super_admins'), /permission denied/);
    await assert.rejects(db.query('INSERT INTO public.membership_roles(membership_id,role_id) VALUES ($1,$2)', [ids.memberA, ids.roleA]), /permission denied/);
    const helper = await db.query('SELECT public.is_platform_super_admin() AS is_admin');
    assert.equal(helper.rows[0].is_admin, false);

    const functions = await db.query(`
      SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname = ANY($1::text[])
      ORDER BY p.proname`,
    [[
      'is_platform_super_admin',
      'is_organization_member',
      'has_organization_permission',
      'enforce_membership_role_tenant_scope',
      'prevent_membership_organization_change',
      'prevent_role_organization_change',
    ]]);
    assert.equal(functions.rows.length, 6);
    for (const fn of functions.rows) {
      assert.equal(fn.owner, 'postgres');
      assert.equal(fn.prosecdef, true);
      assert.ok(fn.proconfig.includes('search_path=pg_catalog'));
    }

    const tables = await db.query(`
      SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname`,
    [[
      'organizations',
      'organization_memberships',
      'membership_roles',
      'roles',
      'permissions',
      'role_permissions',
      'platform_super_admins',
    ]]);
    assert.equal(tables.rows.length, 7);
    for (const table of tables.rows) {
      assert.equal(table.owner, 'postgres');
      assert.equal(table.relrowsecurity, true);
    }
    assert.match(draft, /FOR SHARE/);
    assert.match(draft, /memberships_organization_immutable/);
    assert.match(draft, /roles_organization_immutable/);

    const authTables = new Set([
      'organizations',
      'organization_memberships',
      'membership_roles',
      'roles',
      'permissions',
      'role_permissions',
      'platform_super_admins',
    ]);
    const observedPolicies = [...baselinePreview.matchAll(/-- CREATE POLICY\s+(\w+)\s+ON\s+public\.(\w+)/g)]
      .filter(([, , table]) => authTables.has(table))
      .map(([, policy]) => policy)
      .sort();
    const droppedPolicies = [...draft.matchAll(/DROP POLICY IF EXISTS\s+(\w+)\s+ON\s+public\.(\w+)\s*;/g)]
      .filter(([, , table]) => authTables.has(table))
      .map(([, policy]) => policy)
      .sort();
    assert.deepEqual(droppedPolicies, observedPolicies);
  } finally {
    await db.close();
  }
});
