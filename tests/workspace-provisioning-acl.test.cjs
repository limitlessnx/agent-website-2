const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync('supabase/migrations/20261024140349_workspace_provisioning_acl.sql', 'utf8');

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE FUNCTION public.provision_client_workspace(uuid, text, text, text, text)
      RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 'ok'::text $$;
    CREATE FUNCTION public.provision_trial_client_organization(uuid, text, text, text, text)
      RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 'ok'::text $$;
    GRANT EXECUTE ON FUNCTION public.provision_client_workspace(uuid, text, text, text, text) TO PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.provision_trial_client_organization(uuid, text, text, text, text) TO PUBLIC, anon, authenticated;
  `);
  await db.exec(migration);
  return db;
}

test('workspace provisioning RPCs are executable only by the server service role', async () => {
  const db = await database();
  try {
    const acl = (await db.query(`
      SELECT
        has_function_privilege('anon', 'public.provision_client_workspace(uuid,text,text,text,text)', 'EXECUTE') AS anon_workspace,
        has_function_privilege('authenticated', 'public.provision_client_workspace(uuid,text,text,text,text)', 'EXECUTE') AS authenticated_workspace,
        has_function_privilege('service_role', 'public.provision_client_workspace(uuid,text,text,text,text)', 'EXECUTE') AS service_workspace,
        has_function_privilege('anon', 'public.provision_trial_client_organization(uuid,text,text,text,text)', 'EXECUTE') AS anon_trial,
        has_function_privilege('authenticated', 'public.provision_trial_client_organization(uuid,text,text,text,text)', 'EXECUTE') AS authenticated_trial,
        has_function_privilege('service_role', 'public.provision_trial_client_organization(uuid,text,text,text,text)', 'EXECUTE') AS service_trial
      LIMIT 1
    `)).rows[0];
    assert.deepEqual(acl, {
      anon_workspace: false,
      authenticated_workspace: false,
      service_workspace: true,
      anon_trial: false,
      authenticated_trial: false,
      service_trial: true,
    });
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query("SELECT public.provision_client_workspace(gen_random_uuid(),'Tenant','tenant','real-estate',null)"), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await assert.rejects(db.query("SELECT public.provision_trial_client_organization(gen_random_uuid(),'Tenant','tenant',null,null)"), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role');
    assert.equal((await db.query("SELECT public.provision_client_workspace(gen_random_uuid(),'Tenant','tenant','real-estate',null) AS result")).rows[0].result, 'ok');
    await db.exec('RESET ROLE');
  } finally {
    await db.close();
  }
});

test('migration contains only explicit function ACL changes, not data or workspace mutations', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.provision_client_workspace\(uuid, text, text, text, text\)[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.provision_client_workspace\(uuid, text, text, text, text\)[\s\S]*TO service_role/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.provision_trial_client_organization\(uuid, text, text, text, text\)[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.provision_trial_client_organization\(uuid, text, text, text, text\)[\s\S]*TO service_role/i);
  assert.doesNotMatch(migration, /\b(insert|update|delete|drop)\s+(into\s+)?public\./i);
});
