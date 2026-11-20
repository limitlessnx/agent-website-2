/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const schema=fs.readFileSync('tests/fixtures/tenant-starter-repair/schema.sql','utf8');
const provisioner=fs.readFileSync('supabase/migrations/20260726104702_organization_provisioning_engine.sql','utf8');
// Rewrite the reviewed operator script to wholly synthetic identities. No live DB.
const replacements={'55fd36ae-1e16-4cf1-a8ba-dd694a67f876':'10000000-0000-4000-8000-000000000001','4af9cafa-67f0-4520-b8ce-4c4beb1831e1':'20000000-0000-4000-8000-000000000001','03db0791-47cf-48e5-be28-555614a45de8':'30000000-0000-4000-8000-000000000001','ab4f08cf-92fd-4965-bddb-4b54b7284230':'30000000-0000-4000-8000-000000000002'};
let repair=fs.readFileSync('docs/operations/xposure-photography-starter-repair.sql','utf8');for(const [a,b] of Object.entries(replacements))repair=repair.replaceAll(a,b);
const org=replacements['55fd36ae-1e16-4cf1-a8ba-dd694a67f876'],foreign='10000000-0000-4000-8000-000000000002',old=replacements['03db0791-47cf-48e5-be28-555614a45de8'],next=replacements['ab4f08cf-92fd-4965-bddb-4b54b7284230'];
async function fixture(t){const db=new PGlite();t.after(()=>db.close());await db.exec('create role anon;create role authenticated;create role service_role;');await db.exec(schema);await db.exec(provisioner);await db.exec(`
insert into organizations(id,name,slug,manager_access_code) values('${org}','Xposure','xposure','synthetic-code'),('${foreign}','Other studio','other-studio','other-synthetic-code');
insert into client_onboarding_profiles(organization_id,user_id,industry,status) values('${org}',gen_random_uuid(),'photography-studio','configuration');
insert into organization_templates(id,name,slug,industry,agents,workflows,knowledge_structure,integration_requirements) values
 ('${old}','Computer Suite','computer-service-ai-suite','Computer Sales and Repair','["crm_automation"]','["repair_intake"]','[]','[]'),
 ('${next}','Photography Suite','photography-ai-suite','Photography Studio','["studio_concierge","booking_assistant"]','["studio_enquiry","booking_intake","capacity_review","customer_handoff"]','["Business profile","Service packages"]','["whatsapp","email","google_calendar"]');
insert into organization_template_assignments(id,organization_id,template_id,status) values('${replacements['4af9cafa-67f0-4520-b8ce-4c4beb1831e1']}','${org}','${old}','active');
insert into agent_families(id,organization_id,name,slug) values('40000000-0000-4000-8000-000000000001','${org}','Existing workforce','existing');
insert into projects(id,organization_id,agent_family_id,name,slug) values('50000000-0000-4000-8000-000000000001','${org}','40000000-0000-4000-8000-000000000001','Existing project','existing');
insert into agents(organization_id,agent_family_id,project_id,name,slug,status,system_prompt,configuration) values('${org}','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Maia','maia-xposure','published','Approved business instructions','{"owned":true}');
insert into organization_integrations(organization_id,provider,display_name,status,configuration) values('${org}','whatsapp','Existing WhatsApp','connected','{"owned":true}');
insert into knowledge_collections(organization_id,name,slug,metadata) values('${org}','Approved services','service-packages','{"owned":true}');
insert into flux_credit_wallets(organization_id,plan_code,balance,monthly_allowance) values('${org}','plus',5000,5000);
insert into organization_subscriptions(organization_id,plan_id,provider,status,current_period_end) values('${org}',gen_random_uuid(),'manual','active',now()+interval '15 days');
-- Another tenant already owns all four legacy shared-template workflow keys.
insert into workflow_registry(organization_id,organization_uuid,project_id,workflow_key,name,status) select 'photography-ai-suite','${foreign}','existing',value,value,'active' from jsonb_array_elements_text('["studio_enquiry","booking_intake","capacity_review","customer_handoff"]');
`);return db;}
async function rows(db,sql){return (await db.query(sql)).rows;}
test('Photography repair reuses real provisioner, retains live configuration, fills own workflow namespace and is replay-safe',async t=>{
 const db=await fixture(t),before=await rows(db,'select * from workflow_registry order by id');
 await db.exec(repair);const assignments=await rows(db,'select * from organization_template_assignments order by template_id');assert.equal(assignments[0].status,'paused');assert.equal(assignments[0].metadata.superseded_by_assignment_id,assignments[1].id);assert.equal(assignments[1].status,'active');
 const agents=await rows(db,`select * from agents where organization_id='${org}' order by slug`);assert.equal(agents.length,3);const maia=agents.find(x=>x.slug==='maia-xposure');assert.equal(maia.status,'published');assert.equal(maia.system_prompt,'Approved business instructions');assert.deepEqual(maia.configuration,{owned:true});assert.equal(agents.filter(x=>x.status==='draft').length,2);
 const workflows=await rows(db,`select * from workflow_registry where organization_uuid='${org}'`);assert.equal(workflows.length,4);assert.ok(workflows.every(x=>x.organization_id===org&&x.status==='draft'));assert.deepEqual(await rows(db,`select * from workflow_registry where organization_uuid='${foreign}' order by id`),before);
 assert.equal((await rows(db,`select status from organization_integrations where organization_id='${org}' and provider='whatsapp'`))[0].status,'connected');assert.equal((await rows(db,`select count(*)::int n from organization_integrations where organization_id='${org}' and status='disconnected'`))[0].n,2);assert.equal((await rows(db,`select metadata from knowledge_collections where organization_id='${org}' and slug='service-packages'`))[0].metadata.owned,true);
 assert.equal((await rows(db,`select balance from flux_credit_wallets where organization_id='${org}'`))[0].balance,5000);
 const audit=await rows(db,"select * from audit_logs where action='organization.industry_starter_repaired'");assert.equal(audit.length,1);assert.equal(audit[0].metadata.existing_configuration_preserved,true);
 await db.exec(repair);assert.equal((await rows(db,'select count(*)::int n from agents'))[0].n,3);assert.equal((await rows(db,"select count(*)::int n from audit_logs where action='organization.industry_starter_repaired'"))[0].n,1);
});
test('failed final audit rolls back drafts, assignment retirement and registry completion',async t=>{
 const db=await fixture(t);await db.exec("alter table audit_logs add constraint audit_failure check(action<>'organization.industry_starter_repaired')");await assert.rejects(db.exec(repair),/audit_failure/);assert.equal((await rows(db,'select count(*)::int n from agents'))[0].n,1);assert.equal((await rows(db,'select status from organization_template_assignments'))[0].status,'active');assert.equal((await rows(db,'select count(*)::int n from workflow_registry'))[0].n,4);
});
test('changed tenant industry fails before any provisioning',async t=>{
 const db=await fixture(t);await db.exec("update client_onboarding_profiles set industry='Hotels'");await assert.rejects(db.exec(repair),/profile changed/);assert.equal((await rows(db,'select count(*)::int n from agents'))[0].n,1);
});
test('a conflicting tenant workflow key fails closed without overwriting any project',async t=>{
 const db=await fixture(t);await db.exec(`insert into workflow_registry(organization_id,organization_uuid,project_id,workflow_key,name,status) values('${org}','${org}','customer-project','capacity_review','Custom capacity workflow','active')`);await assert.rejects(db.exec(repair),/registry incomplete/);assert.equal((await rows(db,'select status from organization_template_assignments'))[0].status,'active');assert.equal((await rows(db,`select status from workflow_registry where organization_uuid='${org}'`))[0].status,'active');
});
test('unexpected activation rolls back rather than publishing starter agents',async t=>{
 const db=await fixture(t);await db.exec(`create function accidental_activation() returns trigger language plpgsql as $$begin new.status='published';return new;end$$;create trigger activation before insert on agents for each row execute function accidental_activation();`);await assert.rejects(db.exec(repair),/unexpectedly activated/);assert.equal((await rows(db,'select count(*)::int n from agents'))[0].n,1);
});

test('unclaimed legacy keys are normalized only for newly inserted tenant drafts',async t=>{
 const db=await fixture(t);await db.exec(`delete from workflow_registry where organization_uuid='${foreign}'`);await db.exec(repair);
 const workflows=await rows(db,`select organization_id,status from workflow_registry where organization_uuid='${org}'`);assert.equal(workflows.length,4);assert.ok(workflows.every(x=>x.organization_id===org&&x.status==='draft'));
});
