/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const load=require('./load-typescript.cjs');
const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_runtime_communication_outcome_recovery.sql'));
const schemaSQL=fs.readFileSync('tests/fixtures/communication-outcome/schema.sql','utf8');
const capacitySQL=fs.readFileSync('supabase/migrations/20261119082208_flux_credit_capacity.sql','utf8');
const outcomeSQL=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',agent='20000000-0000-4000-8000-000000000001',foreignAgent='20000000-0000-4000-8000-000000000002',execution='30000000-0000-4000-8000-000000000001',foreignExecution='30000000-0000-4000-8000-000000000002';
const plans=load('lib/fluxknight-plans.ts');
const {normalizeCommunicationOutcome}=load('lib/runtime/communication-outcome.ts',{'@/lib/flux-credits':{},'@/lib/fluxknight-plans':plans,'@/lib/supabase/admin':{}});
const rolesSQL=`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;`;
const seedSQL=`
insert into organizations(id,name,slug,manager_access_code) values('${org}','Synthetic studio','synthetic-studio','synthetic-one'),('${other}','Other synthetic studio','other-studio','synthetic-two');
insert into agent_families(id,organization_id,name,slug) select ('40000000-0000-4000-8000-00000000000'||n)::uuid,o,'Synthetic workforce','workforce' from (values(1,'${org}'::uuid),(2,'${other}'::uuid)) v(n,o);
insert into projects(id,organization_id,agent_family_id,name,slug) select ('50000000-0000-4000-8000-00000000000'||n)::uuid,o,('40000000-0000-4000-8000-00000000000'||n)::uuid,'Synthetic project','project' from (values(1,'${org}'::uuid),(2,'${other}'::uuid)) v(n,o);
insert into agents(id,organization_id,agent_family_id,project_id,name,slug,status) select ('20000000-0000-4000-8000-00000000000'||n)::uuid,o,('40000000-0000-4000-8000-00000000000'||n)::uuid,('50000000-0000-4000-8000-00000000000'||n)::uuid,'Synthetic agent','agent','published' from (values(1,'${org}'::uuid),(2,'${other}'::uuid)) v(n,o);
insert into runtime_executions(id,organization_id,agent_id,status) values('${execution}','${org}','${agent}','running'),('${foreignExecution}','${other}','${foreignAgent}','running');
insert into flux_credit_wallets(organization_id,plan_code,monthly_allowance,balance,current_period_start,current_period_end) select id,'business_plus',25000,100,'2026-11-01T00:00:00Z','2999-01-01T00:00:00Z' from organizations;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
`;
async function fixture(t){const db=new PGlite();t.after(()=>db.close());await db.exec(rolesSQL);await db.exec(schemaSQL);await db.exec(capacitySQL);await db.exec(outcomeSQL);await db.exec(seedSQL);return db;}
function input(kind='email',changes={}){return {organization_id:org,agent_id:agent,execution_id:execution,idempotency_key:'synthetic-operation',customer_key:'synthetic-contact',event_type:kind==='email'?'campaign.next':'voice.call_ended',input:{email:'synthetic@example.test',full_name:'Synthetic Contact',transcript:'Synthetic voice transcript',duration_seconds:61,call_id:'synthetic-call'},decision:kind==='email'?{action:'send',subject:'Synthetic subject',message:'Synthetic message',lead_stage:'nurturing'}:{action:'reply',call_status:'completed',summary:'Synthetic outcome',reply_text:'Synthetic reply',lead_stage:'contacted'},provider_usage:{total_tokens:7},...changes};}
function normalized(kind='email',changes={}){const workflow=kind==='email'?'outbound_email_crm_v5':'voice_receptionist_v6';const n=normalizeCommunicationOutcome(workflow,input(kind,changes));return {workflow,body:n.body,billing:{...n.billing,plan_code:'business_plus'}};}
async function persist(db,kind='email',changes={}){const n=normalized(kind,changes);return (await db.query('select public.persist_runtime_communication_outcome($1,$2,$3,$4,$5,$6) as result',[n.body.organization_id,n.body.agent_id,n.body.execution_id,n.workflow,n.body,n.billing])).rows[0].result;}
module.exports={fixture,persist,input,normalized,org,other,agent,foreignAgent,execution,foreignExecution,schemaSQL,capacitySQL,outcomeSQL,seedSQL,rolesSQL};
