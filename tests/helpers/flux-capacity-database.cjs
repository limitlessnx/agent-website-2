/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const original=fs.readFileSync('supabase/migrations/20260908114328_fluxknight_subscription_credits.sql','utf8');
const policy=fs.readFileSync('supabase/migrations/20260908114430_flux_credit_policy_hardening.sql','utf8');
const start=policy.indexOf('create or replace function public.record_flux_credit_usage(');
const debit=policy.slice(start,policy.indexOf('$$;',start)+3);
const migration=fs.readdirSync('supabase/migrations').find(p=>p.endsWith('_flux_credit_capacity.sql'));
const capacitySQL=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const schemaSQL=String.raw`
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;
end$$;
create table public.organizations(id uuid primary key);
`+original.slice(0,original.indexOf('create or replace function'))+debit+String.raw`
revoke all on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) to service_role;
grant usage on schema public to service_role;
grant select,update on public.flux_credit_wallets to service_role;
grant select,insert on public.flux_credit_ledger to service_role;
insert into organizations values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into flux_credit_wallets(organization_id,plan_code,monthly_allowance,balance,current_period_start,current_period_end)
 select id,'business',12000,4,'2026-11-01T00:00:00Z','2099-01-01T00:00:00Z' from organizations;
`;
async function fixture(t){const db=new PGlite();t.after(()=>db.close());await db.exec(schemaSQL);await db.exec(capacitySQL);return db;}
async function reserve(db,{organization=org,key='execution',fingerprint='a'.repeat(64),credits=2,action='web_ai',source='phase12_provider_runtime'}={}){
 return (await db.query('select public.reserve_flux_credit_capacity($1,$2,$3,$4,$5,$6) as result',[organization,key,fingerprint,action,credits,source])).rows[0].result;
}
async function finish(db,r,outcome='settled',{organization=org,...metadata}={}){
 return (await db.query('select public.finish_flux_credit_capacity($1,$2,$3,$4,$5,$6,$7,$8) as result',[organization,r.id,outcome,'synthetic','synthetic',1,{},metadata])).rows[0].result;
}
async function available(db,organization=org){return (await db.query('select public.get_flux_credit_availability($1) as result',[organization])).rows[0].result;}
async function count(db){return Number((await db.query('select count(*) as n from flux_credit_ledger')).rows[0].n);}
module.exports={org,other,fixture,reserve,finish,available,count,schemaSQL,capacitySQL};
