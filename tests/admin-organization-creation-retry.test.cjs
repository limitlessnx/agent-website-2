/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/20261116104101_admin_organization_creation_retry_safe.sql','utf8');
test('creation request replay returns the same tenant, rejects changed input, and restricts execution', async()=>{
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table organizations(id uuid primary key default gen_random_uuid(),metadata jsonb);
      create table organization_templates(slug text,industry text,status text);
      insert into organization_templates values('hotel','Hotel','active'),('photography','Photography','active'),('real-estate','Real Estate','active');
      create function public.create_and_provision_organization(text,text,text,text,text,text,uuid) returns jsonb language plpgsql as $$
      declare v_id uuid; begin insert into organizations(metadata) values(jsonb_build_object('industry',$3)) returning id into v_id;
      return jsonb_build_object('organization_id',v_id,'template_slug',$2,'provisioning',jsonb_build_object('project_id',gen_random_uuid()));end;$$;`);
    await db.exec(migration);
    for (const [template,industry,index] of [['hotel','Hotel',1],['photography','Photography',2],['real-estate','Real Estate',3]]) {
      const params=['Example',template,industry,'owner@example.test','Nigeria','Africa/Lagos',null,`10000000-0000-4000-8000-00000000000${index}`];
      const sql='select public.create_and_provision_organization($1,$2,$3,$4,$5,$6,$7::uuid,$8::uuid) as result';
      const first=await db.query(sql,params), second=await db.query(sql,params);
      assert.deepEqual(first.rows,second.rows);
      const mismatch=[...params];mismatch[0]='Changed';
      await assert.rejects(db.query(sql,mismatch),/parameters changed/);
      const bad=[...params];bad[7]='20000000-0000-4000-8000-000000000001';bad[2]='Other';
      await assert.rejects(db.query(sql,bad),/Industry must match/);
    }
    assert.equal((await db.query('select count(*)::int as count from organizations')).rows[0].count,3);
    const privileges=await db.query(`select has_function_privilege('anon','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') as anon, has_function_privilege('authenticated','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') as authenticated, has_function_privilege('service_role','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') as service`);
    assert.deepEqual(privileges.rows[0],{anon:false,authenticated:false,service:true});
  } finally { await db.close(); }
});
