const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const USER_A = '10000000-0000-4000-8000-000000000001';
const USER_B = '10000000-0000-4000-8000-000000000002';
const TEMPLATE = '20000000-0000-4000-8000-000000000001';
const retryMigration = fs.readFileSync('supabase/migrations/20261024141200_client_provisioning_retry_safe.sql', 'utf8');
const aclMigration = fs.readFileSync('supabase/migrations/20261024140349_workspace_provisioning_acl.sql', 'utf8');

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${USER_A}'), ('${USER_B}');

    CREATE TABLE public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
      status text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
      name text NOT NULL, slug text NOT NULL, status text NOT NULL, UNIQUE (organization_id, slug)
    );
    CREATE TABLE public.roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
      name text NOT NULL, slug text NOT NULL, description text, is_system boolean NOT NULL
    );
    CREATE TABLE public.organization_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, branch_id uuid NOT NULL,
      user_id uuid NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, user_id)
    );
    CREATE TABLE public.membership_roles (membership_id uuid NOT NULL, role_id uuid NOT NULL, PRIMARY KEY (membership_id, role_id));
    CREATE TABLE public.permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), permission_key text UNIQUE);
    CREATE TABLE public.role_permissions (role_id uuid NOT NULL, permission_id uuid NOT NULL, PRIMARY KEY (role_id, permission_id));
    CREATE TABLE public.agent_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, status text NOT NULL);
    INSERT INTO public.agent_templates(id, slug, status) VALUES ('${TEMPLATE}', 'real-estate-starter', 'published');
    CREATE TABLE public.agent_families (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, template_id uuid NOT NULL,
      branch_id uuid NOT NULL, name text NOT NULL, slug text NOT NULL, description text, status text NOT NULL,
      UNIQUE (organization_id, slug)
    );
    CREATE TABLE public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, agent_family_id uuid NOT NULL,
      branch_id uuid NOT NULL, name text NOT NULL, slug text NOT NULL, description text, status text NOT NULL,
      UNIQUE (organization_id, slug)
    );
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, branch_id uuid NOT NULL,
      actor_user_id uuid NOT NULL, action text NOT NULL, resource_type text NOT NULL,
      resource_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.flux_credit_wallets (
      organization_id uuid PRIMARY KEY, plan_code text NOT NULL, monthly_allowance integer NOT NULL,
      balance integer NOT NULL, status text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE public.client_onboarding_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL UNIQUE,
      membership_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL, current_step integer NOT NULL,
      business_name text NOT NULL, industry text NOT NULL, business_email text,
      channels jsonb NOT NULL, whatsapp_preferences jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION public.slugify_identifier(value text) RETURNS text
      LANGUAGE sql IMMUTABLE AS $$ SELECT trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')) $$;

    CREATE FUNCTION public.provision_client_workspace(
      p_user_id uuid, p_organization_name text, p_organization_slug text DEFAULT NULL,
      p_industry_slug text DEFAULT NULL, p_business_email text DEFAULT NULL
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
    DECLARE v_provisioned jsonb; v_org_id uuid; v_membership_id uuid;
    BEGIN
      IF nullif(trim(p_industry_slug), '') IS NULL THEN RAISE EXCEPTION 'industry_slug is required'; END IF;
      v_provisioned := public.provision_client_organization(p_user_id, p_organization_name, p_organization_slug, null, null);
      v_org_id := (v_provisioned ->> 'organization_id')::uuid;
      v_membership_id := (v_provisioned ->> 'membership_id')::uuid;
      UPDATE public.organizations SET metadata = coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object('industry_slug', trim(p_industry_slug), 'workspace_mode', 'free', 'onboarding_stage', 'workspace_created'),
        updated_at = now() WHERE id = v_org_id;
      INSERT INTO public.flux_credit_wallets(organization_id, plan_code, monthly_allowance, balance, status, metadata)
        VALUES(v_org_id, 'basic', 0, 0, 'paused', jsonb_build_object('workspace_mode','free','trial_available',true))
        ON CONFLICT(organization_id) DO NOTHING;
      INSERT INTO public.client_onboarding_profiles(organization_id,membership_id,user_id,status,current_step,business_name,industry,business_email,channels,whatsapp_preferences)
        VALUES(v_org_id,v_membership_id,p_user_id,'in_progress',1,trim(p_organization_name),trim(p_industry_slug),nullif(trim(p_business_email),''),'["WhatsApp"]'::jsonb,'{"connection_path":"need_help"}'::jsonb)
        ON CONFLICT(organization_id) DO UPDATE SET industry=excluded.industry,business_name=excluded.business_name,business_email=excluded.business_email,updated_at=now();
      RETURN v_provisioned || jsonb_build_object('industry_slug',trim(p_industry_slug),'workspace_mode','free','trial_started',false);
    END; $$;
    CREATE FUNCTION public.provision_trial_client_organization(p_user_id uuid,p_organization_name text,p_organization_slug text DEFAULT NULL,p_template_slug text DEFAULT NULL,p_agent_family_name text DEFAULT NULL)
      RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','auth' AS $$ SELECT '{}'::jsonb $$;
    GRANT EXECUTE ON FUNCTION public.provision_client_workspace(uuid,text,text,text,text) TO PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.provision_trial_client_organization(uuid,text,text,text,text) TO PUBLIC, anon, authenticated;
  `);
  await db.exec(retryMigration);
  await db.exec(aclMigration);
  return db;
}

async function provision(db, userId, organizationName, slug, industry = 'real-estate', email = 'owner@example.test') {
  const result = await db.query(
    'SELECT public.provision_client_workspace($1,$2,$3,$4,$5) AS result',
    [userId, organizationName, slug, industry, email],
  );
  return result.rows[0].result;
}

async function count(db, table) {
  return Number((await db.query(`SELECT count(*)::int AS value FROM public.${table} LIMIT 1`)).rows[0].value);
}

test('workspace provisioning retries return the same tenant and upsert one wallet/profile', async () => {
  const db = await database();
  try {
    const input = [USER_A, 'Haven Homes', 'haven-homes', 'real-estate', 'owner@haven.test'];
    const first = await provision(db, ...input);
    const retry = await provision(db, ...input);
    assert.deepEqual(retry, first);
    assert.equal(first.industry_slug, 'real-estate');
    assert.equal(await count(db, 'organizations'), 1);
    assert.equal(await count(db, 'branches'), 1);
    assert.equal(await count(db, 'organization_memberships'), 1);
    assert.equal(await count(db, 'roles'), 1);
    assert.equal(await count(db, 'audit_logs'), 1);
    assert.equal(await count(db, 'flux_credit_wallets'), 1);
    assert.equal(await count(db, 'client_onboarding_profiles'), 1);
    const rows = await db.query('SELECT metadata->>\'industry_slug\' AS industry, status FROM public.organizations LIMIT 1');
    assert.equal(rows.rows[0].industry, 'real-estate');
    assert.equal(rows.rows[0].status, 'active');
  } finally { await db.close(); }
});

test('concurrent retries for the same user serialize and return one workspace', async () => {
  const db = await database();
  try {
    const args = [USER_A, 'Haven Homes', 'haven-homes', 'real-estate', 'owner@haven.test'];
    const [a, b] = await Promise.all([provision(db, ...args), provision(db, ...args)]);
    assert.deepEqual(a, b);
    assert.equal(await count(db, 'organizations'), 1);
    assert.equal(await count(db, 'organization_memberships'), 1);
    assert.equal(await count(db, 'audit_logs'), 1);
  } finally { await db.close(); }
});

test('same user cannot silently reuse a workspace for different setup details', async () => {
  const db = await database();
  try {
    await provision(db, USER_A, 'Haven Homes', 'haven-homes');
    await assert.rejects(
      provision(db, USER_A, 'Different Company', 'different-company'),
      /already has an active organization membership/,
    );
    assert.equal(await count(db, 'organizations'), 1);
  } finally { await db.close(); }
});

test('existing provisioned workspaces without the new request fingerprint recover only on an exact legacy match', async () => {
  const db = await database();
  try {
    const first = await db.query(
      'SELECT public.provision_client_organization($1,$2,$3,$4,$5) AS result',
      [USER_A, 'Haven Homes', 'haven-homes', null, null],
    );
    await db.query("UPDATE public.audit_logs SET metadata = metadata - 'provision_request' WHERE action = 'organization.provisioned'");
    const retry = await db.query(
      'SELECT public.provision_client_organization($1,$2,$3,$4,$5) AS result',
      [USER_A, 'Haven Homes', 'haven-homes', null, null],
    );
    assert.deepEqual(retry.rows[0].result, first.rows[0].result);
    await assert.rejects(
      db.query('SELECT public.provision_client_organization($1,$2,$3,$4,$5)', [USER_A, 'Different Company', 'different-company', null, null]),
      /already has an active organization membership/,
    );
    assert.equal(await count(db, 'organizations'), 1);
  } finally { await db.close(); }
});

test('template-backed agent family and project are not duplicated on a retry', async () => {
  const db = await database();
  try {
    const args = [USER_A, 'Haven Homes', 'haven-homes', 'real-estate-starter', 'Haven Maia'];
    const first = await db.query('SELECT public.provision_client_organization($1,$2,$3,$4,$5) AS result', args);
    const retry = await db.query('SELECT public.provision_client_organization($1,$2,$3,$4,$5) AS result', args);
    assert.deepEqual(retry.rows[0].result, first.rows[0].result);
    assert.equal(await count(db, 'agent_families'), 1);
    assert.equal(await count(db, 'projects'), 1);
  } finally { await db.close(); }
});

test('different tenants requesting the same slug are serialized into unique organization slugs', async () => {
  const db = await database();
  try {
    const [a, b] = await Promise.all([
      provision(db, USER_A, 'Haven Homes', 'shared-brand'),
      provision(db, USER_B, 'Haven Homes', 'shared-brand'),
    ]);
    assert.notEqual(a.organization_id, b.organization_id);
    assert.notEqual(a.organization_slug, b.organization_slug);
    assert.ok([a.organization_slug, b.organization_slug].includes('shared-brand'));
    assert.equal(await count(db, 'organizations'), 2);
    assert.equal(await count(db, 'organization_memberships'), 2);
  } finally { await db.close(); }
});
