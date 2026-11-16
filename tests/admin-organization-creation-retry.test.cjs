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
      create table organization_templates(id uuid default gen_random_uuid(),slug text,name text,industry text,status text,workflows jsonb);
      create table organization_template_assignments(id uuid primary key default gen_random_uuid(),organization_id uuid,metadata jsonb);
      create table workflow_registry(id uuid primary key default gen_random_uuid(), organization_id text,project_id text,organization_uuid uuid,branch_id uuid,agent_family_id uuid,project_uuid uuid,workflow_key text,name text,description text,provider text,trigger_type text,environment text,status text,current_version integer,timeout_seconds integer,max_retries integer,metadata jsonb,unique(organization_id,workflow_key));
      insert into organization_templates(slug,name,industry,status,workflows) values('hotel','Hotel','Hotel','active','["intake","handoff"]'),('photography','Photography','Photography','active','["intake","handoff"]'),('real-estate','Real Estate','Real Estate','active','["intake","handoff"]');
      create function public.create_and_provision_organization(text,text,text,text,text,text,uuid) returns jsonb language plpgsql as $$
      declare v_id uuid; v_project uuid:=gen_random_uuid(); v_assignment uuid; v_count integer; begin insert into organizations(metadata) values(jsonb_build_object('industry',$3)) returning id into v_id;
      insert into organization_template_assignments(organization_id,metadata) values(v_id,'{}') returning id into v_assignment;
      -- Reproduce the production RPC's shared template namespace and silent conflict.
      insert into workflow_registry(organization_id,organization_uuid,project_uuid,workflow_key,status)
        select $2,v_id,v_project,value,'draft' from organization_templates,lateral jsonb_array_elements_text(workflows) where slug=$2 on conflict do nothing;
      get diagnostics v_count=row_count;
      return jsonb_build_object('organization_id',v_id,'template_slug',$2,'provisioning',jsonb_build_object('project_id',v_project,'assignment_id',v_assignment,'branch_id',gen_random_uuid(),'agent_family_id',gen_random_uuid(),'workflows_created',v_count));end;$$;`);
    await db.exec(migration);
    for (const [template,industry,index] of [['hotel','Hotel',1],['photography','Photography',2],['real-estate','Real Estate',3]]) {
      const params=['Example',template,industry,'owner@example.test','Nigeria','Africa/Lagos',null,`10000000-0000-4000-8000-00000000000${index}`];
      const sql='select public.create_and_provision_organization($1,$2,$3,$4,$5,$6,$7::uuid,$8::uuid) as result';
      const first=await db.query(sql,params), second=await db.query(sql,params);
      assert.deepEqual(first.rows,second.rows);
      // Another tenant using the same industry template must receive its own rows.
      const another=[...params];another[7]=`30000000-0000-4000-8000-00000000000${index}`;
      const next=await db.query(sql,another);
      const nextId=next.rows[0].result.organization_id;
      const tenantWorkflows=await db.query('select organization_id,status,workflow_key from workflow_registry where organization_uuid=$1::uuid',[nextId]);
      assert.equal(tenantWorkflows.rows.length,2);
      assert.ok(tenantWorkflows.rows.every(row=>row.organization_id===nextId&&row.status==='draft'));
      assert.equal(next.rows[0].result.provisioning.workflows_created,2);
      const unchanged=await db.query('select count(*)::int as count from workflow_registry where organization_uuid=$1::uuid',[first.rows[0].result.organization_id]);
      assert.equal(unchanged.rows[0].count,2);
      const mismatch=[...params];mismatch[0]='Changed';
      await assert.rejects(db.query(sql,mismatch),/parameters changed/);
      const bad=[...params];bad[7]='20000000-0000-4000-8000-000000000001';bad[2]='Other';
      await assert.rejects(db.query(sql,bad),/Industry must match/);
    }
    assert.equal((await db.query('select count(*)::int as count from organizations')).rows[0].count,6);
    const privileges=await db.query(`select has_function_privilege('anon','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') as anon, has_function_privilege('authenticated','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') as authenticated, has_function_privilege('service_role','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') as service`);
    assert.deepEqual(privileges.rows[0],{anon:false,authenticated:false,service:true});
  } finally { await db.close(); }
});
