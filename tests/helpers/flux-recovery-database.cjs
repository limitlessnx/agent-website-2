/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const capacity=require('./flux-capacity-database.cjs');
const execution='30000000-0000-4000-8000-000000000001';
const migration=fs.readdirSync('supabase/migrations').find(p=>p.endsWith('_flux_credit_reconciliation.sql'));
const recoverySQL=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const extraSQL=`
alter table public.organizations add column status text not null default 'active';
create table public.runtime_model_requests(id uuid primary key default gen_random_uuid(),organization_id uuid not null,execution_id uuid not null,status text not null,response_payload jsonb,completed_at timestamptz);
create table public.usage_ledger(id uuid primary key default gen_random_uuid(),organization_id uuid not null,execution_id uuid,usage_type text not null,quantity numeric not null default 0,metadata jsonb not null default '{}',occurred_at timestamptz not null default now());
create table public.runtime_progress_events(id bigserial primary key,organization_id uuid not null,execution_id uuid,event_type text not null,payload jsonb not null default '{}',created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid,actor_user_id uuid,action text not null,resource_type text not null,resource_id text,reason text,metadata jsonb not null default '{}',created_at timestamptz not null default now());
grant select,update on public.organizations to service_role;
grant select,update on public.runtime_model_requests,public.usage_ledger,public.runtime_progress_events to service_role;
grant insert on public.audit_logs to service_role;
`;
async function fixture(t){const db=await capacity.fixture(t);await db.exec(extraSQL);await db.exec(recoverySQL);return db;}
async function reserved(db){return capacity.reserve(db,{key:'phase12-provider:'+execution});}
async function evidence(db,r){
 const proof={provider:'synthetic',credit_reservation_id:r.id,credit_request_fingerprint:r.request_fingerprint,provider_response_id:'synthetic-response'};
 const payload={...proof,id:'synthetic-response',provider:'synthetic',output_text:'Synthetic output',credit_provider_cost_cents:1,credit_usage_quantity:5,usage:{input_tokens:3,output_tokens:2,total_tokens:5}};
 await db.query("insert into runtime_model_requests(organization_id,execution_id,status,response_payload,completed_at) values($1,$2,'succeeded',$3,clock_timestamp())",[capacity.org,execution,payload]);
 await db.query("insert into usage_ledger(organization_id,execution_id,usage_type,quantity,metadata,occurred_at) values($1,$2,'ai_tokens',5,$3,clock_timestamp())",[capacity.org,execution,proof]);
 await db.query("insert into runtime_progress_events(organization_id,execution_id,event_type,payload,created_at) values($1,$2,'provider.completed',$3,clock_timestamp())",[capacity.org,execution,proof]);
}
async function reconcile(db,r,{organization=capacity.org,email='admin@example.test',reason='Reviewed synthetic completed result',actor=null}={}){
 return (await db.query('select public.reconcile_flux_credit_capacity($1,$2,$3,$4,$5) as r',[organization,r.id,email,actor,reason])).rows[0].r;
}
module.exports={...capacity,fixture,reserved,evidence,reconcile,execution,recoverySQL,extraSQL};
