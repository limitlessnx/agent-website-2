import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {foundationSQL,recoverySQL} from '../../scripts/phase6-voice-release-sql.mjs';
export {voiceReleaseSQL} from '../../scripts/phase6-voice-release-sql.mjs';
export const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',agent='20000000-0000-4000-8000-000000000001';
export const migration=readdirSync('supabase/migrations').find(n=>n.endsWith('_elevenlabs_voice_receipt_atomic_recovery.sql'));
export function schemaSQL({voice=true}={}){
 const wallet=readFileSync('supabase/migrations/20260908114328_fluxknight_subscription_credits.sql','utf8');
 const policy=readFileSync('supabase/migrations/20260908114430_flux_credit_policy_hardening.sql','utf8');
 const start=policy.indexOf('create or replace function public.record_flux_credit_usage(');
 const creditFunction=policy.slice(start,policy.indexOf('$$;',start)+3);
 const runtime=readFileSync('supabase/migrations/20260802193405_phase_11_agent_execution.sql','utf8');
 const conversation=runtime.match(/create table if not exists public\.agent_conversations\s*\([\s\S]*?;/)[0];
 const handoff=runtime.match(/create table if not exists public\.handoff_requests\s*\([\s\S]*?;/)[0];
 return `do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;
 create table organizations(id uuid primary key);
 create table agents(id uuid primary key,organization_id uuid not null references organizations(id),configuration jsonb not null default '{}',unique(organization_id,id));
 create table customer_profiles(id uuid primary key,organization_id uuid references organizations(id),unique(organization_id,id));
 create function is_organization_member(uuid) returns boolean language sql stable as $$select false$$;
 ${conversation}\n${handoff}\n${wallet.slice(0,wallet.indexOf('create or replace function'))}
 ${voice?foundationSQL:''}
 ${creditFunction}
 revoke all on function record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) from public,anon,authenticated;
 grant execute on function record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) to service_role;
 grant select,insert,update on all tables in schema public to service_role;
 insert into organizations values('${org}'),('${other}');
 insert into agents values('${agent}','${org}','{"elevenlabs_agent_id":"provider-agent"}'),('20000000-0000-4000-8000-000000000002','${other}','{"elevenlabs_agent_id":"foreign-provider"}');
 insert into flux_credit_wallets(organization_id,plan_code,balance) values('${org}','business_plus',1000),('${other}','business_plus',1000);
 ${voice?'revoke all on elevenlabs_voice_calls,elevenlabs_voice_webhook_events from service_role;'+recoverySQL:''}`;
}
export function parameters(options={}){
 const call=options.call||'call-one',key=options.key||'event-one';
 const payload={event_id:key,type:'post_call_transcription',data:{conversation_id:call,agent_id:'provider-agent',metadata:{organization_id:org}},...options.payload};
 const projection={event_type:'post_call_transcription',direction:'inbound',status:options.transfer?'transfer_failed':'completed',duration_seconds:61,transfer_failed:!!options.transfer,transfer_status:options.transfer?'failed':null,analysis:{},...options.projection};
 return [key,JSON.stringify(payload),options.org||org,options.agent||agent,options.provider||'provider-agent',call,JSON.stringify(projection),options.credits??42,options.plan===undefined?'business_plus':options.plan,0.3];
}
export const applySQL='select apply_elevenlabs_voice_receipt($1,$2::jsonb,$3::uuid,$4::uuid,$5,$6,$7::jsonb,$8::integer,$9,$10::numeric) as result';
export async function insertReceipt(db,args=parameters()){
 await db.query('insert into elevenlabs_voice_webhook_events(event_key,event_type,conversation_id,payload,processing_error) values($1,$2,$3,$4::jsonb,$5)',[args[0],'post_call_transcription',args[5],args[1],'prior synthetic failure']);
}
export async function fixture(t){const db=new PGlite();t.after(()=>db.close());await db.exec(schemaSQL());return db;}
export async function apply(db,args=parameters()){return (await db.query(applySQL,args)).rows[0].result;}
